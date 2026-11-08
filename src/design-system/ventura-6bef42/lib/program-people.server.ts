import { pdlFetch } from "@/design-system/ventura-6bef42/lib/pdl-ai.server";
/**
 * Shared people-research helpers: LinkedIn URL parsing, People Data Labs
 * enrichment/search and photo resolution. Used by program connections
 * (dashboard) and founder-side AI matching.
 */

export type ResearchedPerson = {
  name: string;
  headline: string;
  location: string;
  linkedin_url: string;
  photo_url: string;
  expertise: string[];
  summary: string;
};

export type PdlPerson = {
  full_name?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  job_company_industry?: string | null;
  headline?: string | null;
  summary?: string | null;
  location_name?: string | null;
  industry?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
  profile_pic_url?: string | null;
  linkedin_url?: string | null;
  experience?: Array<{
    company?: { name?: string | null; industry?: string | null } | null;
    title?: { name?: string | null } | null;
    summary?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }> | null;
  education?: Array<{ school?: { name?: string | null } | null }> | null;
};

export type LinkedInTarget = { url: string; handle: string; type: "person" | "company" };

/** Accepts both member profiles (/in/…) and company/organization pages (/company/…, /school/…, /showcase/…). */
export function normalizeLinkedInUrl(input: string): LinkedInTarget | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!/linkedin\.com$/i.test(url.hostname.replace(/^www\./i, ""))) return null;
    const person = url.pathname.match(/\/in\/([^/]+)/i);
    if (person?.[1]) {
      const handle = decodeURIComponent(person[1]);
      return { url: `https://www.linkedin.com/in/${handle}`, handle, type: "person" };
    }
    const company = url.pathname.match(/\/(?:company|school|showcase)\/([^/]+)/i);
    if (company?.[1]) {
      const handle = decodeURIComponent(company[1]);
      return { url: `https://www.linkedin.com/company/${handle}`, handle, type: "company" };
    }
    return null;
  } catch {
    const match = trimmed.match(/^(?:in\/)?([A-Za-z0-9_\-.%]+)$/);
    if (!match?.[1]) return null;
    return { url: `https://www.linkedin.com/in/${match[1]}`, handle: match[1], type: "person" };
  }
}

export type PdlCompany = {
  name?: string | null;
  display_name?: string | null;
  summary?: string | null;
  industry?: string | null;
  website?: string | null;
  size?: string | null;
  employee_count?: number | null;
  founded?: number | null;
  tags?: string[] | null;
  type?: string | null;
  location?: { name?: string | null } | null;
};

export async function fetchPdlCompany(handleOrUrl: string): Promise<PdlCompany | null> {
  const url = new URL("https://api.peopledatalabs.com/v5/company/enrich");
  url.searchParams.set("profile", handleOrUrl);
  try {
    const response = await pdlFetch(url.toString());
    if (!response.ok) return null;
    return (await response.json()) as PdlCompany;
  } catch {
    return null;
  }
}

export function resolveCompanyLogo(handle: string, name: string, company: PdlCompany | null): string {
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || handle)}`;
  const website = company?.website?.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (website) return `https://logo.clearbit.com/${encodeURIComponent(website)}`;
  return fallback;
}

export async function fetchPdlProfile(linkedinUrl: string): Promise<PdlPerson | null> {
  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  url.searchParams.set("profile", linkedinUrl);
  url.searchParams.set("min_likelihood", "1");
  try {
    const response = await pdlFetch(url.toString());
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: PdlPerson };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** People Data Labs person search (SQL). Returns [] when unavailable. */
export async function searchPdlPeople(sql: string, size = 8): Promise<PdlPerson[]> {
  const url = new URL("https://api.peopledatalabs.com/v5/person/search");
  url.searchParams.set("sql", sql);
  url.searchParams.set("size", String(Math.min(Math.max(size, 1), 10)));
  url.searchParams.set("pretty", "false");
  try {
    const response = await pdlFetch(url.toString());
    if (!response.ok) return [];
    const json = (await response.json()) as { data?: PdlPerson[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export function resolvePhoto(handle: string, name: string, pdl: PdlPerson | null): string {
  if (pdl?.profile_pic_url) return pdl.profile_pic_url;
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || handle)}`;
  return `https://unavatar.io/linkedin/${encodeURIComponent(handle)}?fallback=${encodeURIComponent(fallback)}`;
}

export function pdlKnownData(pdl: PdlPerson | null) {
  if (!pdl) return null;
  return {
    full_name: pdl.full_name ?? null,
    headline: pdl.headline ?? pdl.job_title ?? null,
    current: [pdl.job_title, pdl.job_company_name].filter(Boolean).join(" at ") || null,
    industry: pdl.job_company_industry ?? pdl.industry ?? null,
    location: pdl.location_name ?? null,
    summary: (pdl.summary ?? "").slice(0, 1200),
    skills: (pdl.skills ?? []).slice(0, 30),
    experience: (pdl.experience ?? []).slice(0, 14).map((experience) => ({
      company: experience.company?.name ?? null,
      industry: experience.company?.industry ?? null,
      title: experience.title?.name ?? null,
      start: experience.start_date ?? null,
      end: experience.end_date ?? null,
      summary: (experience.summary ?? "").slice(0, 300),
    })),
    education: (pdl.education ?? []).slice(0, 4).map((education) => education.school?.name ?? null),
  };
}

/**
 * Research one person from a LinkedIn URL: enrich via PDL, then let the model
 * write a clean headline, expertise tags and a short summary.
 */
export async function researchLinkedInPerson(
  rawUrl: string,
  kind: "mentor" | "investor",
): Promise<ResearchedPerson> {
  const parsed = normalizeLinkedInUrl(rawUrl);
  if (!parsed)
    throw new Error(
      "Please paste a valid LinkedIn URL (linkedin.com/in/… or linkedin.com/company/…).",
    );

  const apiKey = process.env["LOVABLE_API_KEY"];
  const isCompany = parsed.type === "company";
  const company = isCompany ? await fetchPdlCompany(parsed.url) : null;
  const pdl = isCompany ? null : await fetchPdlProfile(parsed.url);
  const known = isCompany
    ? company
      ? {
          full_name: company.display_name ?? company.name ?? null,
          headline: [company.industry, company.location?.name].filter(Boolean).join(" · ") || null,
          location: company.location?.name ?? null,
          summary: (company.summary ?? "").slice(0, 1200),
          skills: (company.tags ?? []).slice(0, 30),
          industry: company.industry ?? null,
          size: company.size ?? null,
          employee_count: company.employee_count ?? null,
          founded: company.founded ?? null,
          website: company.website ?? null,
        }
      : null
    : pdlKnownData(pdl);

  const fallbackName =
    (isCompany ? (company?.display_name ?? company?.name ?? "").trim() : pdl?.full_name?.trim()) ||
    parsed.handle
      .split("-")
      .filter((part) => !/^[0-9a-f]{4,}$/i.test(part))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  if (!apiKey) {
    return {
      name: fallbackName,
      headline: known?.headline ?? "",
      location: known?.location ?? "",
      linkedin_url: parsed.url,
      photo_url: isCompany
        ? resolveCompanyLogo(parsed.handle, fallbackName, company)
        : resolvePhoto(parsed.handle, fallbackName, pdl),
      expertise: (known?.skills ?? []).slice(0, 6),
      summary: known?.summary ?? "",
    };
  }

  const { streamText, Output } = await import("ai");
  const { z } = await import("zod");
  const { createLovableResponsesProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");

  const schema = z.object({
    name: z.string(),
    headline: z.string(),
    location: z.string(),
    expertise: z.array(z.string()),
    summary: z.string(),
  });

  const provider = createLovableResponsesProvider(apiKey);
  const result = streamText({
    model: provider.responses("openai/gpt-5.6-sol"),
    system: isCompany
      ? `You profile an organisation (fund, company or institution) for a startup accelerator's ${kind} database. Use only the supplied data plus the LinkedIn company handle; never invent partners, portfolio or cheque sizes. name: the organisation's name. headline: one short line like "Pre-seed VC · Nordics". location: HQ city/country if known. Expertise: 3-6 short tags (sectors, stages, focus). Summary: 2-3 sentences on what they invest in or help with.`
      : `You profile a person for a startup accelerator's ${kind} database. Use only the supplied data plus the LinkedIn handle; never invent employers, funds or achievements. Headline: one short line like "Partner at X · B2B SaaS". Expertise: 3-6 short tags. Summary: 2-3 sentences on what they can actually help with.`,
    prompt: JSON.stringify({
      linkedin_url: parsed.url,
      handle: parsed.handle,
      entity: isCompany ? "organisation" : "person",
      known_data: known,
    }),
    output: Output.object({ schema }),
    providerOptions: { openai: { store: false } },
  });

  const parsedOut = (await result.output) as {
    name: string;
    headline: string;
    location: string;
    expertise: string[];
    summary: string;
  };

  const name = parsedOut.name?.trim() || fallbackName;
  return {
    name,
    headline: (parsedOut.headline ?? "").trim(),
    location: (parsedOut.location ?? "").trim(),
    linkedin_url: parsed.url,
    photo_url: isCompany
      ? resolveCompanyLogo(parsed.handle, name, company)
      : resolvePhoto(parsed.handle, name, pdl),
    expertise: (parsedOut.expertise ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 6),
    summary: (parsedOut.summary ?? "").trim(),
  };
}
