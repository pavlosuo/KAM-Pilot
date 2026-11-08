import { useEffect, useState } from "react";
import { ProductTour, type TourStep } from "./ProductTour";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { getMyProfilePrefs } from "@/design-system/ventura-6bef42/lib/profile-prefs.functions";

const STORAGE_KEY = "ventura_program_tour_v1";

function localKey(userId?: string | null) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function hasSeen(userId?: string | null) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(localKey(userId)) === "done";
  } catch {
    return true;
  }
}

function markSeen(userId?: string | null) {
  try {
    window.localStorage.setItem(localKey(userId), "done");
  } catch {
    /* ignore */
  }
  if (userId) {
    supabase
      .from("profiles")
      .update({ program_tour_seen_at: new Date().toISOString() })
      .eq("id", userId)
      .then(
        () => {},
        () => {},
      );
  }
}

export function ProgramTour({ ready, programName }: { ready: boolean; programName: string }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: number | undefined;
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id ?? null;
        if (cancelled || !uid) return;
        setUserId(uid);
        if (hasSeen(uid)) return;
        const prefs = await getMyProfilePrefs().catch(() => null);
        if (cancelled) return;
        if (prefs?.program_tour_seen_at) {
          markSeen(uid);
          return;
        }
        timer = window.setTimeout(() => {
          // Persist right away so the tour never replays, even on a mid-tour reload.
          markSeen(uid);
          setOpen(true);
        }, 700);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [ready]);

  function close() {
    markSeen(userId);
    setOpen(false);
  }

  const steps: TourStep[] = [
    {
      title: `Welcome to your ${programName} hub`,
      body: "This page is your home inside the program: challenges, direct messages with the leads, curated materials and investor readiness — all in one place.",
    },
    {
      target: '[data-tour="program-search"]',
      title: "Ask Ventura AI anything",
      body: "Ask about your challenges, program deadlines, documents or next steps and get an answer grounded in your startup's data.",
    },
    {
      target: '[data-tour="program-challenges"]',
      title: "Challenges from your program",
      body: "Your leads set targets here. Keep the sliders up to date, and when a milestone is reached submit it for review with a proof file to earn XP and a badge.",
    },
    {
      target: '[data-tour="program-conversation"]',
      title: "Talk to your program leads",
      body: "Announcements, events and documents land in this thread. Switch the toggle to Private to message the leads without your teammates seeing it.",
    },
    {
      target: '[data-tour="program-resources"]',
      title: "Recommended by Ventura AI",
      body: "Twelve materials picked from your profile and weekly updates — templates, legal docs and videos. Refreshed every Monday.",
    },
    {
      target: '[data-tour="program-investor"]',
      title: "Mentor & investor matching",
      body: "Tell Ventura AI what you're stuck on or what you want to raise. It reads your profile, goals and weekly updates, asks a few sharp questions, then names three people worth talking to — your program's network first, then the best matches outside it. You can ask your lead to introduce you in one click.",
    },

  ];

  return <ProductTour steps={steps} open={open} onClose={close} />;
}
