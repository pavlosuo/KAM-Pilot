import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekBounds } from "@/design-system/ventura-6bef42/lib/week-bounds";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function currentWeek(supabase: SB, startupId: string) {
  const { data } = await supabase
    .from("startups")
    .select("published_at, owner_id")
    .eq("id", startupId)
    .maybeSingle();
  const publishedAt = (data as { published_at: string | null } | null)?.published_at;
  const ownerId = (data as { owner_id: string } | null)?.owner_id ?? null;
  const bounds = computeCurrentWeekBounds(publishedAt);
  return {
    weekStart: bounds?.weekStart ?? null,
    weekEnd: bounds?.weekEnd ?? null,
    ownerId,
  };
}

export const getCurrentWeekOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { weekStart: curStart, weekEnd: curEnd, ownerId } = await currentWeek(supabase, data.startupId);

    let weekStart = curStart;
    let weekEnd = curEnd;
    let rows: Array<{
      id: string;
      author_id: string;
      summary: string | null;
      published_at: string | null;
      created_at: string;
    }> = [];

    if (weekStart) {
      const { data: updates } = await supabase
        .from("weekly_updates")
        .select("id, author_id, summary, published_at, created_at")
        .eq("startup_id", data.startupId)
        .eq("week_of", weekStart)
        .eq("is_published", true)
        .order("published_at", { ascending: true });
      rows = (updates as typeof rows) ?? [];
    }

    // Fallback: no published updates this week → use the latest published update (any week).
    if (rows.length === 0) {
      const { data: latest } = await supabase
        .from("weekly_updates")
        .select("week_of")
        .eq("startup_id", data.startupId)
        .eq("is_published", true)
        .order("week_of", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(1);
      const latestRows = (latest as Array<{ week_of: string }>) ?? [];
      if (latestRows.length > 0) {
        const wk = latestRows[0].week_of;
        const { data: sameWeek } = await supabase
          .from("weekly_updates")
          .select("id, author_id, summary, published_at, created_at")
          .eq("startup_id", data.startupId)
          .eq("week_of", wk)
          .eq("is_published", true)
          .order("published_at", { ascending: true });
        rows = (sameWeek as typeof rows) ?? [];
        weekStart = wk;
        weekEnd = new Date(new Date(wk + "T00:00:00Z").getTime() + 6 * 86400000)
          .toISOString().slice(0, 10);
      }
    }

    if (rows.length === 0) {
      return { weekStart: null, weekEnd: null, authors: [], cards: [], latestUpdateId: null };
    }

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

    // Determine role: owner -> "Founder", others -> "Co-founder N" by order of first publish.
    const orderedAuthors: string[] = [];
    for (const r of rows) {
      if (!orderedAuthors.includes(r.author_id)) orderedAuthors.push(r.author_id);
    }
    const coIndexByAuthor = new Map<string, number>();
    let coCounter = 0;
    for (const a of orderedAuthors) {
      if (a === ownerId) continue;
      coCounter += 1;
      coIndexByAuthor.set(a, coCounter);
    }

    const authors = rows.map((r) => ({
      updateId: r.id,
      authorId: r.author_id,
      authorName: profilesMap.get(r.author_id) ?? "Team member",
      role:
        r.author_id === ownerId
          ? "Founder"
          : `Co-founder ${coIndexByAuthor.get(r.author_id) ?? ""}`.trim(),
      summary: r.summary ?? "",
      publishedAt: r.published_at,
    }));

    // Latest update with cards (most recent published).
    const latestFirst = [...rows].reverse();
    let cards: Array<{
      id: string;
      label: string;
      value: string | null;
      icon_name: string | null;
      image_url: string | null;
      description: string | null;
    }> = [];
    let latestUpdateId: string | null = null;
    for (const r of latestFirst) {
      const { data: cs } = await supabase
        .from("startup_progression_cards")
        .select("id, label, value, icon_name, image_url, description, display_order")
        .eq("weekly_update_id", r.id)
        .order("display_order", { ascending: true });
      const arr = (cs as typeof cards | null) ?? [];
      if (arr.length > 0) {
        cards = arr;
        latestUpdateId = r.id;
        break;
      }
    }
    if (!latestUpdateId && rows.length > 0) latestUpdateId = rows[rows.length - 1].id;

    return { weekStart, weekEnd, authors, cards, latestUpdateId };
  });

export const updateAuthorSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        updateId: z.string().uuid(),
        summary: z.string().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("weekly_updates")
      .update({ summary: data.summary } as never)
      .eq("id", data.updateId);
    if (error) throw error;
    return { ok: true };
  });
