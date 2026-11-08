import { pdlFetch } from "@/design-system/ventura-6bef42/lib/pdl-ai.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  linkedinUrl: z.string().min(1).max(500),
});

export type ImportedExperience = {
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
  location: string;
};

export type ImportedEducation = {
  school: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};

export type LinkedInImportResult = {
  experiences: ImportedExperience[];
  educations: ImportedEducation[];
  skipped: { label: string; reason: string }[];
};

function normalizeLinkedInUrl(input: string): string | null {
  const trimmed = input.trim();
  // Accept bare handle "in/john-doe" or full URL
  const match = trimmed.match(/(?:linkedin\.com\/in\/|^in\/|^\/in\/|^)([A-Za-z0-9_\-\.%]+)\/?$/);
  if (match && !trimmed.includes("linkedin.com")) {
    return `https://www.linkedin.com/in/${match[1]}`;
  }
  if (/linkedin\.com\/in\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      return `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      return null;
    }
  }
  return null;
}

function toTitleCase(s: string): string {
  return (s ?? "").replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function pdlDate(d: unknown): { iso: string; isCurrent: boolean } {
  if (!d || typeof d !== "string") return { iso: "", isCurrent: false };
  // PDL returns "YYYY", "YYYY-MM", or "YYYY-MM-DD"
  const parts = d.split("-");
  const y = parts[0];
  const m = parts[1] ?? "01";
  if (!y || y.length !== 4) return { iso: "", isCurrent: false };
  return { iso: `${y}-${m.padStart(2, "0")}-01`, isCurrent: false };
}

type PdlExperience = {
  company?: { name?: string | null; industry?: string | null } | null;
  title?: { name?: string | null } | null;
  summary?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_primary?: boolean | null;
  location_names?: string[] | null;
};

type PdlEducation = {
  school?: { name?: string | null } | null;
  degrees?: string[] | null;
  majors?: string[] | null;
  summary?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type PdlResponse = {
  status?: number;
  data?: {
    experience?: PdlExperience[];
    education?: PdlEducation[];
  };
  error?: { message?: string };
};

async function fetchPdlProfile(linkedinUrl: string): Promise<PdlResponse> {
  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  url.searchParams.set("profile", linkedinUrl);
  url.searchParams.set("min_likelihood", "1");
  const res = await pdlFetch(url.toString());
  const json = (await res.json().catch(() => null)) as PdlResponse | null;
  if (!res.ok) {
    const msg = json?.error?.message || `People Data Labs error ${res.status}`;
    if (res.status === 404) throw new Error("URL is incorrect or your Experience block is empty");
    if (res.status === 402) throw new Error("People Data Labs credits exhausted. Please top up.");
    throw new Error(msg);
  }
  return json ?? {};
}

type ClassifierItem = {
  index: number;
  company: string;
  title: string;
  summary: string;
};

type ClassifierResult = {
  classifications: { index: number; bucket: "experience" | "education"; reason?: string }[];
};

async function classifyExperiences(items: ClassifierItem[]): Promise<ClassifierResult> {
  if (items.length === 0) return { classifications: [] };
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const tool = {
    type: "function",
    function: {
      name: "classify_entries",
      description: "Classify LinkedIn experience entries for a startup founder profile.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          classifications: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                index: { type: "number" },
                bucket: { type: "string", enum: ["experience", "education"] },
                reason: { type: "string" },
              },
              required: ["index", "bucket"],
            },
          },
        },
        required: ["classifications"],
      },

    },
  };

  const system = `You classify every LinkedIn Experience entry into exactly one of two buckets for a founder's startup profile. Never skip — assign every item.
- "education": accelerators, incubators, startup programs, hackathons, pitch competitions, fellowships (Y Combinator, Techstars, Antler, EF, Slush, Junction, etc.), bootcamps, courses, fellowships, short programs.
- "experience": everything else — any actual work role (founder, co-founder, employee, advisor, intern, contractor, corporate job, consulting, freelance, government, teaching, volunteer). When unsure, choose "experience".
Return one classification per index, covering every input item.`;


  const userPayload = JSON.stringify(items);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPayload },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "classify_entries" } },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI rate limit exceeded. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI gateway error ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) throw new Error("AI did not classify the entries.");
  try {
    return JSON.parse(argsStr) as ClassifierResult;
  } catch {
    throw new Error("AI returned invalid classification JSON.");
  }
}

export const importFromLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<LinkedInImportResult> => {
    const url = normalizeLinkedInUrl(data.linkedinUrl);
    if (!url) throw new Error("Please enter a valid LinkedIn profile URL (e.g. linkedin.com/in/your-handle).");

    const pdl = await fetchPdlProfile(url);
    const rawExperiences = pdl.data?.experience ?? [];
    if (rawExperiences.length === 0) {
      return { experiences: [], educations: [], skipped: [] };
    }

    const items: ClassifierItem[] = rawExperiences.map((e, i) => ({
      index: i,
      company: e.company?.name ?? "",
      title: e.title?.name ?? "",
      summary: (e.summary ?? "").slice(0, 600),
    }));

    const { classifications } = await classifyExperiences(items);
    const byIndex = new Map(classifications.map((c) => [c.index, c]));

    const experiences: ImportedExperience[] = [];
    const educations: ImportedEducation[] = [];
    const skipped: { label: string; reason: string }[] = [];

    rawExperiences.forEach((raw, i) => {
      const cls = byIndex.get(i);
      const company = raw.company?.name?.trim() ?? "";
      const title = raw.title?.name?.trim() ?? "";
      if (!company && !title) return;

      const start = pdlDate(raw.start_date);
      const endRaw = pdlDate(raw.end_date);
      const isCurrent = !raw.end_date || raw.is_primary === true;
      const location = (raw.location_names ?? []).filter(Boolean).join(", ");

      const bucket = cls?.bucket ?? "experience";
      if (bucket === "education") {
        educations.push({
          school: toTitleCase(company || title),
          start_date: start.iso,
          end_date: isCurrent ? "" : endRaw.iso,
          is_current: isCurrent,
          description: [toTitleCase(title), raw.summary].filter(Boolean).join(" — "),
        });
      } else {
        experiences.push({
          title: toTitleCase(title || "Founder"),
          company: toTitleCase(company),
          start_date: start.iso,
          end_date: isCurrent ? "" : endRaw.iso,
          is_current: isCurrent,
          description: raw.summary ?? "",
          location: toTitleCase(location),
        });
      }
    });


    return { experiences, educations, skipped };
  });
