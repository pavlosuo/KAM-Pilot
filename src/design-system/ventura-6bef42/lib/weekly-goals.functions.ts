import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { isTestingModeEmail } from "@/design-system/ventura-6bef42/lib/testing-mode";



// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface WeeklyGoal {
  id: string;
  startup_id: string;
  week_of: string;
  author_id: string;
  title: string;
  order_index: number;
  status: "pending" | "done" | "carried_over" | "dropped";
  drop_reason: string | null;
  carried_from_goal_id: string | null;
  program_kpi_id?: string | null;
  source_label?: string | null;
  xp_awarded: number;
  created_at: string;
  updated_at: string;
}

/**
 * Materialize program challenges assigned to this startup as weekly goals for
 * the current week, so founders review them in the normal goals flow.
 * Uses the admin client: program tables are not readable by founders via RLS.
 */
async function syncProgramChallengeGoals(
  startupId: string,
  userId: string,
  weekOf: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

  const { data: assignments } = await supabaseAdmin
    .from("program_kpi_assignments")
    .select("kpi_id, completed_at, program_id")
    .eq("startup_id", startupId)
    .is("completed_at", null);
  const rows = (assignments ?? []) as Array<{ kpi_id: string; program_id: string }>;
  if (rows.length === 0) return;

  const [{ data: kpis }, { data: programs }] = await Promise.all([
    supabaseAdmin
      .from("program_kpis")
      .select("id, title, due_date, target_value, unit")
      .in("id", rows.map((r) => r.kpi_id)),
    supabaseAdmin
      .from("programs")
      .select("id, name")
      .in("id", Array.from(new Set(rows.map((r) => r.program_id)))),
  ]);
  const kpiById = new Map(
    ((kpis ?? []) as Array<{
      id: string;
      title: string;
      due_date: string | null;
      target_value: number | null;
      unit: string | null;
    }>).map((k) => [k.id, k]),
  );
  const programName = new Map(
    ((programs ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]),
  );

  const { data: existing } = await supabaseAdmin
    .from("startup_weekly_goals")
    .select("program_kpi_id")
    .eq("startup_id", startupId)
    .eq("week_of", weekOf)
    .not("program_kpi_id", "is", null);
  const have = new Set(
    ((existing ?? []) as Array<{ program_kpi_id: string | null }>).map((r) => r.program_kpi_id),
  );

  const toInsert = rows
    .filter((r) => !have.has(r.kpi_id) && kpiById.has(r.kpi_id))
    .map((r, i) => {
      const kpi = kpiById.get(r.kpi_id)!;
      const target =
        kpi.target_value != null && Number(kpi.target_value) > 0
          ? ` (${kpi.target_value}${kpi.unit ? ` ${kpi.unit}` : ""})`
          : "";
      return {
        startup_id: startupId,
        week_of: weekOf,
        author_id: userId,
        title: `${kpi.title}${target}`.slice(0, 120),
        order_index: 90 + i,
        status: "pending",
        program_kpi_id: r.kpi_id,
        source_label: `${programName.get(r.program_id) ?? "Program"} Challenge`,
      };
    });

  if (toInsert.length > 0) {
    await supabaseAdmin.from("startup_weekly_goals").insert(toInsert as never);
  }
}


async function assertTeam(supabase: SupabaseClient, startupId: string, userId: string) {
  const { data: startup } = await supabase
    .from("startups")
    .select("id, owner_id, published_at")
    .eq("id", startupId)
    .maybeSingle();
  if (!startup) throw new Error("Startup not found");
  const isOwner = (startup as { owner_id: string }).owner_id === userId;
  if (!isOwner) {
    const { data: m } = await supabase
      .from("startup_members")
      .select("id")
      .eq("startup_id", startupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!m) throw new Error("Forbidden");
  }
  return startup as { id: string; owner_id: string; published_at: string | null };
}

async function currentWeekOf(
  supabase: SupabaseClient,
  startupId: string,
  userId: string,
  email: string | null | undefined,
): Promise<string | null> {
  const { data } = await supabase
    .from("startups")
    .select("published_at")
    .eq("id", startupId)
    .maybeSingle();
  const publishedAt = (data as { published_at: string | null } | null)?.published_at ?? null;
  const base = computeCurrentWeekStart(publishedAt);
  if (!base) return null;
  if (!isTestingModeEmail(email)) return base;
  // Testing mode: walk forward past any already-published buckets so goals
  // for the current real week become "last week" once the tester has moved on.
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
    const d = new Date(candidate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    candidate = d.toISOString().slice(0, 10);
    guard += 1;
  }
  return candidate;
}



// Read state: last week (pending review) + this week's goals + xp + badges.
export const getWeeklyGoalsState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeam(supabase, data.startupId, userId);
    const thisWeek = await currentWeekOf(supabase, data.startupId, userId, (context.claims as { email?: string | null }).email ?? null);

    if (thisWeek) {
      try {
        await syncProgramChallengeGoals(data.startupId, userId, thisWeek);
      } catch {
        // Challenges are additive; never block the goals step on them.
      }
    }

    const { data: all } = await supabase
      .from("startup_weekly_goals")
      .select("*")
      .eq("startup_id", data.startupId)
      .order("week_of", { ascending: false })
      .order("order_index", { ascending: true });

    const rows = (all as WeeklyGoal[] | null) ?? [];
    const thisWeekGoals = thisWeek ? rows.filter((r) => r.week_of === thisWeek) : [];
    const challengeThisWeekGoals = thisWeekGoals.filter((r) => !!r.program_kpi_id);
    const myThisWeekGoals = thisWeekGoals.filter(
      (r) => r.author_id === userId && !r.program_kpi_id,
    );
    const teammateRows = thisWeekGoals.filter(
      (r) => r.author_id !== userId && !r.program_kpi_id,
    );


    // Names for teammate-authored goals so the setter step can attribute them.
    const teammateIds = Array.from(new Set(teammateRows.map((r) => r.author_id)));
    const nameById = new Map<string, string>();
    if (teammateIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teammateIds);
      for (const p of ((profs as { id: string; full_name: string | null }[] | null) ?? [])) {
        if (p.full_name) nameById.set(p.id, p.full_name);
      }
    }
    const teammateThisWeekGoals = teammateRows.map((r) => ({
      ...r,
      author_name: nameById.get(r.author_id) ?? "Teammate",
    }));

    // "Last week" = most recent week bucket different from thisWeek that still
    // has pending goals to review. In testing mode the effective "current" bucket
    // can shift in either direction, so we look at ANY bucket != thisWeek rather
    // than strictly earlier ones.
    const otherRows = rows.filter((r) => (thisWeek ? r.week_of !== thisWeek : true));
    let lastWeek: string | null = null;
    for (const r of otherRows) {
      if (r.status === "pending") {
        lastWeek = r.week_of;
        break;
      }
    }
    if (!lastWeek && otherRows.length > 0) lastWeek = otherRows[0].week_of;
    const lastWeekGoals = lastWeek ? otherRows.filter((r) => r.week_of === lastWeek) : [];
    const needsReview = lastWeekGoals.some((g) => g.status === "pending");


    const { data: doneRow } = await supabase
      .from("weekly_step_completions")
      .select("id")
      .eq("startup_id", data.startupId)
      .eq("user_id", userId)
      .eq("week_of", thisWeek ?? "1970-01-01")
      .eq("step", "goals")
      .maybeSingle();
    const goalsCompleted = !!doneRow;

    const { data: xpRows } = await supabase
      .from("startup_xp_events")
      .select("xp")
      .eq("startup_id", data.startupId);
    const totalXp = ((xpRows as { xp: number }[] | null) ?? []).reduce((s, r) => s + (r.xp ?? 0), 0);

    const { data: badgeRows } = await supabase
      .from("startup_badges")
      .select("code, earned_at")
      .eq("startup_id", data.startupId)
      .order("earned_at", { ascending: false });

    const { data: pinRow } = await supabase
      .from("startups")
      .select("pinned_badge_code")
      .eq("id", data.startupId)
      .maybeSingle();

    return {
      thisWeek,
      thisWeekGoals,
      myThisWeekGoals,
      teammateThisWeekGoals,
      challengeThisWeekGoals,

      lastWeek,
      lastWeekGoals,
      needsReview,
      goalsCompleted,
      totalXp,
      badges: (badgeRows as { code: string; earned_at: string }[] | null) ?? [],
      pinnedBadgeCode:
        (pinRow as { pinned_badge_code: string | null } | null)?.pinned_badge_code ?? null,
    };
  });

// Review last week's goals: mark each done / carried_over / dropped.
export const reviewLastWeekGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        decisions: z
          .array(
            z.object({
              goalId: z.string().uuid(),
              status: z.enum(["done", "carried_over", "dropped"]),
              dropReason: z.string().max(200).optional().nullable(),
            }),
          )
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeam(supabase, data.startupId, userId);
    const thisWeek = await currentWeekOf(supabase, data.startupId, userId, (context.claims as { email?: string | null }).email ?? null);
    if (!thisWeek) throw new Error("Publish your startup first");

    const carriedInsertRows: Array<Record<string, unknown>> = [];
    let carryIndex = 0;

    for (const dec of data.decisions) {
      const patch: Record<string, unknown> = {
        status: dec.status,
        drop_reason: dec.status === "dropped" ? (dec.dropReason ?? null) : null,
      };
      const { error } = await supabase
        .from("startup_weekly_goals")
        .update(patch as never)
        .eq("id", dec.goalId)
        .eq("startup_id", data.startupId);
      if (error) throw error;

      const { data: orig } = await supabase
        .from("startup_weekly_goals")
        .select("title, program_kpi_id")
        .eq("id", dec.goalId)
        .maybeSingle();
      const origRow = orig as { title: string; program_kpi_id: string | null } | null;

      // Completing a program challenge closes its assignment for this startup.
      if (dec.status === "done" && origRow?.program_kpi_id) {
        try {
          const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
          await supabaseAdmin
            .from("program_kpi_assignments")
            .update({ completed_at: new Date().toISOString() } as never)
            .eq("startup_id", data.startupId)
            .eq("kpi_id", origRow.program_kpi_id)
            .is("completed_at", null);
        } catch {
          // Non-fatal: the goal review still stands.
        }
      }

      // Challenges re-materialize each week from the program, so no manual copy.
      if (dec.status === "carried_over" && !origRow?.program_kpi_id) {
        const title = origRow?.title;
        if (title) {
          carriedInsertRows.push({
            startup_id: data.startupId,
            week_of: thisWeek,
            author_id: userId,
            title,
            order_index: carryIndex++,
            status: "pending",
            carried_from_goal_id: dec.goalId,
          });
        }
      }
    }


    if (carriedInsertRows.length > 0) {
      // Avoid duplicate carry rows: skip any already carried into thisWeek.
      const { data: existing } = await supabase
        .from("startup_weekly_goals")
        .select("carried_from_goal_id")
        .eq("startup_id", data.startupId)
        .eq("week_of", thisWeek);
      const existingCarry = new Set(
        ((existing as { carried_from_goal_id: string | null }[] | null) ?? [])
          .map((r) => r.carried_from_goal_id)
          .filter((v): v is string => !!v),
      );
      const toInsert = carriedInsertRows.filter(
        (r) => !existingCarry.has(r.carried_from_goal_id as string),
      );
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from("startup_weekly_goals")
          .insert(toInsert as never);
        if (error) throw error;
      }
    }

    // Award XP + badges immediately after the review (idempotent per reviewed week).
    // Previously this ran only at publish time, so reviewing goals without
    // immediately publishing a full weekly update left XP and badges unawarded.
    let awardedXp = 0;
    const awardedBadges: string[] = [];
    if (data.decisions.length > 0) {
      const firstGoalId = data.decisions[0].goalId;
      const { data: firstRow } = await supabase
        .from("startup_weekly_goals")
        .select("week_of")
        .eq("id", firstGoalId)
        .maybeSingle();
      const reviewedWeek = (firstRow as { week_of: string } | null)?.week_of ?? null;
      if (reviewedWeek) {
        const res = await awardXpForReviewedWeek(supabase, data.startupId, userId, reviewedWeek);
        awardedXp = res.xpAwarded;
        awardedBadges.push(...res.newBadges);
      }
    }

    return { ok: true, xpAwarded: awardedXp, newBadges: awardedBadges };
  });

async function awardXpForReviewedWeek(
  supabase: SupabaseClient,
  startupId: string,
  userId: string,
  reviewedWeek: string,
): Promise<{ xpAwarded: number; newBadges: string[] }> {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const dedupeBase = `finalize:${startupId}:${reviewedWeek}`;
  const { data: prior } = await supabaseAdmin
    .from("startup_xp_events")
    .select("id")
    .eq("dedupe_key", dedupeBase)
    .maybeSingle();
  if (prior) return { xpAwarded: 0, newBadges: [] };

  const { data: weekRows } = await supabase
    .from("startup_weekly_goals")
    .select("id, status, carried_from_goal_id")
    .eq("startup_id", startupId)
    .eq("week_of", reviewedWeek)
    .in("status", ["done", "dropped", "carried_over"]);
  const weekGoals = (weekRows as
    | { id: string; status: string; carried_from_goal_id: string | null }[]
    | null) ?? [];
  if (weekGoals.length === 0) return { xpAwarded: 0, newBadges: [] };

  const done = weekGoals.filter((g) => g.status === "done");
  const total = weekGoals.length;
  const doneCount = done.length;
  let xp = doneCount * 15;
  const perfect = total >= 3 && doneCount === total;
  if (perfect) xp += 40;
  const redeemed = done.filter((g) => g.carried_from_goal_id).length;
  xp += redeemed * 10;

  await supabaseAdmin.from("startup_xp_events").insert({
    startup_id: startupId,
    user_id: userId,
    week_of: reviewedWeek,
    kind: "weekly_review",
    xp,
    meta: { doneCount, total, redeemed, perfect },
    dedupe_key: dedupeBase,
  } as never);

  const newBadges: string[] = [];
  const grant = async (code: string) => {
    const { data: existing } = await supabaseAdmin
      .from("startup_badges")
      .select("id")
      .eq("startup_id", startupId)
      .eq("code", code)
      .maybeSingle();
    if (existing) return;
    const { error } = await supabaseAdmin
      .from("startup_badges")
      .insert({ startup_id: startupId, code } as never);
    if (!error) newBadges.push(code);
  };

  if (doneCount > 0) await grant("first_goal");
  if (total === 5 && doneCount === 5) await grant("first_five");
  if (perfect) await grant("perfect_week");

  const { data: xpAll } = await supabaseAdmin
    .from("startup_xp_events")
    .select("meta")
    .eq("startup_id", startupId)
    .eq("kind", "weekly_review");
  const perfectWeeks = ((xpAll as { meta: { perfect?: boolean } }[] | null) ?? []).filter(
    (r) => r.meta?.perfect,
  ).length;
  if (perfectWeeks >= 3) await grant("three_perfect");

  const { count: lifetimeDone } = await supabaseAdmin
    .from("startup_weekly_goals")
    .select("id", { count: "exact", head: true })
    .eq("startup_id", startupId)
    .eq("status", "done");
  if ((lifetimeDone ?? 0) >= 10) await grant("ten_done");
  if ((lifetimeDone ?? 0) >= 50) await grant("fifty_done");
  if ((lifetimeDone ?? 0) >= 100) await grant("hundred_done");

  const { count: carryDone } = await supabaseAdmin
    .from("startup_weekly_goals")
    .select("id", { count: "exact", head: true })
    .eq("startup_id", startupId)
    .eq("status", "done")
    .not("carried_from_goal_id", "is", null);
  if ((carryDone ?? 0) >= 5) await grant("carryover_hero");

  return { xpAwarded: xp, newBadges };
}


// Replace this-week's goal list (upsert set).
export const setThisWeekGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        goals: z
          .array(
            z.object({
              id: z.string().uuid().optional().nullable(),
              title: z.string().min(1).max(120),
              orderIndex: z.number().int().min(0).max(4),
              carriedFromGoalId: z.string().uuid().optional().nullable(),
            }),
          )
          .max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeam(supabase, data.startupId, userId);
    const thisWeek = await currentWeekOf(supabase, data.startupId, userId, (context.claims as { email?: string | null }).email ?? null);
    if (!thisWeek) throw new Error("Publish your startup first");

    const { data: existing } = await supabase
      .from("startup_weekly_goals")
      .select("id")
      .eq("startup_id", data.startupId)
      .eq("week_of", thisWeek)
      // Only the caller's own goals are managed here; teammates' goals stay put.
      .eq("author_id", userId)
      // Program challenges are managed by the program, not the founder.
      .is("program_kpi_id", null);

    const keepIds = new Set(data.goals.map((g) => g.id).filter((v): v is string => !!v));
    const toDelete = ((existing as { id: string }[] | null) ?? [])
      .map((r) => r.id)
      .filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("startup_weekly_goals").delete().in("id", toDelete);
    }

    for (const g of data.goals) {
      if (g.id) {
        await supabase
          .from("startup_weekly_goals")
          .update({ title: g.title, order_index: g.orderIndex } as never)
          .eq("id", g.id);
      } else {
        await supabase.from("startup_weekly_goals").insert({
          startup_id: data.startupId,
          week_of: thisWeek,
          author_id: userId,
          title: g.title,
          order_index: g.orderIndex,
          carried_from_goal_id: g.carriedFromGoalId ?? null,
          status: "pending",
        } as never);
      }
    }

    // Persist step completion so the goals step is not shown again this week,
    // even when the caller intentionally saved zero goals.
    await supabase.from("weekly_step_completions").upsert(
      {
        startup_id: data.startupId,
        user_id: userId,
        week_of: thisWeek,
        step: "goals",
      } as never,
      { onConflict: "startup_id,user_id,week_of,step" },
    );

    return { ok: true };
  });

// Award XP + badges. Called at publish time; idempotent per (startup, week).
export const finalizeWeeklyGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ startupId: z.string().uuid(), weekOf: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertTeam(supabase, data.startupId, userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const dedupeBase = `finalize:${data.startupId}:${data.weekOf}`;
    // Idempotency: skip if already finalized.
    const { data: prior } = await supabaseAdmin
      .from("startup_xp_events")
      .select("id")
      .eq("dedupe_key", dedupeBase)
      .maybeSingle();
    if (prior) return { xpAwarded: 0, newBadges: [] as string[] };

    // Pull the week's goals we just reviewed. We reward based on last review-completed week
    // relative to this weekOf (i.e. the week that was just reviewed when this publish happened).
    // For simplicity we pick the most recent week strictly before weekOf that has any reviewed rows.
    const { data: recentRows } = await supabase
      .from("startup_weekly_goals")
      .select("id, week_of, status, carried_from_goal_id")
      .eq("startup_id", data.startupId)
      .lt("week_of", data.weekOf)
      .in("status", ["done", "dropped", "carried_over"])
      .order("week_of", { ascending: false })
      .limit(50);
    const rows = (recentRows as
      | { id: string; week_of: string; status: string; carried_from_goal_id: string | null }[]
      | null) ?? [];
    if (rows.length === 0) return { xpAwarded: 0, newBadges: [] as string[] };
    const reviewedWeek = rows[0].week_of;
    const weekGoals = rows.filter((r) => r.week_of === reviewedWeek);

    const done = weekGoals.filter((g) => g.status === "done");
    const total = weekGoals.length;
    const doneCount = done.length;

    let xp = doneCount * 15;
    if (total >= 3 && doneCount === total) xp += 40; // perfect week

    // Redemption bonus: any completed goal that was itself a carryover.
    const redeemed = done.filter((g) => g.carried_from_goal_id).length;
    xp += redeemed * 10;

    // Insert XP ledger entry (single line with breakdown in meta).
    await supabaseAdmin.from("startup_xp_events").insert({
      startup_id: data.startupId,
      user_id: userId,
      week_of: reviewedWeek,
      kind: "weekly_review",
      xp,
      meta: { doneCount, total, redeemed, perfect: total >= 3 && doneCount === total },
      dedupe_key: dedupeBase,
    } as never);

    // Badges
    const newBadges: string[] = [];
    const grant = async (code: string) => {
      const { error } = await supabaseAdmin
        .from("startup_badges")
        .insert({ startup_id: data.startupId, code } as never);
      if (!error) newBadges.push(code);
    };

    // first_goal
    if (doneCount > 0) {
      const { data: b } = await supabaseAdmin
        .from("startup_badges")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("code", "first_goal")
        .maybeSingle();
      if (!b) await grant("first_goal");
    }
    if (total === 5 && doneCount === 5) await grant("first_five");
    if (total >= 3 && doneCount === total) await grant("perfect_week");

    // three_perfect: count total perfect weeks (from xp events meta)
    const { data: xpAll } = await supabaseAdmin
      .from("startup_xp_events")
      .select("meta")
      .eq("startup_id", data.startupId)
      .eq("kind", "weekly_review");
    const perfectWeeks = ((xpAll as { meta: { perfect?: boolean } }[] | null) ?? []).filter(
      (r) => r.meta?.perfect,
    ).length;
    if (perfectWeeks >= 3) await grant("three_perfect");

    // cumulative done counts (lifetime)
    const { count: lifetimeDone } = await supabaseAdmin
      .from("startup_weekly_goals")
      .select("id", { count: "exact", head: true })
      .eq("startup_id", data.startupId)
      .eq("status", "done");
    if ((lifetimeDone ?? 0) >= 10) await grant("ten_done");
    if ((lifetimeDone ?? 0) >= 50) await grant("fifty_done");
    if ((lifetimeDone ?? 0) >= 100) await grant("hundred_done");

    // carryover_hero: 5 completed carryover goals lifetime
    const { count: carryDone } = await supabaseAdmin
      .from("startup_weekly_goals")
      .select("id", { count: "exact", head: true })
      .eq("startup_id", data.startupId)
      .eq("status", "done")
      .not("carried_from_goal_id", "is", null);
    if ((carryDone ?? 0) >= 5) await grant("carryover_hero");

    return { xpAwarded: xp, newBadges };
  });

// Public aggregate stats — anon-safe via SECURITY DEFINER RPC.
export const getPublicGoalStats = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: stats, error } = await supabaseAdmin.rpc(
      "get_startup_public_goal_stats",
      { _startup_id: data.startupId },
    );
    if (error) throw error;
    return stats as {
      last_week: string | null;
      last_week_done: number;
      last_week_total: number;
      total_xp: number;
      badges: { code: string; earned_at: string }[];
      goal_streak: number;
    };
  });
