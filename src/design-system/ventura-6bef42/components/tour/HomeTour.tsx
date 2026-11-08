import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ProductTour, type TourStep } from "./ProductTour";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { getMyProfilePrefs } from "@/design-system/ventura-6bef42/lib/profile-prefs.functions";

const STORAGE_KEY = "ventura_home_tour_v1";

function localKey(userId?: string | null) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

export function hasSeenHomeTour(userId?: string | null) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(localKey(userId)) === "done";
  } catch {
    return true;
  }
}

export function markHomeTourSeen(userId?: string | null) {
  try {
    window.localStorage.setItem(localKey(userId), "done");
    window.localStorage.setItem(STORAGE_KEY, "done");
  } catch {
    /* ignore */
  }
  if (userId) {
    // Supabase query builders are lazy — `.then()` is required to actually run it.
    supabase
      .from("profiles")
      .update({ home_tour_seen_at: new Date().toISOString() })
      .eq("id", userId)
      .then(
        () => {},
        () => {},
      );
  }
}

const WEEKLY_STEP: TourStep = {
  title: "Why weekly updates matter",
  body: (
    <div className="space-y-2">
      <p>
        Weekly updates are the heartbeat of your startup on Ventura. They build your streak, earn XP and
        achievements, and show investors real momentum week after week.
      </p>
      <p className="font-medium text-foreground">
        Investor and Mentor matchmaking unlock only for startups with a weekly update streak of at least 2.
      </p>
      <p>Post one update every week — two weeks in a row is all it takes to get matched.</p>
    </div>
  ),
};

export function HomeTour({ ready, hasStartup }: { ready: boolean; hasStartup: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: number | undefined;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (cancelled || !uid) return;
      setUserId(uid);
      if (hasSeenHomeTour(uid)) return;
      const prefs = await getMyProfilePrefs().catch(() => null);
      if (cancelled) return;
      if (prefs?.home_tour_seen_at) {
        markHomeTourSeen(uid);
        return;
      }
      timer = window.setTimeout(() => {
        // Persist immediately so the tour never replays, even if the user reloads mid-tour.
        markHomeTourSeen(uid);
        setOpen(true);
      }, 600);
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [ready]);

  function close() {
    markHomeTourSeen(userId);
    setOpen(false);
  }


  const steps: TourStep[] = hasStartup
    ? [
        {
          target: '[data-tour="metrics"]',
          title: "Your engagement at a glance",
          body: "Likes, comments, pitch deck openings, saves and follows from investors browsing Ventura — updated live.",
        },
        {
          target: '[data-tour="pitch-video"]',
          title: "Your pitch video",
          body: "Watch how your pitch appears in the feed, or upload a new one any time. A pitch video is the first impression investors get of you.",
        },
        {
          target: '[data-tour="weekly-update"]',
          title: "Post your weekly update",
          body: "Every week you record progress, numbers and goals here. This is the single most important habit on Ventura.",
        },
        {
          target: '[data-tour="edit-profile"]',
          title: "Keep your profile sharp",
          body: "Edit your startup profile — team, market, traction, pitch deck — whenever something changes.",
        },
        {
          target: '[data-tour="xp"]',
          title: "XP, levels and streaks",
          body: "You earn XP for updates, metrics, goals and team participation. XP raises your level and your streak flame grows with every consecutive week.",
        },
        {
          target: '[data-tour="achievements"]',
          title: "Achievements",
          body: "Unlock badges as you grow and pin your favourite one to your public startup profile.",
        },
        WEEKLY_STEP,
      ]
    : [
        {
          target: '[data-tour="create-startup"]',
          title: "Create your startup profile",
          body: "Nice — your personal profile is live. The next step is your startup profile: it's what investors discover, follow and reach out about.",
          action: {
            label: "Create startup profile",
            onClick: () => {
              markHomeTourSeen(userId);
              setOpen(false);
              void navigate({ to: "/startups/new" });
            },
          },
        },
        {
          title: "What happens after that",
          body: "Once your startup is published you get engagement metrics, XP, levels and achievements — all driven by your weekly updates.",
        },
        WEEKLY_STEP,
      ];

  return <ProductTour steps={steps} open={open} onClose={close} />;
}
