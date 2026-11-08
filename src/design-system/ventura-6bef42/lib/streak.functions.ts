import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { addDaysISO } from "@/design-system/ventura-6bef42/lib/streak.server";

// Returns the number of consecutive weeks (ending at the current week) in
// which at least one team member published a weekly update. The current
// week is "grace": if it hasn't been published yet but the prior week has,
// the streak still counts the prior weeks. If two consecutive weeks are
// missed, the streak resets to 0. Requires an authenticated caller; RLS
// on weekly_updates lets team members read their startup's rows.
export const getStartupPublishStreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;


    const { data: startupRow } = await supabase
      .from("startups")
      .select("published_at")
      .eq("id", data.startupId)
      .maybeSingle();
    const owner = (startupRow as { published_at: string | null } | null) ?? null;
    if (!owner) return { streak: 0 };

    const currentWeek = computeCurrentWeekStart(owner.published_at);
    if (!currentWeek) return { streak: 0 };

    const { data: rows } = await supabase
      .from("weekly_updates")
      .select("week_of")
      .eq("startup_id", data.startupId)
      .eq("is_published", true);

    const set = new Set<string>();
    for (const r of (rows as { week_of: string }[] | null) ?? []) set.add(r.week_of);
    if (set.size === 0) return { streak: 0 };

    // Start from the latest published week if it's beyond the current week
    // (testing-mode publishes shift updates into future week buckets).
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
  });
