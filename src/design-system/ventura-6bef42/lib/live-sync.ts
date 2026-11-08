import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Query key prefixes that represent "live" collaborative data:
 * messaging, inbox threads, challenges/KPIs, submissions, mentor match
 * requests and program dashboards. These are refreshed automatically so
 * users never need to reload the page to see new activity.
 */
export const LIVE_QUERY_PREFIXES = [
  "inbox",
  "program-inbox",
  "program-inbox-threads",
  "program-thread",
  "program-comms",
  "program-communication",
  "program-kpis",
  "program-challenge-submissions",
  "program-workspace",
  "program-overview",
  "program-portfolio",
  "program-network",
  "program-startup",
  "program-invites",
  "startup-match-board",
  "mentor-match-startups",
  "followed-news",
  "messages",
  "conversation",
  "conversations",
] as const;

const PREFIX_SET = new Set<string>(LIVE_QUERY_PREFIXES as readonly string[]);

export function isLiveQueryKey(key: readonly unknown[]): boolean {
  const head = key[0];
  return typeof head === "string" && PREFIX_SET.has(head);
}

/** Interval (ms) between automatic refreshes of live queries. */
export const LIVE_SYNC_INTERVAL = 30_000;

/**
 * Mounted once at the app root. Periodically refetches active live queries
 * (only while the tab is visible) and refreshes immediately when the user
 * returns to the tab.
 */
export function useLiveSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({
        predicate: (query) => isLiveQueryKey(query.queryKey),
        refetchType: "active",
      });
    };

    const id = window.setInterval(refresh, LIVE_SYNC_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [queryClient]);
}
