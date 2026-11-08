// Shared loaders for the "Full weekly update" view.
// Each takes a Supabase client so it can run either as the authenticated
// team member (RLS) or as the admin client for program dashboards.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export function weekEndFrom(weekStart: string): string {
  return new Date(new Date(weekStart + "T00:00:00Z").getTime() + 6 * 86400000)
    .toISOString()
    .slice(0, 10);
}

export async function loadLatestUpdate(supabase: SB, startupId: string) {
  const { data: upd } = await supabase
    .from("weekly_updates")
    .select("id, title, summary, transcript, content, week_of, published_at, author_id")
    .eq("startup_id", startupId)
    .eq("is_published", true)
    .order("week_of", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!upd) return { update: null, attachments: [] };
  const update = upd as {
    id: string;
    title: string | null;
    summary: string | null;
    transcript: string | null;
    week_of: string;
    published_at: string | null;
    author_id: string;
  };

  let authorName: string | null = null;
  if (update.author_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", update.author_id)
      .maybeSingle();
    authorName = (p as { full_name: string | null } | null)?.full_name ?? null;
  }

  const { data: attRows } = await supabase
    .from("weekly_update_attachments")
    .select("id, storage_path, file_name, file_size, mime_type, created_at")
    .eq("weekly_update_id", update.id)
    .order("created_at", { ascending: true });

  const rows = (attRows ?? []) as Array<{
    id: string;
    storage_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
  }>;

  let attachments: Array<{
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    url: string | null;
  }> = [];
  if (rows.length > 0) {
    const paths = rows.map((r) => r.storage_path);
    const { data: signed } = await supabase.storage
      .from("update-attachments")
      .createSignedUrls(paths, 60 * 60);
    const byPath = new Map<string, string | null>(
      ((signed ?? []) as Array<{ path: string | null; signedUrl: string | null }>).map((s) => [
        s.path ?? "",
        s.signedUrl ?? null,
      ]),
    );
    attachments = rows.map((r) => ({
      id: r.id,
      file_name: r.file_name,
      file_size: r.file_size,
      mime_type: r.mime_type,
      url: byPath.get(r.storage_path) ?? null,
    }));
  }

  return {
    update: {
      id: update.id,
      title: update.title,
      summary: update.summary,
      transcript: update.transcript,
      week_of: update.week_of,
      published_at: update.published_at,
      author_id: update.author_id,
      author_name: authorName,
    },
    attachments,
  };
}

export async function loadPublishedWeeks(supabase: SB, startupId: string) {
  const { data: rows } = await supabase
    .from("weekly_updates")
    .select("week_of")
    .eq("startup_id", startupId)
    .eq("is_published", true)
    .order("week_of", { ascending: true });
  const set = new Set<string>();
  for (const r of (rows as { week_of: string }[] | null) ?? []) set.add(r.week_of);
  return { weeks: Array.from(set).sort() };
}

export async function loadWeekView(
  supabase: SB,
  startupId: string,
  weekOf: string,
  ownerId: string | null,
) {
  const { data: updates } = await supabase
    .from("weekly_updates")
    .select("id, author_id, summary, transcript, published_at, created_at")
    .eq("startup_id", startupId)
    .eq("week_of", weekOf)
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

  const { data: goalRows } = await supabase
    .from("startup_weekly_goals")
    .select("id, title, status, author_id, order_index, created_at")
    .eq("startup_id", startupId)
    .eq("week_of", weekOf)
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

  return { weekStart: weekOf, weekEnd: weekEndFrom(weekOf), authors, cards, goals };
}

export async function loadConversationSeries(supabase: SB, startupId: string) {
  const [{ data: weekRows }, { data: convRows }, { data: trackedRows }] = await Promise.all([
    supabase
      .from("weekly_updates")
      .select("week_of")
      .eq("startup_id", startupId)
      .eq("is_published", true),
    supabase
      .from("weekly_customer_conversations")
      .select("week_of, customers_talked_to, question, slot")
      .eq("startup_id", startupId),
    supabase
      .from("startup_tracked_questions")
      .select("slot, question, is_hidden")
      .eq("startup_id", startupId)
      .eq("is_hidden", false)
      .order("slot", { ascending: true }),
  ]);

  const weeks = Array.from(
    new Set(((weekRows as { week_of: string }[] | null) ?? []).map((r) => r.week_of)),
  ).sort();

  const rows =
    (convRows as
      | { week_of: string; customers_talked_to: number; question: string | null; slot: number }[]
      | null) ?? [];
  const tracked = ((trackedRows as { slot: number; question: string }[] | null) ?? []).map((t) => ({
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
}

export async function loadPublishStreak(supabase: SB, startupId: string) {
  const { computeCurrentWeekStart } = await import("@/design-system/ventura-6bef42/lib/week-bounds");
  const { addDaysISO } = await import("@/design-system/ventura-6bef42/lib/streak.server");

  const { data: startupRow } = await supabase
    .from("startups")
    .select("published_at")
    .eq("id", startupId)
    .maybeSingle();
  const owner = (startupRow as { published_at: string | null } | null) ?? null;
  if (!owner) return { streak: 0 };

  const currentWeek = computeCurrentWeekStart(owner.published_at);
  if (!currentWeek) return { streak: 0 };

  const { data: rows } = await supabase
    .from("weekly_updates")
    .select("week_of")
    .eq("startup_id", startupId)
    .eq("is_published", true);

  const set = new Set<string>();
  for (const r of (rows as { week_of: string }[] | null) ?? []) set.add(r.week_of);
  if (set.size === 0) return { streak: 0 };

  let latest = currentWeek;
  for (const w of set) if (w > latest) latest = w;
  let cursor = latest;
  let streak = 0;
  if (!set.has(cursor)) cursor = addDaysISO(cursor, -7);
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -7);
  }
  return { streak };
}
