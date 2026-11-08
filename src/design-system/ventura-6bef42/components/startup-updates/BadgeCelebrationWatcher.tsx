import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { celebrateAchievements } from "@/design-system/ventura-6bef42/components/startup-updates/AchievementCelebration";
import { markBadgesSeen } from "@/design-system/ventura-6bef42/lib/badge-notify.functions";
import { listRecentTeamBadges } from "@/design-system/ventura-6bef42/lib/recent-team-badges.functions";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";

/**
 * Shows the achievement pop-up for badges granted while the user was away —
 * e.g. when a program lead approves a challenge submission.
 *
 * "Seen" state is stored per user account in the database, so each teammate
 * sees the celebration exactly once, on any device.
 */
export function BadgeCelebrationWatcher() {
  const load = useServerFn(listRecentTeamBadges);
  const markSeen = useServerFn(markBadgesSeen);
  const { user, loading } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const check = async () => {
      if (inFlight.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      inFlight.current = true;
      try {
        const res = await load({ data: undefined as never });
        if (cancelled || res == null) return;
        const badges = res.badges ?? [];
        if (!badges.length) return;

        const fresh = badges.filter((b) => !b.seen);
        if (!fresh.length) return;

        await markSeen({ data: { badgeIds: fresh.map((b) => b.id) } });
        if (cancelled || res.bootstrap) return;
        celebrateAchievements(fresh.map((b) => b.code));
      } catch {
        /* silent — celebration is non-critical */
      } finally {
        inFlight.current = false;
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), 300_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, markSeen, loading, user]);

  return null;
}
