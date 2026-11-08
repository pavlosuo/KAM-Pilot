import { pdlFetch } from "@/design-system/ventura-6bef42/lib/pdl-ai.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  linkedinUrl: z.string().min(1).max(500),
  role: z.enum(["investor", "coach"]).default("investor"),
});

export type LinkedInBasicProfile = {
  linkedin_url: string;
  full_name: string;
  headline: string;
  role_title: string;
  company: string;
  location: string;
  photo_url: string | null;
  industries: string[];
  expertise: string[];
  bio: string;
};

type LinkedInKind = "person" | "company";

function normalizeLinkedInUrl(input: string): { url: string; kind: LinkedInKind } | null {
  const trimmed = input.trim();
  if (/linkedin\.com\/(in|company)\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const kind: LinkedInKind = /\/company\//i.test(u.pathname) ? "company" : "person";
      return { url: `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`, kind };
    } catch {
      return null;
    }
  }
  let m = trimmed.match(/^\/?company\/([A-Za-z0-9_\-\.%]+)\/?$/i);
  if (m) return { url: `https://www.linkedin.com/company/${m[1]}`, kind: "company" };
  m = trimmed.match(/^\/?(?:in\/)?([A-Za-z0-9_\-\.%]+)\/?$/);
  if (m) return { url: `https://www.linkedin.com/in/${m[1]}`, kind: "person" };
  return null;
}

type PdlPerson = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  job_company_industry?: string | null;
  headline?: string | null;
  summary?: string | null;
  location_name?: string | null;
  location_country?: string | null;
  industry?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
  profile_pic_url?: string | null;
  picture?: string | null;
  experience?: Array<{
    company?: { name?: string | null; industry?: string | null } | null;
    title?: { name?: string | null } | null;
    summary?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }> | null;
};

type PdlCompany = {
  name?: string | null;
  display_name?: string | null;
  tagline?: string | null;
  summary?: string | null;
  headline?: string | null;
  industry?: string | null;
  type?: string | null;
  website?: string | null;
  size?: string | null;
  logo_url?: string | null;
  location?: { name?: string | null; country?: string | null } | null;
};

async function fetchPdl(linkedinUrl: string): Promise<PdlPerson> {
  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  url.searchParams.set("profile", linkedinUrl);
  url.searchParams.set("min_likelihood", "1");
  const res = await pdlFetch(url.toString());
  const json = (await res.json().catch(() => null)) as
    | { data?: PdlPerson; error?: { message?: string } }
    | null;
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("We couldn't find that LinkedIn profile. Check the link or fill things in manually.");
    }
    if (res.status === 402) throw new Error("Profile lookup credits are exhausted. Please fill things in manually.");
    throw new Error(json?.error?.message || `Profile lookup failed (${res.status}).`);
  }
  return json?.data ?? {};
}

async function fetchPdlCompany(linkedinUrl: string): Promise<PdlCompany> {
  const url = new URL("https://api.peopledatalabs.com/v5/company/enrich");
  url.searchParams.set("profile", linkedinUrl);
  const res = await pdlFetch(url.toString());
  const json = (await res.json().catch(() => null)) as
    | (PdlCompany & { error?: { message?: string } })
    | null;
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("We couldn't find that LinkedIn company. Check the link or fill things in manually.");
    }
    if (res.status === 402) throw new Error("Profile lookup credits are exhausted. Please fill things in manually.");
    throw new Error(json?.error?.message || `Company lookup failed (${res.status}).`);
  }
  return json ?? {};
}

async function summarizeCompany(company: PdlCompany, role: "investor" | "coach") {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const tool = {
    type: "function",
    function: {
      name: "write_profile",
      description: "Write a concise first-person summary for a person whose LinkedIn link points at their firm/company.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          headline: { type: "string", description: "One line, max 120 chars, no fluff." },
          bio: { type: "string", description: "2-4 sentences describing the company and its investing/mentoring focus." },
          industries: { type: "array", items: { type: "string" }, description: "Up to 6 industry tags." },
          expertise: { type: "array", items: { type: "string" }, description: "Up to 8 focus areas." },
        },
        required: ["headline", "bio", "industries", "expertise"],
      },
    },
  };
  const payload = {
    company_name: company.display_name ?? company.name,
    tagline: company.tagline,
    industry: company.industry,
    type: company.type,
    size: company.size,
    location: company.location?.name,
    summary: (company.summary ?? "").slice(0, 1500),
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            role === "investor"
              ? "You summarise an investment firm/angel's company data into a clean investor profile for a startup platform. Be factual, never invent facts."
              : "You summarise an advisory/coaching firm's company data into a clean mentor profile. Be factual, never invent facts.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "write_profile" } },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args) as {
      headline: string;
      bio: string;
      industries: string[];
      expertise: string[];
    };
  } catch {
    return null;
  }
}

async function summarize(person: PdlPerson, role: "investor" | "coach") {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const tool = {
    type: "function",
    function: {
      name: "write_profile",
      description: "Write a concise profile summary from a person's public professional data.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          headline: { type: "string", description: "One line, max 120 chars, no fluff." },
          bio: { type: "string", description: "2-4 sentences in the first person." },
          industries: { type: "array", items: { type: "string" }, description: "Up to 6 industry tags." },
          expertise: { type: "array", items: { type: "string" }, description: "Up to 8 areas of expertise." },
        },
        required: ["headline", "bio", "industries", "expertise"],
      },
    },
  };
  const payload = {
    full_name: person.full_name,
    job_title: person.job_title,
    company: person.job_company_name,
    industry: person.job_company_industry ?? person.industry,
    location: person.location_name,
    skills: (person.skills ?? []).slice(0, 40),
    interests: (person.interests ?? []).slice(0, 20),
    experience: (person.experience ?? []).slice(0, 8).map((e) => ({
      title: e.title?.name,
      company: e.company?.name,
      industry: e.company?.industry,
      summary: (e.summary ?? "").slice(0, 300),
    })),
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            role === "investor"
              ? "You summarise an investor's public professional data into a clean profile for a startup platform. Be factual, never invent facts."
              : "You summarise a startup mentor/coach's public professional data into a clean profile. Be factual, never invent facts.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "write_profile" } },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args) as {
      headline: string;
      bio: string;
      industries: string[];
      expertise: string[];
    };
  } catch {
    return null;
  }
}

async function linkedinPhoto(url: string): Promise<string | null> {
  const handle = url.replace(/\/+$/, "").split("/").pop();
  if (!handle) return null;
  const candidate = `https://unavatar.io/linkedin/${encodeURIComponent(handle)}`;
  try {
    const res = await fetch(`${candidate}?fallback=false`, { method: "GET" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return candidate;
  } catch {
    return null;
  }
}

export const importLinkedInBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<LinkedInBasicProfile> => {
    const normalized = normalizeLinkedInUrl(data.linkedinUrl);
    if (!normalized) {
      throw new Error("Please enter a valid LinkedIn link (linkedin.com/in/your-handle or linkedin.com/company/name).");
    }
    const { url } = normalized;

    if (normalized.kind === "company") {
      const company = await fetchPdlCompany(url);
      const ai = await summarizeCompany(company, data.role);
      const name = company.display_name ?? company.name ?? "";
      return {
        linkedin_url: url,
        full_name: name,
        headline: ai?.headline ?? company.tagline ?? company.headline ?? "",
        role_title: "",
        company: name,
        location: company.location?.name ?? company.location?.country ?? "",
        photo_url: company.logo_url ?? (await linkedinPhoto(url)),
        industries: (ai?.industries ?? (company.industry ? [company.industry] : [])).slice(0, 6),
        expertise: (ai?.expertise ?? []).slice(0, 8),
        bio: ai?.bio ?? company.summary ?? "",
      };
    }

    const person = await fetchPdl(url);
    const ai = await summarize(person, data.role);

    const fullName =
      person.full_name ??
      [person.first_name, person.last_name].filter(Boolean).join(" ").trim();

    return {
      linkedin_url: url,
      full_name: (fullName || "").replace(/\b([a-z])/g, (m) => m.toUpperCase()),
      headline: ai?.headline ?? person.headline ?? person.job_title ?? "",
      role_title: person.job_title ?? "",
      company: person.job_company_name ?? "",
      location: person.location_name ?? person.location_country ?? "",
      photo_url: person.profile_pic_url ?? person.picture ?? (await linkedinPhoto(url)),
      industries: (ai?.industries ?? []).slice(0, 6),
      expertise: (ai?.expertise ?? person.skills ?? []).slice(0, 8),
      bio: ai?.bio ?? person.summary ?? "",
    };
  });
