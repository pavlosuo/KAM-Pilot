import { pdlFetch } from "@/design-system/ventura-6bef42/lib/pdl-ai.server";
import { z } from "zod";

export type MentorProfile = {
  name: string;
  headline: string;
  location: string;
  linkedin_url: string;
  photo_url: string;
  expertise: string[];
  summary: string;
};

export type CohortMentorMatch = {
  mentor: MentorProfile;
  startup: { id: string; name: string; logo_url: string | null; stage: string | null };
  points: string[];
  reason: string;
};

export const matchMentorInputSchema = z.object({
  slug: z.string().min(1),
  linkedinUrl: z.string().trim().min(3).max(500),
  excludeStartupIds: z.array(z.string().uuid()).max(50).default([]),
});

export const saveMentorInputSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  headline: z.string().trim().max(300).default(""),
  linkedinUrl: z.string().trim().max(500),
  photoUrl: z.string().trim().max(1000).default(""),
  expertise: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  summary: z.string().trim().max(2000).default(""),
  startupId: z.string().uuid(),
  points: z.array(z.string().trim().max(300)).max(8).default([]),
  reason: z.string().trim().max(1000).default(""),
  assign: z.boolean().default(true),
});

const matchOutputSchema = z.object({
  mentor_name: z.string(),
  mentor_headline: z.string(),
  mentor_location: z.string(),
  mentor_expertise: z.array(z.string()),
  mentor_summary: z.string(),
  startup_id: z.string(),
  points: z.array(z.string()),
  reason: z.string(),
});

type MatchMentorInput = z.infer<typeof matchMentorInputSchema>;
type SaveMentorInput = z.infer<typeof saveMentorInputSchema>;

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
  profile_pic_url?: string | null;
  experience?: Array<{
    company?: { name?: string | null; industry?: string | null } | null;
    title?: { name?: string | null } | null;
    summary?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }> | null;
  education?: Array<{ school?: { name?: string | null } | null }> | null;
};

function normalizeLinkedInUrl(input: string): { url: string; handle: string } | null {
  const trimmed = input.trim();
  const withProtocol = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!/linkedin\.com$/i.test(url.hostname.replace(/^www\./i, ""))) return null;
    const match = url.pathname.match(/\/in\/([^/]+)/i);
    if (!match?.[1]) return null;
    const handle = decodeURIComponent(match[1]);
    return { url: `https://www.linkedin.com/in/${handle}`, handle };
  } catch {
    const match = trimmed.match(/^(?:in\/)?([A-Za-z0-9_\-.%]+)$/);
    if (!match?.[1]) return null;
    return { url: `https://www.linkedin.com/in/${match[1]}`, handle: match[1] };
  }
}

async function fetchPdl(linkedinUrl: string): Promise<PdlPerson | null> {
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

function resolvePhoto(handle: string, name: string, pdl: PdlPerson | null): string {
  if (pdl?.profile_pic_url) return pdl.profile_pic_url;
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || handle)}`;
  return `https://unavatar.io/linkedin/${encodeURIComponent(handle)}?fallback=${encodeURIComponent(fallback)}`;
}

export async function performMentorMatch(data: MatchMentorInput): Promise<CohortMentorMatch> {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const { streamText, Output } = await import("ai");
  const { createLovableResponsesProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");

  const parsedUrl = normalizeLinkedInUrl(data.linkedinUrl);
  if (!parsedUrl) throw new Error("Please paste a valid LinkedIn profile URL (linkedin.com/in/…).");
  const programId = await requireProgram(data.slug);
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const { data: members } = await supabaseAdmin
    .from("program_startups")
    .select("startup_id")
    .eq("program_id", programId)
    .eq("status", "approved");
  const excluded = new Set(data.excludeStartupIds);
  const allIds = ((members ?? []) as Array<{ startup_id: string }>).map((member) => member.startup_id);
  if (!allIds.length) throw new Error("No approved startups in this cohort yet.");
  const startupIds = allIds.filter((id) => !excluded.has(id));
  if (!startupIds.length) throw new Error("No other startups left to match this mentor with.");

  const [{ data: startups }, { data: updates }, { data: goals }] = await Promise.all([
    supabaseAdmin.from("startups").select("id, name, logo_url, stage, tagline, one_liner, description, problem, solution, market, customers_and_users, competitive_advantage, traction, looking_for, industry, industry_tags, business_model_tags, location, country").in("id", startupIds),
    supabaseAdmin.from("weekly_updates").select("startup_id, title, summary, week_of").in("startup_id", startupIds).order("week_of", { ascending: false }).limit(120),
    supabaseAdmin.from("startup_weekly_goals").select("startup_id, title, status, week_of").in("startup_id", startupIds).order("week_of", { ascending: false }).limit(200),
  ]);

  const startupRows = (startups ?? []) as Array<Record<string, unknown> & { id: string }>;
  const updateRows = (updates ?? []) as Array<{ startup_id: string; title: string | null; summary: string | null; week_of: string | null }>;
  const goalRows = (goals ?? []) as Array<{ startup_id: string; title: string | null; status: string | null; week_of: string | null }>;
  const cohort = startupRows.map((startup) => ({
    ...startup,
    recent_updates: updateRows.filter((update) => update.startup_id === startup.id).slice(0, 3).map((update) => ({ week_of: update.week_of, title: update.title, summary: (update.summary ?? "").slice(0, 700) })),
    recent_goals: goalRows.filter((goal) => goal.startup_id === startup.id).slice(0, 8).map((goal) => ({ title: goal.title, status: goal.status, week_of: goal.week_of })),
  }));

  const pdl = await fetchPdl(parsedUrl.url);
  const knownData = pdl ? {
    full_name: pdl.full_name ?? null,
    headline: pdl.headline ?? pdl.job_title ?? null,
    current: [pdl.job_title, pdl.job_company_name].filter(Boolean).join(" at ") || null,
    industry: pdl.job_company_industry ?? pdl.industry ?? null,
    location: pdl.location_name ?? null,
    summary: (pdl.summary ?? "").slice(0, 1200),
    skills: (pdl.skills ?? []).slice(0, 30),
    experience: (pdl.experience ?? []).slice(0, 14).map((experience) => ({ company: experience.company?.name ?? null, industry: experience.company?.industry ?? null, title: experience.title?.name ?? null, start: experience.start_date ?? null, end: experience.end_date ?? null, summary: (experience.summary ?? "").slice(0, 300) })),
    education: (pdl.education ?? []).slice(0, 4).map((education) => education.school?.name ?? null),
  } : null;

  const provider = createLovableResponsesProvider(apiKey);
  const result = streamText({
    model: provider.responses("openai/gpt-5.6-sol"),
    system: `You are a matchmaking analyst for a startup accelerator. Describe the mentor from the supplied LinkedIn data without inventing employers, then pick exactly one startup that benefits most. Weigh domain overlap, stage, business model, go-to-market needs, requested help, goals and weekly updates. Return 3-5 concise match points formatted as "Label — specifics" and a brief reason.`,
    prompt: JSON.stringify({ mentor: { linkedin_url: parsedUrl.url, handle: parsedUrl.handle, known_data: knownData }, cohort }),
    output: Output.object({ schema: matchOutputSchema }),
    providerOptions: { openai: { store: false } },
  });
  const parsed = (await result.output) as z.infer<typeof matchOutputSchema>;
  const startup = startupRows.find((row) => row.id === parsed.startup_id) ?? startupRows[0];
  if (!startup) throw new Error("No eligible startup could be matched.");
  const name = parsed.mentor_name.trim() || parsedUrl.handle;

  return {
    mentor: { name, headline: parsed.mentor_headline.trim(), location: parsed.mentor_location.trim(), linkedin_url: parsedUrl.url, photo_url: resolvePhoto(parsedUrl.handle, name, pdl), expertise: parsed.mentor_expertise.slice(0, 8), summary: parsed.mentor_summary.trim() },
    startup: { id: startup.id, name: (startup.name as string) ?? "Startup", logo_url: (startup.logo_url as string | null) ?? null, stage: (startup.stage as string | null) ?? null },
    points: parsed.points.map((point) => point.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 5),
    reason: parsed.reason.trim(),
  };
}

export async function persistMentorMatch(data: SaveMentorInput): Promise<{ id: string }> {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const programId = await requireProgram(data.slug);
  const { data: row, error } = await supabaseAdmin.from("program_coaches").insert({ program_id: programId, name: data.name, expertise: data.expertise, photo_url: data.photoUrl || null, linkedin_url: data.linkedinUrl || null, headline: data.headline || null, expertise_summary: data.summary || null, matched_startup_id: data.startupId, match_points: data.points, match_reason: data.reason || null }).select("id").single();
  if (error || !row) throw new Error(error?.message ?? "Could not save this mentor.");
  const id = row.id as string;
  if (data.assign) {
    const { error: assignmentError } = await supabaseAdmin.from("program_startups").update({ coach_id: id, coach_name: data.name }).eq("program_id", programId).eq("startup_id", data.startupId);
    if (assignmentError) throw new Error(assignmentError.message);
  }
  return { id };
}