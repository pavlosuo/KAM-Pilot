import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export const listRecentTeamBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships } = await supabase
      .from("startup_members")
      .select("startup_id")
      .eq("user_id", userId);
    const ids = ((memberships ?? []) as Array<{ startup_id: string }>).map((m) => m.startup_id);

    if (!ids.length) {
      return {
        bootstrap: false,
        badges: [] as Array<{ id: string; code: string; earnedAt: string; seen: boolean }>,
      };
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("startup_badges")
      .select("id, code, earned_at")
      .in("startup_id", ids)
      .gte("earned_at", since)
      .order("earned_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []) as Array<{ id: string; code: string; earned_at: string }>;
    // Only look up the badges we are about to show, plus a cheap "has any" probe.
    const [{ data: seenRows }, { count }] = await Promise.all([
      rows.length
        ? supabase
            .from("user_seen_badges")
            .select("badge_id")
            .eq("user_id", userId)
            .in("badge_id", rows.map((r) => r.id))
        : Promise.resolve({ data: [] as Array<{ badge_id: string }> }),
      supabase
        .from("user_seen_badges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .limit(1),
    ]);
    const seen = new Set(((seenRows ?? []) as Array<{ badge_id: string }>).map((r) => r.badge_id));

    return {
      bootstrap: (count ?? 0) === 0,
      badges: rows.map((badge) => ({
        id: badge.id,
        code: badge.code,
        earnedAt: badge.earned_at,
        seen: seen.has(badge.id),
      })),
    };
  });