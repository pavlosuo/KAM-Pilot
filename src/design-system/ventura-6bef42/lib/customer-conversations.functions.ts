import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { TRACKED_QUESTION_OPTIONS } from "@/design-system/ventura-6bef42/lib/tracked-questions";
import { isTestingModeEmail } from "@/design-system/ventura-6bef42/lib/testing-mode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const MAX_SLOTS = 3;
type Slot = 1 | 2 | 3;

async function getWeekOf(
  supabase: SB,
  startupId: string,
  userId?: string,
  email?: string | null,
): Promise<string> {
  const { data } = await supabase
    .from("startups")
    .select("published_at")
    .eq("id", startupId)
    .maybeSingle();
  const publishedAt = (data as { published_at: string | null } | null)?.published_at;
  const ws = computeCurrentWeekStart(publishedAt);
  let base: string;
  if (ws) {
    base = ws;
  } else {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
    base = mon.toISOString().slice(0, 10);
  }
  if (!userId || !isTestingModeEmail(email)) return base;

  const { data: rows } = await supabase
    .from("weekly_updates")
    .select("week_of")
    .eq("startup_id", startupId)
    .eq("author_id", userId)
    .eq("is_published", true);
  const taken = new Set<string>(
    ((rows as { week_of: string }[] | null) ?? []).map((r) => r.week_of),
  );
  let candidate = base;
  let guard = 0;
  while (taken.has(candidate) && guard < 520) {
    const nd = new Date(candidate + "T00:00:00Z");
    nd.setUTCDate(nd.getUTCDate() + 7);
    candidate = nd.toISOString().slice(0, 10);
    guard += 1;
  }
  return candidate;
}

async function listTrackedQuestions(
  supabase: SB,
  startupId: string,
): Promise<Array<{ slot: Slot; question: string }>> {
  const { data } = await supabase
    .from("startup_tracked_questions")
    .select("slot, question")
    .eq("startup_id", startupId)
    .order("slot", { ascending: true });
  return ((data as { slot: number; question: string }[] | null) ?? []).map((r) => ({
    slot: r.slot as Slot,
    question: r.question,
  }));
}

async function assertTeam(supabase: SB, startupId: string, userId: string) {
  const [{ data: ownerRow }, { data: memberRow }] = await Promise.all([
    supabase.from("startups").select("owner_id").eq("id", startupId).maybeSingle(),
    supabase
      .from("startup_members")
      .select("id")
      .eq("startup_id", startupId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const ownerId = (ownerRow as { owner_id: string } | null)?.owner_id ?? null;
  return { isOwner: ownerId === userId, isTeam: ownerId === userId || !!memberRow };
}

const questionSchema = z.string().trim().min(1).max(300);

// Weekly dialog data: current-week entries per tracked slot for the caller.
export const getThisWeekCustomerConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string | null } | null)?.email ?? null;
    const week_of = await getWeekOf(supabase, data.startupId, userId, email);
    const tracked = await listTrackedQuestions(supabase, data.startupId);

    const { data: rows } = await supabase
      .from("weekly_customer_conversations")
      .select("slot, customers_talked_to")
      .eq("startup_id", data.startupId)
      .eq("founder_id", userId)
      .eq("week_of", week_of);
    const countBySlot = new Map<number, number>();
    for (const r of (rows as { slot: number; customers_talked_to: number }[] | null) ?? []) {
      countBySlot.set(r.slot, r.customers_talked_to);
    }

    // Teammates' numbers for the same week, so a co-founder continuing the
    // weekly update sees what was already reported.
    const { data: teamRows } = await supabase
      .from("weekly_customer_conversations")
      .select("slot, customers_talked_to, founder_id, updated_at")
      .eq("startup_id", data.startupId)
      .eq("week_of", week_of)
      .neq("founder_id", userId)
      .order("updated_at", { ascending: false });
    const teamBySlot = new Map<number, { count: number; founderId: string }>();
    for (const r of (teamRows as
      | { slot: number; customers_talked_to: number; founder_id: string }[]
      | null) ?? []) {
      if (!teamBySlot.has(r.slot)) {
        teamBySlot.set(r.slot, { count: r.customers_talked_to, founderId: r.founder_id });
      }
    }
    let teammateName: string | null = null;
    const teammateIds = Array.from(new Set([...teamBySlot.values()].map((v) => v.founderId)));
    if (teammateIds.length > 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", teammateIds[0])
        .maybeSingle();
      teammateName = (prof as { full_name: string | null } | null)?.full_name ?? null;
    }

    const slots = tracked.map((t) => ({
      slot: t.slot,
      question: t.question,
      count: countBySlot.has(t.slot) ? (countBySlot.get(t.slot) as number) : null,
      teammateCount: teamBySlot.get(t.slot)?.count ?? null,
    }));
    const hasTeammateNumbers = teamBySlot.size > 0;


    const allFilled =
      slots.length > 0 && slots.every((s) => typeof s.count === "number");

    return {
      weekOf: week_of,
      slots,
      needsBootstrap: tracked.length === 0,
      options: TRACKED_QUESTION_OPTIONS,
      exists: allFilled,
      maxSlots: MAX_SLOTS,
      hasTeammateNumbers,
      teammateName,
    };
  });

// Save/update the caller's current-week count for one or more locked slots.
// If no slots exist yet, `bootstrapQuestion` creates slot 1 for the startup.
export const saveThisWeekCustomerConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        entries: z
          .array(
            z.object({
              slot: z.number().int().min(1).max(MAX_SLOTS),
              count: z.number().int().min(0),
            }),
          )
          .min(1),
        bootstrapQuestion: questionSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string | null } | null)?.email ?? null;
    const { isTeam } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam) throw new Error("Not authorized");
    const week_of = await getWeekOf(supabase, data.startupId, userId, email);

    let tracked = await listTrackedQuestions(supabase, data.startupId);
    if (tracked.length === 0) {
      if (!data.bootstrapQuestion) {
        throw new Error("Pick a question to track first");
      }
      const { error: insErr } = await supabase
        .from("startup_tracked_questions")
        .insert({ startup_id: data.startupId, slot: 1, question: data.bootstrapQuestion });
      if (insErr) throw insErr;
      tracked = [{ slot: 1, question: data.bootstrapQuestion }];
    }

    const validSlots = new Set(tracked.map((t) => t.slot));
    const questionBySlot = new Map(tracked.map((t) => [t.slot, t.question]));

    const upserts = data.entries
      .filter((e) => validSlots.has(e.slot as Slot))
      .map((e) => ({
        startup_id: data.startupId,
        founder_id: userId,
        week_of,
        slot: e.slot,
        customers_talked_to: e.count,
        question: questionBySlot.get(e.slot as Slot) ?? null,
      }));

    if (upserts.length === 0) throw new Error("No matching tracked slots");

    const { error } = await supabase
      .from("weekly_customer_conversations")
      .upsert(upserts, { onConflict: "startup_id,week_of,founder_id,slot" });
    if (error) throw error;

    // Award metric-answer XP (deduped per startup/week/user/slot)
    try {
      const { awardMetricAnswerXp } = await import("@/design-system/ventura-6bef42/lib/xp-awarder.server");
      for (const e of data.entries) {
        if (validSlots.has(e.slot as Slot)) {
          await awardMetricAnswerXp({
            startupId: data.startupId,
            userId,
            weekOf: week_of,
            slot: e.slot,
          });
        }
      }
    } catch (err) {
      console.error("awardMetricAnswerXp failed", err);
    }

    return { ok: true };
  });

// Registry: list all tracked questions for the startup with entry counts.
export const listStartupTrackedQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam) throw new Error("Not authorized");
    const tracked = await listTrackedQuestions(supabase, data.startupId);

    const [{ data: rows }, { data: hiddenRows }] = await Promise.all([
      supabase
        .from("weekly_customer_conversations")
        .select("slot")
        .eq("startup_id", data.startupId),
      supabase
        .from("startup_tracked_questions")
        .select("slot, is_hidden")
        .eq("startup_id", data.startupId),
    ]);
    const counts = new Map<number, number>();
    for (const r of (rows as { slot: number }[] | null) ?? []) {
      counts.set(r.slot, (counts.get(r.slot) ?? 0) + 1);
    }
    const hiddenBySlot = new Map<number, boolean>();
    for (const r of ((hiddenRows as { slot: number; is_hidden: boolean }[] | null) ?? [])) {
      hiddenBySlot.set(r.slot, r.is_hidden);
    }
    return {
      slots: tracked.map((t) => ({
        slot: t.slot,
        question: t.question,
        entriesCount: counts.get(t.slot) ?? 0,
        isHidden: hiddenBySlot.get(t.slot) ?? false,
      })),
      maxSlots: MAX_SLOTS,
      options: TRACKED_QUESTION_OPTIONS,
    };
  });

// Hide/show a tracked question's graph on the full weekly update.
// Recorded numbers are never touched, so the graph can be resumed later.
export const setTrackedQuestionHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        slot: z.number().int().min(1).max(MAX_SLOTS),
        hidden: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam) throw new Error("Not authorized");
    const { error } = await supabase
      .from("startup_tracked_questions")
      .update({ is_hidden: data.hidden })
      .eq("startup_id", data.startupId)
      .eq("slot", data.slot);
    if (error) throw error;
    return { ok: true, hidden: data.hidden };
  });


// Add a new tracked question in the next free slot (up to 3).
export const addTrackedQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ startupId: z.string().uuid(), question: questionSchema })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam) throw new Error("Not authorized");
    const tracked = await listTrackedQuestions(supabase, data.startupId);
    if (tracked.length >= MAX_SLOTS) {
      throw new Error("You can track up to 3 questions. Remove one first.");
    }
    const used = new Set(tracked.map((t) => t.slot));
    let slot: Slot = 1;
    for (let i = 1 as Slot; i <= MAX_SLOTS; i = (i + 1) as Slot) {
      if (!used.has(i)) {
        slot = i;
        break;
      }
    }
    const { error } = await supabase
      .from("startup_tracked_questions")
      .insert({ startup_id: data.startupId, slot, question: data.question });
    if (error) throw error;
    return { ok: true, slot };
  });

// Reset one slot (default: all slots) — deletes registry row(s) and all
// recorded weekly numbers for the affected slot(s).
export const resetStartupTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        slot: z.number().int().min(1).max(MAX_SLOTS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam) throw new Error("Not authorized");

    if (data.slot) {
      await supabase
        .from("weekly_customer_conversations")
        .delete()
        .eq("startup_id", data.startupId)
        .eq("slot", data.slot);
      const { error } = await supabase
        .from("startup_tracked_questions")
        .delete()
        .eq("startup_id", data.startupId)
        .eq("slot", data.slot);
      if (error) throw error;
    } else {
      await supabase
        .from("weekly_customer_conversations")
        .delete()
        .eq("startup_id", data.startupId);
      const { error } = await supabase
        .from("startup_tracked_questions")
        .delete()
        .eq("startup_id", data.startupId);
      if (error) throw error;
    }
    return { ok: true };
  });
