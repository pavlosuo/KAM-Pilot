import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

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
  const isTeam = ownerId === userId || !!memberRow;
  let isInvestor = false;
  if (!isTeam) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "investor")
      .maybeSingle();
    isInvestor = !!roleRow;
  }
  return { isTeam, isInvestor, ownerId };
}

function weekEndFrom(weekStart: string): string {
  return new Date(new Date(weekStart + "T00:00:00Z").getTime() + 6 * 86400000)
    .toISOString()
    .slice(0, 10);
}

// Returns the sorted (ascending) list of week_of values that have at least one
// published weekly update for this startup.
export const listPublishedUpdateWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam, isInvestor } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam && !isInvestor) return { weeks: [] as string[] };

    const { data: rows } = await supabase
      .from("weekly_updates")
      .select("week_of")
      .eq("startup_id", data.startupId)
      .eq("is_published", true)
      .order("week_of", { ascending: true });
    const set = new Set<string>();
    for (const r of (rows as { week_of: string }[] | null) ?? []) set.add(r.week_of);
    return { weeks: Array.from(set).sort() };
  });

// Returns the published updates (authors + their summaries) and the
// progression cards for a specific week.
export const getWeekUpdateView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ startupId: z.string().uuid(), weekOf: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam, isInvestor, ownerId } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam && !isInvestor)
      return {
        weekStart: null,
        weekEnd: null,
        authors: [],
        cards: [],
        goals: [] as Array<{
          id: string;
          title: string;
          status: string;
          authorName: string;
        }>,
      };

    const { data: updates } = await supabase
      .from("weekly_updates")
      .select("id, author_id, summary, transcript, published_at, created_at")
      .eq("startup_id", data.startupId)
      .eq("week_of", data.weekOf)
      .eq("is_published", true)
      .order("published_at", { ascending: true });

    const rows =
      (updates as Array<{
        id: string;
        author_id: string;
        summary: string | null;
        transcript: string | null;
        published_at: string | null;
        created_at: string;
      }> | null) ?? [];

    const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
    const profilesMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of (profiles as { id: string; full_name: string | null }[] | null) ?? []) {
        profilesMap.set(p.id, p.full_name ?? "Team member");
      }
    }

    const authors = rows.map((r) => ({
      updateId: r.id,
      authorId: r.author_id,
      authorName: profilesMap.get(r.author_id) ?? "Team member",
      isOwner: ownerId === r.author_id,
      summary: (r.summary && r.summary.trim()) || r.transcript || "",
    }));

    // Latest set of progression cards for this week (most recently published
    // update that has cards stored).
    const latestFirst = [...rows].reverse();
    let cards: Array<{
      id: string;
      label: string;
      value: string | null;
      icon_name: string | null;
      image_url: string | null;
      description: string | null;
    }> = [];
    for (const r of latestFirst) {
      const { data: cs } = await supabase
        .from("startup_progression_cards")
        .select("id, label, value, icon_name, image_url, description, display_order")
        .eq("weekly_update_id", r.id)
        .order("display_order", { ascending: true });
      const arr = (cs as typeof cards | null) ?? [];
      if (arr.length > 0) {
        cards = arr;
        break;
      }
    }

    // Goals set for this week (all team members), with their review status.
    const { data: goalRows } = await supabase
      .from("startup_weekly_goals")
      .select("id, title, status, author_id, order_index, created_at")
      .eq("startup_id", data.startupId)
      .eq("week_of", data.weekOf)
      .order("created_at", { ascending: true })
      .order("order_index", { ascending: true });

    const goalsRaw =
      (goalRows as Array<{
        id: string;
        title: string;
        status: string;
        author_id: string;
        order_index: number;
      }> | null) ?? [];

    const missingGoalAuthors = Array.from(
      new Set(goalsRaw.map((g) => g.author_id).filter((id) => !profilesMap.has(id))),
    );
    if (missingGoalAuthors.length > 0) {
      const { data: gp } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", missingGoalAuthors);
      for (const p of (gp as { id: string; full_name: string | null }[] | null) ?? []) {
        profilesMap.set(p.id, p.full_name ?? "Team member");
      }
    }

    const goals = goalsRaw.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      authorName: profilesMap.get(g.author_id) ?? "Team member",
    }));

    return {
      weekStart: data.weekOf,
      weekEnd: weekEndFrom(data.weekOf),
      authors,
      cards,
      goals,
    };
  });

// Customer conversations summed per week across team members, one series
// per tracked-question slot (up to 3).
export const getCustomerConversationSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTeam, isInvestor } = await assertTeam(supabase, data.startupId, userId);
    if (!isTeam && !isInvestor) return { series: [] as Array<{ slot: number; question: string; points: Array<{ weekOf: string; total: number }> }> };

    const [{ data: weekRows }, { data: convRows }, { data: trackedRows }] = await Promise.all([
      supabase
        .from("weekly_updates")
        .select("week_of")
        .eq("startup_id", data.startupId)
        .eq("is_published", true),
      supabase
        .from("weekly_customer_conversations")
        .select("week_of, customers_talked_to, question, slot")
        .eq("startup_id", data.startupId),
      supabase
        .from("startup_tracked_questions")
        .select("slot, question, is_hidden")
        .eq("startup_id", data.startupId)
        .eq("is_hidden", false)
        .order("slot", { ascending: true }),
    ]);

    const weeks = Array.from(
      new Set(((weekRows as { week_of: string }[] | null) ?? []).map((r) => r.week_of)),
    ).sort();

    const rows =
      (convRows as { week_of: string; customers_talked_to: number; question: string | null; slot: number }[] | null) ?? [];
    const tracked =
      ((trackedRows as { slot: number; question: string }[] | null) ?? []).map((t) => ({
        slot: t.slot,
        question: t.question,
      }));

    if (tracked.length === 0) {
      const bySlot = new Map<number, string>();
      for (const r of rows) if (r.question && !bySlot.has(r.slot)) bySlot.set(r.slot, r.question);
      for (const [slot, question] of bySlot.entries()) tracked.push({ slot, question });
    }

    const series = tracked.map((t) => {
      const totals = new Map<string, number>();
      let earliest: string | null = null;
      for (const r of rows) {
        if (r.slot !== t.slot) continue;
        totals.set(r.week_of, (totals.get(r.week_of) ?? 0) + (r.customers_talked_to ?? 0));
        if (earliest === null || r.week_of < earliest) earliest = r.week_of;
      }
      const filteredWeeks = earliest ? weeks.filter((w) => w >= earliest!) : [];
      return {
        slot: t.slot,
        question: t.question,
        points: filteredWeeks.map((w) => ({ weekOf: w, total: totals.get(w) ?? 0 })),
      };
    });

    return { series };
  });
