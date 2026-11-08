import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ProfileBullet } from "@/design-system/ventura-6bef42/lib/investor-research.functions";

export type { ProfileBullet };

export type CoachResearch = {
  status: "pending" | "ready" | "failed";
  positioning: string | null;
  help_with: ProfileBullet[];
  specialisations: ProfileBullet[];
  track_record: ProfileBullet[];
  best_fit_for: ProfileBullet[];
  sources: Array<{ url: string; kind: string; title?: string }>;
  researched_at: string | null;
};

export type PublicCoach = {
  user_id: string;
  handle: string;
  full_name: string;
  headline: string | null;
  role_title: string | null;
  company: string | null;
  location: string | null;
  photo_url: string | null;
  cover_url: string | null;
  linkedin_url: string | null;
  website: string | null;
  bio: string | null;
  coaching_areas: string[];
  help_types: string[];
  industries: string[];
  stages: string[];
  founder_problems: string[];
  audiences: string[];
  motivations: string[];
  languages: string[];
  formats: string[];
  engagement_type: string | null;
  hours_per_month: number | null;
  research: CoachResearch | null;
};

const bullets = (v: unknown): ProfileBullet[] =>
  Array.isArray(v)
    ? v
        .map((b) => b as Record<string, unknown>)
        .filter((b) => typeof b.text === "string" && (b.text as string).trim())
        .map((b) => ({
          text: (b.text as string).trim(),
          source_url: typeof b.source_url === "string" && b.source_url ? (b.source_url as string) : null,
          company: typeof b.company === "string" && (b.company as string).trim() ? (b.company as string).trim() : null,
          logo_url: typeof b.logo_url === "string" && b.logo_url ? (b.logo_url as string) : null,
          company_domain:
            typeof b.company_domain === "string" && (b.company_domain as string).trim()
              ? (b.company_domain as string).trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()
              : null,
        }))
    : [];

function resolvePhotoUrl(photo: string | null, linkedinUrl: string | null): string | null {
  if (photo === "") return null;
  const isProviderAvatar = !!photo && /googleusercontent\.com|gravatar\.com/i.test(photo);
  if (photo && !isProviderAvatar) return photo;
  if (!linkedinUrl) return null;
  const handle = linkedinUrl.replace(/\/+$/, "").split("/").pop();
  if (!handle) return null;
  return `https://unavatar.io/linkedin/${encodeURIComponent(handle)}`;
}

export const getPublicCoachByHandle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ coach: PublicCoach | null }> => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: profile } = await sb
      .from("profiles")
      .select("id, handle")
      .eq("handle", data.handle)
      .maybeSingle();
    if (!profile) return { coach: null };
    const userId = (profile as { id: string }).id;

    const [{ data: coachRow }, { data: research }] = await Promise.all([
      sb.from("coach_profiles").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("coach_research").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (!coachRow) return { coach: null };
    const row = coachRow as Record<string, any>;
    const r = research as Record<string, any> | null;

    return {
      coach: {
        user_id: userId,
        handle: (profile as { handle: string }).handle,
        full_name: row.full_name ?? "",
        headline: row.headline ?? null,
        role_title: row.role_title ?? null,
        company: row.company ?? null,
        location: row.location ?? null,
        photo_url: resolvePhotoUrl(row.photo_url ?? null, row.linkedin_url ?? null),
        cover_url: row.cover_url ?? null,
        linkedin_url: row.linkedin_url ?? null,
        website: row.website ?? null,
        bio: row.bio ?? null,
        coaching_areas: row.coaching_areas ?? [],
        help_types: row.help_types ?? [],
        industries: row.industries ?? [],
        stages: row.stages ?? [],
        founder_problems: row.founder_problems ?? [],
        audiences: row.audiences ?? [],
        motivations: row.motivations ?? [],
        languages: row.languages ?? [],
        formats: row.formats ?? [],
        engagement_type: row.engagement_type ?? null,
        hours_per_month: typeof row.hours_per_month === "number" ? row.hours_per_month : null,
        research: r
          ? {
              status: (r.status as CoachResearch["status"]) ?? "pending",
              positioning: r.positioning ?? null,
              help_with: bullets(r.help_with),
              specialisations: bullets(r.specialisations),
              track_record: bullets(r.track_record),
              best_fit_for: bullets(r.best_fit_for),
              sources: Array.isArray(r.sources) ? r.sources : [],
              researched_at: r.researched_at ?? null,
            }
          : null,
      },
    };
  });

/** Kick off (or re-run) the AI research pass for the signed-in mentor. */
export const runCoachResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ status: "ready" | "failed" | "skipped"; error?: string }> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as { from: (t: string) => any };

    const { data: coachRow } = await sb
      .from("coach_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!coachRow) return { status: "failed", error: "No mentor profile yet." };
    const coach = coachRow as Record<string, any>;

    const { data: existing } = await sb
      .from("coach_research")
      .select("status, researched_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data.force && existing && (existing as { status: string }).status === "ready") {
      return { status: "skipped" };
    }

    await sb
      .from("coach_research")
      .upsert(
        { user_id: userId, status: "pending", error: null, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    try {
      const { readFirmWebsite, searchWeb, writeInvestorProfile, fetchLinkedInRecord } = await import(
        "@/design-system/ventura-6bef42/lib/investor-research.server"
      );

      const linkedin = coach.linkedin_url ? await fetchLinkedInRecord(coach.linkedin_url) : null;
      const linkedinData = linkedin?.data ?? null;

      const website =
        (typeof coach.website === "string" && coach.website) ||
        (typeof (linkedinData as any)?.website === "string" ? (linkedinData as any).website : null) ||
        (typeof (linkedinData as any)?.job_company_website === "string"
          ? (linkedinData as any).job_company_website
          : null);

      const site = website ? await readFirmWebsite(website) : { pages: [], sources: [] };

      const who = [coach.full_name, coach.company].filter(Boolean).join(" ");
      const search = who
        ? await searchWeb([`${who} mentor advisor`, `${who} experience career`, `${coach.company ?? who} about`])
        : { results: [], sources: [] };

      const payload = {
        onboarding_answers: {
          full_name: coach.full_name,
          company: coach.company,
          role_title: coach.role_title,
          location: coach.location,
          coaching_areas: coach.coaching_areas ?? [],
          help_types: coach.help_types ?? [],
          sectors: coach.industries ?? [],
          stages: coach.stages ?? [],
          founder_problems: coach.founder_problems ?? [],
          audiences: coach.audiences ?? [],
          motivations: coach.motivations ?? [],
          engagement_type: coach.engagement_type,
          hours_per_month: coach.hours_per_month,
          bio: coach.bio,
        },
        linkedin: linkedinData ? { kind: linkedin?.kind, url: coach.linkedin_url, data: linkedinData } : null,
        company_website: site.pages.map((p) => ({ url: p.url, text: p.text })),
        web_results: search.results,
      };

      const out = await writeInvestorProfile(payload, "mentor");

      const sources = [
        ...(coach.linkedin_url ? [{ url: coach.linkedin_url as string, kind: "linkedin" }] : []),
        ...site.sources,
        ...search.sources,
      ];

      const { error } = await sb.from("coach_research").upsert(
        {
          user_id: userId,
          status: "ready",
          positioning: out.positioning || null,
          help_with: out.help_with,
          specialisations: out.specialisations,
          track_record: out.track_record,
          best_fit_for: out.best_fit_for,
          sources,
          error: null,
          researched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      return { status: "ready" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Research failed.";
      console.error("[coach-research]", message);
      await sb.from("coach_research").upsert(
        {
          user_id: userId,
          status: "failed",
          error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      return { status: "failed", error: message };
    }
  });
