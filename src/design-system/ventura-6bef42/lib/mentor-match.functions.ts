import { pdlFetch } from "@/design-system/ventura-6bef42/lib/pdl-ai.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({ startupId: z.string().uuid() });

export type MentorMatchResult = {
  name: string;
  linkedin_url: string;
  headline: string | null;
  photo_url: string | null;
  reason: string;
  points: string[];
};

type MentorRow = {
  id: string;
  linkedin_url: string;
  handle: string;
  name: string | null;
  headline: string | null;
  location: string | null;
  industries: string[] | null;
  expertise_summary: string | null;
  photo_url: string | null;
  enriched_at: string | null;
};

type PdlPerson = {
  full_name?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  job_company_industry?: string | null;
  headline?: string | null;
  summary?: string | null;
  location_name?: string | null;
  industry?: string | null;
  skills?: string[] | null;
  experience?: Array<{
    company?: { name?: string | null; industry?: string | null } | null;
    title?: { name?: string | null } | null;
    summary?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }> | null;
  education?: Array<{ school?: { name?: string | null } | null; degrees?: string[] | null }> | null;
};

async function fetchPdl(linkedinUrl: string): Promise<PdlPerson | null> {
  const url = new URL("https://api.peopledatalabs.com/v5/person/enrich");
  url.searchParams.set("profile", linkedinUrl);
  url.searchParams.set("min_likelihood", "1");
  try {
    const res = await pdlFetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PdlPerson };
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function callAi(system: string, user: string, tool: unknown, toolName: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mentor-match] AI gateway ${res.status}: ${body}`);
    if (res.status === 429) throw new Error("AI rate limit exceeded. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI did not return a result.");
  return args;
}

const profileTool = {
  type: "function",
  function: {
    name: "write_profiles",
    description: "Write a professional expertise profile for each mentor.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        profiles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              handle: { type: "string" },
              name: { type: "string" },
              headline: { type: "string" },
              location: { type: "string" },
              industries: { type: "array", items: { type: "string" } },
              expertise_summary: { type: "string" },
            },
            required: ["handle", "name", "headline", "industries", "expertise_summary"],
          },
        },
      },
      required: ["profiles"],
    },
  },
};

const matchTool = {
  type: "function",
  function: {
    name: "pick_mentor",
    description: "Pick the single most relevant mentor for the startup.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        handle: { type: "string" },
        points: {
          type: "array",
          description: "Bullet points naming each concrete match between the mentor and the startup.",
          items: { type: "string" },
        },
        reason: { type: "string" },
      },
      required: ["handle", "points", "reason"],
    },
  },
};

/** Enrich any mentors that have not been researched yet, and persist the result. */
async function ensureMentorsEnriched(sb: {
  from: (t: string) => any;
}): Promise<MentorRow[]> {
  const { data, error } = await sb.from("mentors").select("*");
  if (error) throw error;
  const mentors = (data ?? []) as MentorRow[];
  const pending = mentors.filter((m) => !m.enriched_at);
  if (pending.length === 0) return mentors;

  const raw = await Promise.all(
    pending.map(async (m) => ({ mentor: m, pdl: await fetchPdl(m.linkedin_url) })),
  );

  const payload = raw.map(({ mentor, pdl }) => ({
    handle: mentor.handle,
    linkedin_url: mentor.linkedin_url,
    known_data: pdl
      ? {
          full_name: pdl.full_name ?? null,
          headline: pdl.headline ?? pdl.job_title ?? null,
          current: [pdl.job_title, pdl.job_company_name].filter(Boolean).join(" at ") || null,
          industry: pdl.job_company_industry ?? pdl.industry ?? null,
          location: pdl.location_name ?? null,
          summary: (pdl.summary ?? "").slice(0, 800),
          skills: (pdl.skills ?? []).slice(0, 25),
          experience: (pdl.experience ?? []).slice(0, 12).map((e) => ({
            company: e.company?.name ?? null,
            industry: e.company?.industry ?? null,
            title: e.title?.name ?? null,
            start: e.start_date ?? null,
            end: e.end_date ?? null,
          })),
          education: (pdl.education ?? []).slice(0, 4).map((e) => e.school?.name ?? null),
        }
      : null,
  }));

  const system = `You are researching startup mentors. For each LinkedIn profile below you get structured data when available (it may be null).
Using that data plus your own knowledge of these public professionals, write for every handle:
- name: their real full name
- headline: one line, current role and company
- location: city/country if known, else empty string
- industries: 3-8 industry/domain tags (e.g. "SaaS", "Gaming", "Cybersecurity", "Fintech", "Deep tech", "Marketplaces")
- expertise_summary: 3-5 sentences on their career, the sectors and stages they know, and what founders can get from them.
Never invent employers you are unsure about; stay general instead. Return one profile per handle.`;

  const args = await callAi(system, JSON.stringify(payload), profileTool, "write_profiles");
  const parsed = JSON.parse(args) as {
    profiles: Array<{
      handle: string;
      name: string;
      headline: string;
      location?: string;
      industries: string[];
      expertise_summary: string;
    }>;
  };
  const byHandle = new Map(parsed.profiles.map((p) => [p.handle, p]));

  const now = new Date().toISOString();
  const updated: MentorRow[] = [];
  for (const { mentor, pdl } of raw) {
    const p = byHandle.get(mentor.handle);
    if (!p) continue;
    const row = {
      name: p.name || mentor.handle,
      headline: p.headline || null,
      location: p.location || null,
      industries: p.industries ?? [],
      expertise_summary: p.expertise_summary || null,
      raw_profile: pdl ? (pdl as unknown as Record<string, unknown>) : null,
      enriched_at: now,
    };
    await sb.from("mentors").update(row).eq("id", mentor.id);
    updated.push({ ...mentor, ...row, enriched_at: now });
  }

  const updatedIds = new Set(updated.map((m) => m.id));
  return mentors.filter((m) => !updatedIds.has(m.id)).concat(updated);
}

export const findMentorForStartup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<MentorMatchResult> => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: startup, error: sErr } = await sb
      .from("startups")
      .select(
        "id, name, tagline, one_liner, description, executive_summary, problem, solution, market, customers_and_users, competitive_advantage, traction, looking_for, industry, industry_tags, business_model_tags, stage, location, country",
      )
      .eq("id", data.startupId)
      .eq("is_published", true)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!startup) throw new Error("Startup not found.");

    const mentors = (await ensureMentorsEnriched(sb)).filter((m) => m.enriched_at);
    if (mentors.length === 0) throw new Error("No mentor data available yet. Please try again.");

    const mentorPayload = mentors.map((m) => ({
      handle: m.handle,
      name: m.name,
      headline: m.headline,
      location: m.location,
      industries: m.industries ?? [],
      expertise: m.expertise_summary,
    }));

    const system = `You match a startup with exactly one mentor from the provided list.
Weigh industry and domain overlap first, then stage fit, business model, go-to-market, and what the startup says it is looking for.
Return the mentor's handle plus:
- "points": 3 to 5 short bullet points (max ~20 words each), each naming one concrete match point between the mentor and this startup (industry overlap, stage fit, go-to-market, network, specific past experience). Start each with a short bold-free label followed by " — " and the specifics. No markdown symbols.
- "reason": one or two sentences addressed to the accelerator lead summarising why this mentor over the others.`;

    const args = await callAi(
      system,
      JSON.stringify({ startup, mentors: mentorPayload }),
      matchTool,
      "pick_mentor",
    );
    const picked = JSON.parse(args) as { handle: string; reason: string; points?: string[] };
    const mentor = mentors.find((m) => m.handle === picked.handle) ?? mentors[0]!;

    return {
      name: mentor.name ?? mentor.handle,
      linkedin_url: mentor.linkedin_url,
      headline: mentor.headline,
      photo_url: mentor.photo_url ?? null,
      reason: picked.reason,
      points: (picked.points ?? []).map((p) => p.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
    };
  });
