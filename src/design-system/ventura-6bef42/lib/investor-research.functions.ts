import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ProfileBullet = {
  text: string;
  source_url: string | null;
  company?: string | null;
  company_domain?: string | null;
  logo_url?: string | null;
};

export type InvestorResearch = {
  status: "pending" | "ready" | "failed";
  positioning: string | null;
  help_with: ProfileBullet[];
  specialisations: ProfileBullet[];
  track_record: ProfileBullet[];
  best_fit_for: ProfileBullet[];
  sources: Array<{ url: string; kind: string; title?: string }>;
  researched_at: string | null;
};

export type PublicInvestor = {
  user_id: string;
  handle: string;
  full_name: string;
  headline: string | null;
  role_title: string | null;
  firm: string | null;
  location: string | null;
  photo_url: string | null;
  cover_url: string | null;
  linkedin_url: string | null;
  website: string | null;
  bio: string | null;
  industries: string[];
  stages: string[];
  locations: string[];
  company_types: string[];
  evaluation_priorities: string[];
  skip_signals: string[];
  check_size: string | null;
  intent: string | null;
  earliness: number | null;
  deals_per_year: number | null;
  research: InvestorResearch | null;
};

const bullets = (v: unknown): ProfileBullet[] =>
  Array.isArray(v)
    ? v
        .map((b) => b as { text?: unknown; source_url?: unknown; company?: unknown; company_domain?: unknown })
        .filter((b) => typeof b.text === "string" && b.text.trim())
        .map((b) => ({
          text: (b.text as string).trim(),
          source_url: typeof b.source_url === "string" && b.source_url ? b.source_url : null,
          company: typeof b.company === "string" && b.company.trim() ? b.company.trim() : null,
          logo_url: typeof (b as any).logo_url === "string" && (b as any).logo_url ? ((b as any).logo_url as string) : null,
          company_domain:
            typeof b.company_domain === "string" && b.company_domain.trim()
              ? b.company_domain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()
              : null,
        }))
    : [];

function resolvePhotoUrl(photo: string | null, linkedinUrl: string | null): string | null {
  // Sign-in provider avatars are not the LinkedIn photo — derive one from the LinkedIn handle instead.
  const isProviderAvatar = !!photo && /googleusercontent\.com|gravatar\.com/i.test(photo);
  if (photo && !isProviderAvatar) return photo;
  if (!linkedinUrl) return null;
  const handle = linkedinUrl.replace(/\/+$/, "").split("/").pop();
  if (!handle) return null;
  return `https://unavatar.io/linkedin/${encodeURIComponent(handle)}`;
}

export const getPublicInvestorByHandle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ investor: PublicInvestor | null }> => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: profile } = await sb
      .from("profiles")
      .select("id, handle")
      .eq("handle", data.handle)
      .maybeSingle();
    if (!profile) return { investor: null };
    const userId = (profile as { id: string }).id;

    const [{ data: inv }, { data: research }] = await Promise.all([
      sb.from("investor_profiles").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("investor_research").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (!inv) return { investor: null };
    const row = inv as Record<string, any>;
    const r = research as Record<string, any> | null;

    return {
      investor: {
        user_id: userId,
        handle: (profile as { handle: string }).handle,
        full_name: row.full_name ?? "",
        headline: row.headline ?? null,
        role_title: row.role_title ?? null,
        firm: row.firm ?? null,
        location: row.location ?? null,
        photo_url: resolvePhotoUrl(row.photo_url ?? null, row.linkedin_url ?? null),
        cover_url: row.cover_url ?? null,
        linkedin_url: row.linkedin_url ?? null,
        website: row.website ?? null,
        bio: row.bio ?? null,
        industries: row.industries ?? [],
        stages: row.stages ?? [],
        locations: row.locations ?? [],
        company_types: row.company_types ?? [],
        evaluation_priorities: row.evaluation_priorities ?? [],
        skip_signals: row.skip_signals ?? [],
        check_size: row.check_size ?? null,
        intent: row.intent ?? null,
        earliness: typeof row.earliness === "number" ? row.earliness : null,
        deals_per_year: typeof row.deals_per_year === "number" ? row.deals_per_year : null,
        research: r
          ? {
              status: (r.status as InvestorResearch["status"]) ?? "pending",
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

/** Kick off (or re-run) the AI research pass for the signed-in investor. */
export const runInvestorResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ status: "ready" | "failed" | "skipped"; error?: string }> => {
    const { supabase, userId } = context;
    const sb = supabase as unknown as { from: (t: string) => any };

    const { data: invRow } = await sb
      .from("investor_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!invRow) return { status: "failed", error: "No investor profile yet." };
    const inv = invRow as Record<string, any>;

    const { data: existing } = await sb
      .from("investor_research")
      .select("status, researched_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data.force && existing && (existing as { status: string }).status === "ready") {
      return { status: "skipped" };
    }

    await sb
      .from("investor_research")
      .upsert(
        { user_id: userId, status: "pending", error: null, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    try {
      const { readFirmWebsite, searchWeb, writeInvestorProfile, fetchLinkedInRecord } = await import(
        "@/design-system/ventura-6bef42/lib/investor-research.server"
      );

      const linkedin = inv.linkedin_url ? await fetchLinkedInRecord(inv.linkedin_url) : null;
      const linkedinData = linkedin?.data ?? null;

      const website =
        (typeof inv.website === "string" && inv.website) ||
        (typeof (linkedinData as any)?.website === "string" ? (linkedinData as any).website : null) ||
        (typeof (linkedinData as any)?.job_company_website === "string"
          ? (linkedinData as any).job_company_website
          : null);

      const site = website ? await readFirmWebsite(website) : { pages: [], sources: [] };

      const who = [inv.full_name, inv.firm].filter(Boolean).join(" ");
      const search = who
        ? await searchWeb([
            `${who} investor`,
            `${who} portfolio investments`,
            `${inv.firm ?? who} fund thesis`,
          ])
        : { results: [], sources: [] };

      const payload = {
        onboarding_answers: {
          full_name: inv.full_name,
          firm: inv.firm,
          role_title: inv.role_title,
          location: inv.location,
          stages: inv.stages ?? [],
          sectors: inv.industries ?? [],
          geographies: (inv.locations ?? []).map((l: string) => l.replace(/^Map area: /, "")),
          company_types: inv.company_types ?? [],
          check_size: inv.check_size,
          intent: inv.intent,
          earliness_0_to_100: inv.earliness,
          evaluation_priorities: inv.evaluation_priorities ?? [],
          skip_signals: inv.skip_signals ?? [],
          bio: inv.bio,
        },
        linkedin: linkedinData ? { kind: linkedin?.kind, url: inv.linkedin_url, data: linkedinData } : null,
        firm_website: site.pages.map((p) => ({ url: p.url, text: p.text })),
        web_results: search.results,
      };

      const out = await writeInvestorProfile(payload);

      const sources = [
        ...(inv.linkedin_url ? [{ url: inv.linkedin_url as string, kind: "linkedin" }] : []),
        ...site.sources,
        ...search.sources,
      ];

      const { error } = await sb.from("investor_research").upsert(
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
      console.error("[investor-research]", message);
      await sb.from("investor_research").upsert(
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
