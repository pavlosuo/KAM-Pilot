import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { slugify } from "@/design-system/ventura-6bef42/lib/slug";

// Whitelist of safe profile columns to expose publicly.
const PROFILE_PUBLIC_COLUMNS = [
  "id",
  "handle",
  "full_name",
  "avatar_url",
  "bio",
  "headline",
  "location",
  "organization",
  "investor_role",
  "founder_type",
  "verified",
  "website",
  "linkedin_url",
  "skills",
  "industries_interest",
  "why_building",
  "featured_startup_id",
  "created_at",
].join(",");

const STARTUP_PUBLIC_COLUMNS = [
  "id",
  "owner_id",
  "name",
  "slug",
  "tagline",
  "description",
  "industry",
  "stage",
  "location",
  "logo_url",
  "video_url",
  "founder_story",
  "traction",
  "looking_for",
  "one_liner",
  "website",
  "country",
  "industry_tags",
  "business_model_tags",
  "investor_readiness",
  "executive_summary",
  "problem",
  "solution",
  "market",
  "customers_and_users",
  "competitors",
  "competitive_advantage",
  "investment_case",
  "team_members",
  "attachments",
  "is_published",
  "is_primary",
  "pitch_deck_url",
  "header_image_url",
  "accelerator",
  "program_logos",
  "is_registered",
  "business_id",
  "pitch_video_uid",
  "created_at",
].join(",");

export const getPublicProfileByHandle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ handle: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;

    const { data: profile, error } = await sb
      .from("profiles")
      .select(PROFILE_PUBLIC_COLUMNS)
      .eq("handle", data.handle)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return { profile: null, experiences: [], education: [], skills: [], startups: [] };

    const userId = (profile as { id: string }).id;

    const featuredStartupId = (profile as { featured_startup_id: string | null }).featured_startup_id ?? null;

    const [expRes, eduRes, accRes, skillRes, featuredRes, memberRowsRes] = await Promise.all([
      sb.from("founder_experiences").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
      sb.from("founder_education").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
      sb.from("founder_accounts").select("photo_url, cover_url, headline, city, country, current_position, current_company, industry, about, full_name").eq("user_id", userId).maybeSingle(),
      sb.from("founder_skills").select("name, sort_order").eq("user_id", userId).order("sort_order", { ascending: true }),
      featuredStartupId
        ? sb.from("startups").select(STARTUP_PUBLIC_COLUMNS).eq("id", featuredStartupId).eq("is_published", true).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from("startup_members").select("startup_id").eq("user_id", userId),
    ]);

    // Prefer featured (per-user primary) — verify the user actually belongs to
    // that startup (owner or member) before exposing it on their profile.
    let primaryStartup: unknown = null;
    const featured = (featuredRes as { data: unknown }).data as { id: string; owner_id: string } | null;
    if (featured) {
      if (featured.owner_id === userId) {
        primaryStartup = featured;
      } else {
        const { data: mem } = await sb
          .from("startup_members")
          .select("id")
          .eq("startup_id", featured.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (mem) primaryStartup = featured;
      }
    }
    if (!primaryStartup) {
      // Fallback: most recently published startup the user owns or is a member of.
      const memberStartupIds = ((memberRowsRes.data ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id);
      const orFilter = memberStartupIds.length > 0
        ? `owner_id.eq.${userId},id.in.(${memberStartupIds.join(",")})`
        : `owner_id.eq.${userId}`;
      const { data: latestRows } = await sb
        .from("startups")
        .select(STARTUP_PUBLIC_COLUMNS)
        .eq("is_published", true)
        .or(orFilter)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(1);
      primaryStartup = ((latestRows ?? []) as unknown[])[0] ?? null;
    }

    // Weekly-update activity for the contribution board (last ~53 weeks).
    // Use the real publish timestamp, not `week_of`: week buckets are
    // relative to each startup's own published_at, so a founder active in
    // several startups gets different (sometimes future) bucket dates for
    // the same real-world week.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7 * 54);
    const sinceISO = since.toISOString();
    const { data: activityRows } = await sb
      .from("weekly_updates")
      .select("week_of, published_at, created_at")
      .eq("author_id", userId)
      .eq("is_published", true)
      .gte("created_at", sinceISO);
    const activityWeeks = Array.from(
      new Set(
        ((activityRows ?? []) as Array<{ week_of: string | null; published_at: string | null; created_at: string | null }>)
          .map((r) => {
            const stamp = r.published_at ?? r.created_at;
            if (stamp) return stamp.slice(0, 10);
            return r.week_of ?? null;
          })
          .filter((d): d is string => Boolean(d) && (d as string) >= sinceISO.slice(0, 10)),
      ),
    );


    const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const roles = ((roleRows ?? []) as Array<{ role: string }>).map((r) => r.role);

    return {
      profile,
      account: accRes.data ?? null,
      experiences: expRes.data ?? [],
      education: eduRes.data ?? [],
      skills: (skillRes.data ?? []).map((r: { name: string }) => r.name),
      startups: primaryStartup ? [primaryStartup] : [],
      activityWeeks,
      roles,
    };
  });


export const listPublicStartups = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;
    const { data, error } = await sb
      .from("startups")
      .select("id, owner_id, name, slug, tagline, one_liner, description, industry, stage, location, country, logo_url, header_image_url, industry_tags, business_model_tags, accelerator, published_at, discovery_order")
      .eq("is_published", true)
      .eq("hidden_from_discovery", false)
      .eq("is_paused", false)
      .order("discovery_order", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      id: string; owner_id: string; name: string; slug: string; tagline: string | null; one_liner: string | null;
      description: string | null; industry: string | null; stage: string | null; location: string | null;
      country: string | null; logo_url: string | null; header_image_url: string | null;
      industry_tags: string[] | null; business_model_tags: string[] | null; accelerator: string | null;
      published_at: string | null;
    }>;

    // Fallback: if the startup has no location/country, use the founder's location.
    const ownerIds = Array.from(new Set(rows.filter((r) => !r.location && !r.country).map((r) => r.owner_id)));
    const ownerLocByUser = new Map<string, { location: string | null; country: string | null }>();
    if (ownerIds.length > 0) {
      const [profsRes, accsRes] = await Promise.all([
        sb.from("profiles").select("id, location").in("id", ownerIds),
        sb.from("founder_accounts").select("user_id, city, country").in("user_id", ownerIds),
      ]);
      const profs = (profsRes.data ?? []) as Array<{ id: string; location: string | null }>;
      const accs = (accsRes.data ?? []) as Array<{ user_id: string; city: string | null; country: string | null }>;
      for (const id of ownerIds) {
        const a = accs.find((x) => x.user_id === id);
        const p = profs.find((x) => x.id === id);
        const loc = [a?.city, a?.country].filter(Boolean).join(", ") || p?.location || null;
        ownerLocByUser.set(id, { location: loc, country: a?.country ?? null });
      }
    }

    const startups = rows.map((r) => {
      if (r.location || r.country) return r;
      const fb = ownerLocByUser.get(r.owner_id);
      return { ...r, location: fb?.location ?? r.location, country: fb?.country ?? r.country };
    });

    return { startups };
  });

export const listPitchVideoStartups = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;
    const { data, error } = await sb
      .from("startups")
      .select("id, owner_id, name, slug, tagline, one_liner, description, executive_summary, industry, stage, location, country, accelerator, logo_url, header_image_url, industry_tags, business_model_tags, pitch_video_uid, pitch_deck_url, published_at")
      .eq("is_published", true)
      .eq("hidden_from_discovery", false)
      .eq("is_paused", false)
      .not("pitch_video_uid", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      id: string; owner_id: string; name: string; slug: string; tagline: string | null; one_liner: string | null;
      description: string | null; executive_summary: string | null; industry: string | null; stage: string | null;
      location: string | null; country: string | null; accelerator: string | null;
      logo_url: string | null; header_image_url: string | null;
      industry_tags: string[] | null; business_model_tags: string[] | null;
      pitch_video_uid: string | null; pitch_deck_url: string | null; published_at: string | null;
    }>;

    const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)));
    const ownersByUser = new Map<string, { full_name: string | null; avatar_url: string | null; handle: string | null }>();
    const ownerLocByUser = new Map<string, { location: string | null; country: string | null }>();
    if (ownerIds.length > 0) {
      const [profsRes, accsRes] = await Promise.all([
        sb.from("profiles").select("id, full_name, avatar_url, handle, location").in("id", ownerIds),
        sb.from("founder_accounts").select("user_id, city, country").in("user_id", ownerIds),
      ]);
      const profs = (profsRes.data ?? []) as Array<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        handle: string | null;
        location: string | null;
      }>;
      const accs = (accsRes.data ?? []) as Array<{ user_id: string; city: string | null; country: string | null }>;
      for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; handle: string | null }>) {
        ownersByUser.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url, handle: p.handle });
      }
      for (const id of ownerIds) {
        const a = accs.find((x) => x.user_id === id);
        const p = profs.find((x) => x.id === id);
        const loc = [a?.city, a?.country].filter(Boolean).join(", ") || p?.location || null;
        ownerLocByUser.set(id, { location: loc, country: a?.country ?? null });
      }
    }

    const startups = rows.map((r) => ({
      ...r,
      location: r.location || ownerLocByUser.get(r.owner_id)?.location || null,
      country: r.country || ownerLocByUser.get(r.owner_id)?.country || null,
      owner: ownersByUser.get(r.owner_id) ?? { full_name: null, avatar_url: null, handle: null },
    }));

    return { startups };
  });

// Team (owner + members) for a startup — lightweight, public-safe fields.
export const getPitchTeam = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;

    const { data: s } = await sb
      .from("startups")
      .select("id, name, owner_id")
      .eq("id", data.startupId)
      .eq("is_published", true)
      .maybeSingle();
    if (!s) return { members: [] as Array<{
      user_id: string; name: string | null; avatar_url: string | null; handle: string | null; role: string; title: string | null;
    }> };
    const startup = s as { id: string; name: string; owner_id: string };

    const { data: memRes } = await sb
      .from("startup_members")
      .select("user_id, role, title, created_at")
      .eq("startup_id", startup.id)
      .order("created_at", { ascending: true });
    const memberRows = ((memRes ?? []) as Array<{ user_id: string; role: string; title: string | null }>);

    const userIds = Array.from(new Set([startup.owner_id, ...memberRows.map((m) => m.user_id)]));
    const [profsRes, faccsRes] = await Promise.all([
      sb.from("profiles").select("id, full_name, avatar_url, handle").in("id", userIds),
      sb.from("founder_accounts").select("user_id, full_name, photo_url").in("user_id", userIds),
    ]);
    const profs = (profsRes.data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; handle: string | null }>;
    const faccs = (faccsRes.data ?? []) as Array<{ user_id: string; full_name: string | null; photo_url: string | null }>;
    const build = (uid: string, role: string, title: string | null) => {
      const p = profs.find((x) => x.id === uid);
      const f = faccs.find((x) => x.user_id === uid);
      return {
        user_id: uid,
        name: f?.full_name ?? p?.full_name ?? null,
        avatar_url: f?.photo_url ?? p?.avatar_url ?? null,
        handle: p?.handle ?? null,
        role,
        title,
      };
    };
    const members = [
      build(startup.owner_id, "owner", `Founder · ${startup.name}`),
      ...memberRows.map((m) => build(m.user_id, m.role, m.title)),
    ];
    return { members };
  });





export const getPublicStartupBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;

    const { data: startup, error } = await sb
      .from("startups")
      .select(STARTUP_PUBLIC_COLUMNS)
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!startup) return { startup: null, owner: null };

    const ownerId = (startup as { owner_id: string }).owner_id;
    const startupId = (startup as { id: string }).id;
    const [ownerRes, accRes, memRes, latestUpdRes] = await Promise.all([
      sb.from("profiles").select(PROFILE_PUBLIC_COLUMNS).eq("id", ownerId).maybeSingle(),
      sb.from("founder_accounts").select("full_name, photo_url, headline, current_position, current_company, city, country").eq("user_id", ownerId).maybeSingle(),
      sb.from("startup_members").select("id, user_id, role, title, created_at").eq("startup_id", startupId).order("created_at", { ascending: true }),
      sb.from("weekly_updates").select("id").eq("startup_id", startupId).eq("is_published", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const latestUpdateId = (latestUpdRes.data as { id: string } | null)?.id ?? null;
    let progressionCards: Array<{ id: string; label: string; value: string | null; icon_name: string | null; image_url: string | null; description: string | null }> = [];
    if (latestUpdateId) {
      const { data: cardRows } = await sb
        .from("startup_progression_cards")
        .select("id, label, value, icon_name, image_url, description, display_order")
        .eq("startup_id", startupId)
        .eq("weekly_update_id", latestUpdateId)
        .eq("is_public", true)
        .order("display_order", { ascending: true });
      progressionCards = ((cardRows ?? []) as Array<{ id: string; label: string; value: string | null; icon_name: string | null; image_url: string | null; description: string | null }>);
    }

    const profile = ownerRes.data as Record<string, unknown> | null;
    const acc = accRes.data as Record<string, unknown> | null;
    const founderLocation =
      [acc?.city, acc?.country].filter(Boolean).join(", ") ||
      (profile?.location as string | undefined) ||
      null;
    const owner = profile
      ? {
          ...profile,
          full_name: (acc?.full_name as string | undefined) || (profile.full_name as string | undefined) || null,
          avatar_url: (acc?.photo_url as string | undefined) || (profile.avatar_url as string | undefined) || null,
          headline:
            (acc?.headline as string | undefined) ||
            (profile.headline as string | undefined) ||
            [acc?.current_position, acc?.current_company].filter(Boolean).join(" · ") ||
            null,
          location: founderLocation,
        }
      : null;

    type MemberRow = { id: string; user_id: string; role: string; title: string | null };
    const memberRows = ((memRes.data as unknown) as MemberRow[] | null) ?? [];
    let teammates: Array<{
      id: string; user_id: string; role: string; title: string | null;
      name: string | null; avatar_url: string | null; handle: string | null;
    }> = [];
    if (memberRows.length > 0) {
      const userIds = memberRows.map((m) => m.user_id);
      const [profsRes, faccsRes] = await Promise.all([
        sb.from("profiles").select("id, full_name, avatar_url, handle").in("id", userIds),
        sb.from("founder_accounts").select("user_id, full_name, photo_url").in("user_id", userIds),
      ]);
      const profs = (profsRes.data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; handle: string | null }>;
      const faccs = (faccsRes.data ?? []) as Array<{ user_id: string; full_name: string | null; photo_url: string | null }>;
      teammates = memberRows.map((m) => {
        const p = profs.find((x) => x.id === m.user_id);
        const f = faccs.find((x) => x.user_id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          title: m.title,
          name: f?.full_name ?? p?.full_name ?? null,
          avatar_url: f?.photo_url ?? p?.avatar_url ?? null,
          handle: p?.handle ?? null,
        };
      });
    }

    const startupWithFounderLocation = {
      ...(startup as Record<string, unknown>),
      founder_location: founderLocation,
    };

    return { startup: startupWithFounderLocation, owner, teammates, progressionCards };
  });


// Ensure the signed-in user has a handle; generate one if missing.
export const ensureMyHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("handle, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (existing && (existing as { handle: string | null }).handle) {
      return { handle: (existing as { handle: string }).handle };
    }

    const base = slugify((existing as { full_name?: string | null } | null)?.full_name || "user") || "user";
    let candidate = base;
    for (let i = 0; i < 6; i++) {
      const { data: clash } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", candidate)
        .maybeSingle();
      if (!clash) break;
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const { error: uErr } = await supabase
      .from("profiles")
      .update({ handle: candidate } as never)
      .eq("id", userId);
    if (uErr) throw uErr;
    return { handle: candidate };
  });

const handleSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only");

export const updateMyHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ handle: handleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const next = data.handle;

    const { data: me } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", userId)
      .maybeSingle();
    if (me && (me as { handle: string | null }).handle === next) {
      return { ok: true as const, handle: next };
    }

    const { data: clash } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", next)
      .neq("id", userId)
      .maybeSingle();
    if (clash) {
      return { ok: false as const, error: "This URL is already taken. Try another." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ handle: next } as never)
      .eq("id", userId);
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return { ok: false as const, error: "This URL is already taken. Try another." };
      }
      throw error;
    }
    return { ok: true as const, handle: next };
  });

