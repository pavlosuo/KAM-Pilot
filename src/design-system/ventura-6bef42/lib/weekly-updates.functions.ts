import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekBounds } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { isTestingModeEmail } from "@/design-system/ventura-6bef42/lib/testing-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

async function assertOwnership(
  supabase: SupabaseClient,
  updateId: string,
  userId: string,
): Promise<{ startup_id: string; author_id: string }> {
  const { data, error } = await supabase
    .from("weekly_updates")
    .select("startup_id, author_id")
    .eq("id", updateId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Update not found");
  if (data.author_id !== userId) throw new Error("Forbidden");
  return data;
}

async function getCurrentWeekStart(
  supabase: SupabaseClient,
  startupId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("startups")
    .select("published_at")
    .eq("id", startupId)
    .maybeSingle();
  if (error) throw error;
  const publishedAt = (data as { published_at: string | null } | null)?.published_at;
  return computeCurrentWeekBounds(publishedAt)?.weekStart ?? null;
}

// Stale drafts from previous weeks are intentionally retained so founders can
// review them in Update History. They simply stop appearing in the live
// recorder (which only loads the current week's draft).
async function cleanupStaleDrafts(_supabase: SupabaseClient, _startupId: string) {
  return;
}


export const getCurrentWeekState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: startupRow } = await supabase
      .from("startups")
      .select("published_at")
      .eq("id", data.startupId)
      .maybeSingle();
    const publishedAt = (startupRow as { published_at: string | null } | null)?.published_at;
    const bounds = computeCurrentWeekBounds(publishedAt);
    if (!bounds) {
      return { weekStart: null, weekEnd: null, draft: null };
    }
    await cleanupStaleDrafts(supabase, data.startupId);
    const { weekStart, weekEnd } = bounds;
    const { data: row, error } = await supabase
      .from("weekly_updates")
      .select("*")
      .eq("startup_id", data.startupId)
      .eq("author_id", userId)
      .eq("week_of", weekStart)
      .eq("status", "draft")
      .eq("is_published", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { weekStart, weekEnd, draft: row ?? null };
  });

const saveDraftInput = z.object({
  startupId: z.string().uuid(),
  transcript: z.string(),
});

export const saveWeeklyUpdateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveDraftInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const weekStart = await getCurrentWeekStart(supabase, data.startupId);
    if (!weekStart) throw new Error("Publish your startup before saving updates");
    await cleanupStaleDrafts(supabase, data.startupId);

    const { data: existing, error: fErr } = await supabase
      .from("weekly_updates")
      .select("id")
      .eq("startup_id", data.startupId)
      .eq("author_id", userId)
      .eq("week_of", weekStart)
      .eq("status", "draft")
      .eq("is_published", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fErr) throw fErr;

    if (existing) {
      const { error } = await supabase
        .from("weekly_updates")
        .update({ transcript: data.transcript } as never)
        .eq("id", (existing as { id: string }).id);
      if (error) throw error;
      return { id: (existing as { id: string }).id };
    }

    const { data: row, error } = await supabase
      .from("weekly_updates")
      .insert({
        startup_id: data.startupId,
        author_id: userId,
        transcript: data.transcript,
        status: "draft",
        is_published: false,
        week_of: weekStart,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const listWeeklyUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await cleanupStaleDrafts(supabase, data.startupId);
    const { data: rows, error } = await supabase
      .from("weekly_updates")
      .select("*")
      .eq("startup_id", data.startupId)
      .order("week_of", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { updates: rows ?? [] };
  });

export const getWeeklyUpdate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("weekly_updates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Update not found");
    return { update: row };
  });

const createInput = z.object({
  startupId: z.string().uuid(),
  transcript: z.string().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  recordingSeconds: z.number().int().nonnegative().optional(),
  weekOf: z.string().optional(),
});

export const createWeeklyUpdateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const weekOf = data.weekOf ?? (await getCurrentWeekStart(supabase, data.startupId));
    const insert: Record<string, unknown> = {
      startup_id: data.startupId,
      author_id: userId,
      transcript: data.transcript ?? null,
      title: data.title ?? null,
      recording_seconds: data.recordingSeconds ?? 0,
      status: "draft",
      is_published: false,
    };
    if (weekOf) insert.week_of = weekOf;
    const { data: row, error } = await supabase
      .from("weekly_updates")
      .insert(insert as never)
      .select("*")
      .single();
    if (error) throw error;
    return { update: row };
  });

const patchInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    title: z.string().max(200).nullable().optional(),
    summary: z.string().nullable().optional(),
    transcript: z.string().nullable().optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    week_of: z.string().optional(),
    recording_seconds: z.number().int().nonnegative().optional(),
  }),
});

export const updateWeeklyUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => patchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnership(supabase, data.id, userId);
    const { error } = await supabase
      .from("weekly_updates")
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const publishWeeklyUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertOwnership(supabase, data.id, userId);
    const email = (claims as { email?: string | null } | null)?.email ?? null;
    const testingMode = isTestingModeEmail(email);

    const { data: row } = await supabase
      .from("weekly_updates")
      .select("startup_id, week_of")
      .eq("id", data.id)
      .maybeSingle();
    let weekOf = (row as { week_of: string | null } | null)?.week_of ?? null;
    const startupId = (row as { startup_id: string } | null)?.startup_id ?? null;

    if (testingMode && startupId && weekOf) {
      // Find a free week bucket for this author on this startup by walking
      // backwards one week at a time. This lets the tester publish multiple
      // updates in the same real-world week without conflicting on the
      // unique (startup_id, week_of, author_id) constraint.
      const { data: existingRows } = await supabase
        .from("weekly_updates")
        .select("week_of")
        .eq("startup_id", startupId)
        .eq("author_id", userId)
        .eq("is_published", true)
        .neq("id", data.id);
      const taken = new Set<string>(
        ((existingRows as { week_of: string }[] | null) ?? []).map((r) => r.week_of),
      );
      let candidate = weekOf;
      let guard = 0;
      while (taken.has(candidate) && guard < 520) {
        const d = new Date(candidate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 7);
        candidate = d.toISOString().slice(0, 10);
        guard += 1;
      }
      if (candidate !== weekOf) {
        // Relocate this update and its customer-conversations row to the free
        // bucket so streak/graph tracking continues to work as separate weeks.
        await supabase
          .from("weekly_updates")
          .update({ week_of: candidate } as never)
          .eq("id", data.id);
        await supabase
          .from("weekly_customer_conversations")
          .update({ week_of: candidate } as never)
          .eq("startup_id", startupId)
          .eq("founder_id", userId)
          .eq("week_of", weekOf);
        weekOf = candidate;
      }
    } else if (startupId && weekOf) {
      const { data: existing } = await supabase
        .from("weekly_updates")
        .select("id")
        .eq("startup_id", startupId)
        .eq("author_id", userId)
        .eq("week_of", weekOf)
        .eq("is_published", true)
        .neq("id", data.id)
        .limit(1);
      if (existing && (existing as { id: string }[]).length > 0) {
        throw new Error("You have already published an update for this week.");
      }
    }

    const { error } = await supabase
      .from("weekly_updates")
      .update({
        status: "published",
        is_published: true,
        published_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw error;

    // XP + badges for text/team/streak
    let newBadges: string[] = [];
    try {
      const { data: full } = await supabase
        .from("weekly_updates")
        .select("summary, transcript")
        .eq("id", data.id)
        .maybeSingle();
      const { awardUpdatePublishRewards } = await import("@/design-system/ventura-6bef42/lib/xp-awarder.server");
      const res = await awardUpdatePublishRewards({
        startupId: startupId!,
        userId,
        updateId: data.id,
        weekOf: weekOf,
        summary: (full as { summary: string | null } | null)?.summary ?? null,
        transcript: (full as { transcript: string | null } | null)?.transcript ?? null,
      });
      newBadges = res?.newBadges ?? [];
    } catch (e) {
      console.error("awardUpdatePublishRewards failed", e);
    }

    return { ok: true, newBadges };

  });

export const unpublishWeeklyUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnership(supabase, data.id, userId);
    const { error } = await supabase
      .from("weekly_updates")
      .update({
        status: "draft",
        is_published: false,
        published_at: null,
      } as never)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteWeeklyUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnership(supabase, data.id, userId);
    const { error } = await supabase
      .from("weekly_updates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
