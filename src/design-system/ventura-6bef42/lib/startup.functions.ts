import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { slugify } from "@/design-system/ventura-6bef42/lib/slug";
import { computeCurrentWeekStart, computeNextWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { isTestingModeEmail } from "@/design-system/ventura-6bef42/lib/testing-mode";

// ----- helpers -----

async function getOwnedStartupId(
  supabase: { from: (t: string) => unknown },
  startupId: string,
  userId: string,
): Promise<string> {
  const ownerQ = supabase.from("startups") as unknown as {
    select: (s: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }> };
      };
    };
  };
  const { data: ownerRow, error: ownerErr } = await ownerQ
    .select("id")
    .eq("id", startupId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (ownerErr) throw ownerErr as Error;
  if (ownerRow) return ownerRow.id;

  // Team-member fallback: invited co-founders can also edit
  const memberQ = supabase.from("startup_members") as unknown as {
    select: (s: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }> };
      };
    };
  };
  const { data: memberRow, error: memberErr } = await memberQ
    .select("id")
    .eq("startup_id", startupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberErr) throw memberErr as Error;
  if (!memberRow) throw new Error("Startup not found or you don't have access");
  return startupId;
}

// ----- read -----

export const listMyStartups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string | null } | null)?.email ?? null;
    const testingMode = isTestingModeEmail(email);
    // Startups the user owns (RLS-respected)
    const { data: owned, error: ownedErr } = await supabase
      .from("startups")
      .select("*")
      .eq("owner_id", userId)
      .eq("is_demo", false)
      .order("created_at", { ascending: false });
    if (ownedErr) throw ownedErr;

    // Startups the user is a member of (not owner) - RLS allows users to see own membership rows
    const { data: memberships, error: memErr } = await supabase
      .from("startup_members")
      .select("startup_id")
      .eq("user_id", userId);
    if (memErr) throw memErr;

    const ownedIds = new Set((owned ?? []).map((s: { id: string }) => s.id));
    const memberIds = (memberships ?? [])
      .map((m: { startup_id: string }) => m.startup_id)
      .filter((id: string) => !ownedIds.has(id));

    let memberStartups: Array<Record<string, unknown>> = [];
    if (memberIds.length > 0) {
      const { data: rows, error: rowsErr } = await supabase
        .from("startups")
        .select("*")
        .in("id", memberIds)
        .eq("is_demo", false)
        .order("created_at", { ascending: false });
      if (rowsErr) throw rowsErr;
      memberStartups = rows ?? [];
    }

    // Per-user primary lives on profiles.featured_startup_id
    const { data: prof } = await supabase
      .from("profiles")
      .select("featured_startup_id")
      .eq("id", userId)
      .maybeSingle();
    const featuredId = (prof as { featured_startup_id: string | null } | null)?.featured_startup_id ?? null;

    const startups = [
      ...(owned ?? []).map((s) => ({ ...s, viewer_role: "owner" as const, is_primary: s.id === featuredId })),
      ...memberStartups.map((s) => ({ ...s, viewer_role: "member" as const, is_primary: s.id === featuredId })),
    ];

    // Per startup: has the current week already been published (by this user)?
    const weekByStartup = new Map<string, string | null>();
    for (const s of startups) {
      weekByStartup.set(
        (s as { id: string }).id,
        computeCurrentWeekStart((s as { published_at?: string | null }).published_at ?? null),
      );
    }
    const ids = startups.map((s) => (s as { id: string }).id);
    const weekStarts = Array.from(
      new Set(Array.from(weekByStartup.values()).filter((w): w is string => Boolean(w))),
    );
    const publishedSet = new Set<string>();
    if (ids.length > 0 && weekStarts.length > 0) {
      const { data: wu } = await supabase
        .from("weekly_updates")
        .select("startup_id, week_of, author_id")
        .in("startup_id", ids)
        .in("week_of", weekStarts)
        .eq("author_id", userId)
        .eq("is_published", true);
      for (const r of (wu as { startup_id: string; week_of: string }[] | null) ?? []) {
        if (weekByStartup.get(r.startup_id) === r.week_of) publishedSet.add(r.startup_id);
      }
    }

    // Engagement counts for each startup (likes, comments, deck openings, saves, follows)
    const counts = {
      likes: new Map<string, number>(),
      comments: new Map<string, number>(),
      deckOpenings: new Map<string, number>(),
      saves: new Map<string, number>(),
      follows: new Map<string, number>(),
    };
    if (ids.length > 0) {
      // Saves / follows / deck openings are private to each viewer under RLS, so
      // aggregate them with the admin client scoped to the caller's own startups.
      const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
      const sb = supabaseAdmin as unknown as typeof supabase;
      const [likesRes, commentsRes, deckRes, savesRes, followsRes] = await Promise.all([
        supabase.from("likes").select("startup_id").in("startup_id", ids),
        supabase.from("comments").select("startup_id").in("startup_id", ids),
        sb.from("pitch_deck_openings").select("startup_id").in("startup_id", ids),
        sb.from("saves").select("startup_id").in("startup_id", ids),
        sb.from("startup_follows").select("startup_id").in("startup_id", ids),
      ]);

      const fill = (rows: unknown, map: Map<string, number>) => {
        for (const r of (rows as { startup_id: string }[] | null) ?? []) {
          map.set(r.startup_id, (map.get(r.startup_id) ?? 0) + 1);
        }
      };
      fill(likesRes.data, counts.likes);
      fill(commentsRes.data, counts.comments);
      fill(deckRes.data, counts.deckOpenings);
      fill(savesRes.data, counts.saves);
      fill(followsRes.data, counts.follows);
    }

    const startupsOut = startups.map((s) => ({
      ...s,
      current_week_published: testingMode ? false : publishedSet.has((s as { id: string }).id),
      next_week_start: computeNextWeekStart((s as { published_at?: string | null }).published_at ?? null),
      engagement: {
        likes: counts.likes.get((s as { id: string }).id) ?? 0,
        comments: counts.comments.get((s as { id: string }).id) ?? 0,
        deckOpenings: counts.deckOpenings.get((s as { id: string }).id) ?? 0,
        saves: counts.saves.get((s as { id: string }).id) ?? 0,
        follows: counts.follows.get((s as { id: string }).id) ?? 0,
      },
    }));

    return { startups: startupsOut };
  });

export const recordDeckOpening = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pitch_deck_openings")
      .insert({ startup_id: data.startupId });
    if (error) throw error;
    return { ok: true };
  });

export const getMyStartupById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await getOwnedStartupId(supabase, data.id, userId);
    const { data: row, error } = await supabase
      .from("startups")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return { startup: row };
  });

// ----- basics (create / update) -----

const STARTUP_STAGES = [
  "Idea",
  "Validating Problem",
  "Building MVP",
  "MVP Launched",
  "Pilot / Beta",
  "Early Traction",
  "Revenue",
  "Scaling",
] as const;

const basicsInput = z.object({
  name: z.string().trim().min(1).max(120),
  logo_url: z.string().url().optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  is_registered: z.boolean().optional().nullable(),
  business_id: z.string().trim().max(60).optional().nullable(),
  stage: z.enum(STARTUP_STAGES).optional().nullable(),
});

export const createStartupBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => basicsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Owned startups + team memberships both count toward the 2-startup cap.
    const { countUserStartups, MAX_STARTUPS_PER_USER } = await import(
      "@/design-system/ventura-6bef42/lib/startup-limit.server"
    );
    const affiliatedCount = await countUserStartups(supabase, userId);
    if (affiliatedCount >= MAX_STARTUPS_PER_USER) {
      throw new Error("You can't create another startup profile at this time.");
    }

    const base = slugify(data.name) || "startup";

    let created: any = null;
    let lastError: any = null;
    for (let i = 0; i < 6; i++) {
      const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
      const { data: row, error } = await supabase
        .from("startups")
        .insert({
          owner_id: userId,
          name: data.name,
          slug,
          logo_url: data.logo_url ?? null,
          website: data.website?.trim() || null,
          is_registered: data.is_registered ?? null,
          business_id: data.is_registered ? (data.business_id?.trim() || null) : null,
          stage: data.stage ?? null,
        })
        .select("*")
        .single();
      if (!error) {
        created = row;
        break;
      }
      lastError = error;
      if ((error as any).code !== "23505") throw error;
    }
    if (!created) throw lastError ?? new Error("Could not generate a unique slug");
    return { startup: created };
  });

const updateBasicsInput = basicsInput.extend({ id: z.string().uuid() });

export const updateStartupBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateBasicsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await getOwnedStartupId(supabase, data.id, userId);
    const updatePayload: Record<string, unknown> = {
      name: data.name,
      logo_url: data.logo_url ?? null,
      website: data.website?.trim() || null,
    };
    if (data.is_registered !== undefined) {
      updatePayload.is_registered = data.is_registered;
      updatePayload.business_id = data.is_registered ? (data.business_id?.trim() || null) : null;
    }
    if (data.stage !== undefined) {
      updatePayload.stage = data.stage ?? null;
    }
    const { data: updated, error } = await supabase
      .from("startups")
      .update(updatePayload as never)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return { startup: updated };
  });

// ----- generic field updates -----

const fieldUpdateInput = z.object({
  startupId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
});

// Only allow safe URL schemes; reject javascript:, data:, vbscript:, etc.
function sanitizeUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

const URL_FIELDS = new Set([
  "website",
  "pitch_deck_url",
  "video_url",
  "header_image_url",
  "logo_url",
]);

const ALLOWED_UPDATE_FIELDS = new Set([
  "name",
  "location",
  "is_registered",
  "business_id",
  "one_liner",
  "tagline",
  "description",
  "problem",
  "solution",
  "market",
  "traction",
  "looking_for",
  "customers_and_users",
  "competitive_advantage",
  "investor_readiness",
  "executive_summary",
  "investment_case",
  "industry_tags",
  "business_model_tags",
  "competitors",
  "missing_information",
  "team_members",
  "attachments",
  "program_logos",
  "website",
  "video_url",
  "header_image_url",
  "logo_url",
  "pitch_deck_url",
  "accelerator",
  "stage",
]);

const MAX_FIELD_LENGTH = 1200;
const MAX_SHORT_FIELD_LENGTH = 400;
const MAX_TAG_COUNT = 7;

const SHORT_LENGTH_LIMITED_FIELDS = new Set([
  "one_liner",
  "name",
  "location",
  "business_id",
]);

const LENGTH_LIMITED_FIELDS = new Set([
  "tagline",
  "description",
  "problem",
  "solution",
  "market",
  "traction",
  "looking_for",
  "customers_and_users",
  "competitive_advantage",
  "investor_readiness",
  "executive_summary",
  "investment_case",
  "accelerator",
]);

const SHORT_LENGTH_LIMITED_ARRAY_FIELDS = new Set([
  "industry_tags",
  "business_model_tags",
  "competitors",
]);

const LENGTH_LIMITED_ARRAY_FIELDS = new Set<string>([]);

const TAG_COUNT_LIMITED_FIELDS = new Set([
  "industry_tags",
  "business_model_tags",
]);

function enforceMaxLength(key: string, value: unknown): unknown {
  if (SHORT_LENGTH_LIMITED_FIELDS.has(key) && typeof value === "string") {
    return value.slice(0, MAX_SHORT_FIELD_LENGTH);
  }
  if (LENGTH_LIMITED_FIELDS.has(key) && typeof value === "string") {
    return value.slice(0, MAX_FIELD_LENGTH);
  }
  if (SHORT_LENGTH_LIMITED_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
    const trimmed = value
      .map((item) => (typeof item === "string" ? item.slice(0, MAX_SHORT_FIELD_LENGTH) : item))
      .filter((item) => item != null && String(item).trim().length > 0);
    if (TAG_COUNT_LIMITED_FIELDS.has(key)) {
      return trimmed.slice(0, MAX_TAG_COUNT);
    }
    return trimmed;
  }
  if (LENGTH_LIMITED_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
    const trimmed = value
      .map((item) => (typeof item === "string" ? item.slice(0, MAX_FIELD_LENGTH) : item))
      .filter((item) => item != null && String(item).trim().length > 0);
    if (TAG_COUNT_LIMITED_FIELDS.has(key)) {
      return trimmed.slice(0, MAX_TAG_COUNT);
    }
    return trimmed;
  }
  return value;
}

function sanitizeFieldData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_UPDATE_FIELDS.has(key)) {
      out[key] = enforceMaxLength(key, value);
    }
  }
  if ("name" in out) {
    const nextName = typeof out.name === "string" ? out.name.trim() : "";
    if (nextName) out.name = nextName;
    else delete out.name;
  }
  for (const key of Object.keys(out)) {
    if (URL_FIELDS.has(key) && out[key] != null) {
      out[key] = sanitizeUrl(out[key]);
    }
  }
  if (Array.isArray(out.team_members)) {
    out.team_members = (out.team_members as Array<Record<string, unknown>>).map((m) => ({
      ...m,
      linkedin: m?.linkedin != null ? sanitizeUrl(m.linkedin) : null,
      avatar_url: m?.avatar_url != null ? sanitizeUrl(m.avatar_url) : null,
    }));
  }
  if (Array.isArray(out.attachments)) {
    out.attachments = (out.attachments as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      url: a?.url != null ? sanitizeUrl(a.url) : null,
    }));
  }
  if (out.program_logos && typeof out.program_logos === "object") {
    const pl = out.program_logos as Record<string, unknown>;
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(pl)) {
      const safe = sanitizeUrl(v);
      if (safe) cleaned[k] = safe;
    }
    out.program_logos = cleaned;
  }
  return out;
}


export const updateStartupFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fieldUpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await getOwnedStartupId(supabase, data.startupId, userId);
    const sanitized = sanitizeFieldData(data.data);
    const { error } = await supabase
      .from("startups")
      .update(sanitized as never)
      .eq("id", data.startupId);
    if (error) throw error;
    return { ok: true };
  });

const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only");

export const updateStartupSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), slug: slugSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Slug changes are owner-only (DB trigger enforces this too).
    const { data: ownerRow, error: ownerErr } = await (supabase.from("startups") as unknown as {
      select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }> } } };
    }).select("id").eq("id", data.startupId).eq("owner_id", userId).maybeSingle();
    if (ownerErr) throw ownerErr as Error;
    if (!ownerRow) return { ok: false, error: "Only the startup owner can change the URL." };


    const { data: clash } = await (supabase.from("startups") as unknown as {
      select: (s: string) => { eq: (k: string, v: string) => { neq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> } } };
    }).select("id").eq("slug", data.slug).neq("id", data.startupId).maybeSingle();
    if (clash) {
      return { ok: false, error: "This URL is already taken. Try another." };
    }

    const { error } = await supabase
      .from("startups")
      .update({ slug: data.slug } as never)
      .eq("id", data.startupId);
    if (error) {
      const message = typeof error.message === "string" ? error.message : "Could not update URL";
      if (message.includes("Only the startup owner")) {
        return { ok: false, error: "Only the startup owner can change the URL." };
      }
      if (message.includes("duplicate") || message.includes("unique")) {
        return { ok: false, error: "This URL is already taken. Try another." };
      }
      throw error;
    }
    return { ok: true, slug: data.slug };
  });


// ----- pitch deck -----

const pitchDeckInput = z.object({
  startupId: z.string().uuid(),
  pdfUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), { message: "Only http(s) URLs are allowed" })
    .nullable(),
  pdfPath: z.string().nullable(),
});

export const setStartupPitchDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pitchDeckInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await getOwnedStartupId(supabase, data.startupId, userId);
    const { error } = await supabase
      .from("startups")
      .update({ pitch_deck_url: data.pdfUrl, pitch_deck_path: data.pdfPath } as never)
      .eq("id", data.startupId);
    if (error) throw error;
    return { ok: true };
  });

// ----- publish from draft -----

const publishInput = z.object({
  startupId: z.string().uuid(),
  draftId: z.string().uuid(),
  publish: z.boolean().default(true),
});

export const publishStartupFromDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => publishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await getOwnedStartupId(supabase, data.startupId, userId);

    const { data: draft, error: dErr } = await supabase
      .from("startup_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("user_id", userId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!draft) throw new Error("Draft not found");

    const p = draft.data as Record<string, unknown>;
    const update: Record<string, unknown> = {
      one_liner: p.one_liner ?? null,
      industry_tags: Array.isArray(p.industry_tags) ? p.industry_tags.slice(0, MAX_TAG_COUNT) : [],
      business_model_tags: Array.isArray(p.business_model_tags) ? p.business_model_tags.slice(0, MAX_TAG_COUNT) : [],
      executive_summary: p.executive_summary ?? null,
      problem: p.problem ?? null,
      solution: p.solution ?? null,
      market: p.market ?? null,
      customers_and_users: p.customers_and_users ?? null,
      competitors: Array.isArray(p.competitors) ? p.competitors : [],
      competitive_advantage: p.competitive_advantage ?? null,
      traction: p.traction ?? null,
      missing_information: Array.isArray(p.missing_information) ? p.missing_information : [],
      is_published: data.publish,
    };
    if (typeof p.company_name === "string" && p.company_name.trim()) {
      update.name = p.company_name.trim();
    }
    if (typeof p.tagline === "string") update.tagline = p.tagline;
    if (typeof p.description === "string") update.description = p.description;

    // When publishing, mark this startup as the user's primary and clear any other primary
    if (data.publish) {
      const { error: clearErr } = await supabase
        .from("startups")
        .update({ is_primary: false } as never)
        .eq("owner_id", userId)
        .neq("id", data.startupId);
      if (clearErr) throw clearErr;
      update.is_primary = true;
      // Mirror to per-user primary pointer on profile
      await supabase
        .from("profiles")
        .update({ featured_startup_id: data.startupId } as never)
        .eq("id", userId);
    }


    const { error: uErr } = await supabase
      .from("startups")
      .update(update as never)
      .eq("id", data.startupId);
    if (uErr) throw uErr;

    let newBadges: string[] = [];
    if (data.publish) {
      try {
        const { awardStartupCreatedRewards } = await import("@/design-system/ventura-6bef42/lib/xp-awarder.server");
        const res = await awardStartupCreatedRewards({
          startupId: data.startupId,
          userId,
        });
        newBadges = res.newBadges;
      } catch (e) {
        console.error("awardStartupCreatedRewards failed", e);
      }
    }

    return { ok: true, startupId: data.startupId, newBadges };
  });

// ----- set primary -----

export const setPrimaryStartup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Allow both owners and team members (getOwnedStartupId already handles both)
    await getOwnedStartupId(supabase, data.id, userId);

    // Verify the startup is published — use admin client because members may
    // not be able to SELECT the startup row directly via RLS.
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: row, error: rErr } = await supabaseAdmin
      .from("startups")
      .select("is_published, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw rErr;
    const r = row as { is_published: boolean; owner_id: string } | null;
    if (!r || !r.is_published) {
      throw new Error("Only published startups can be set as primary.");
    }

    // Store the user-level primary pointer on the profile (works for any role).
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ featured_startup_id: data.id } as never)
      .eq("id", userId);
    if (profErr) throw profErr;

    // Keep the legacy owner-side is_primary flag in sync when the user owns it.
    if (r.owner_id === userId) {
      const { error: clearErr } = await supabase
        .from("startups")
        .update({ is_primary: false } as never)
        .eq("owner_id", userId)
        .neq("id", data.id);
      if (clearErr) throw clearErr;
      const { error: setErr } = await supabase
        .from("startups")
        .update({ is_primary: true } as never)
        .eq("id", data.id);
      if (setErr) throw setErr;
    }

    return { ok: true };
  });



// ----- delete -----

export const deleteStartup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await getOwnedStartupId(supabase, data.id, userId);
    const { error } = await supabase.from("startups").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ----- pause / resume (owner only) -----

export const setStartupPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ownerRow, error: ownerErr } = await (supabase.from("startups") as unknown as {
      select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }> } } };
    }).select("id").eq("id", data.id).eq("owner_id", userId).maybeSingle();
    if (ownerErr) throw ownerErr as Error;
    if (!ownerRow) throw new Error("Only the startup owner can pause or resume this startup.");
    const { error } = await supabase
      .from("startups")
      .update({ is_paused: data.paused, paused_at: data.paused ? new Date().toISOString() : null } as never)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, paused: data.paused };
  });
