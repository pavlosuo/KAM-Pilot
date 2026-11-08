import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInbox } from "@/design-system/ventura-6bef42/lib/inbox.functions";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";

export const INBOX_TAB_SEEN_KEY = "ventura-inbox-tab-seen";
export const INBOX_SEEN_EVENT = "ventura-inbox-seen";

function readTabSeen(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(INBOX_TAB_SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Header badge: same per-tab "seen" rules as the Inbox tabs, persisted across reloads. */
export function useInboxUnread() {
  const { session } = useAuth();
  const load = useServerFn(getInbox);
  const [seen, setSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    const sync = () => setSeen(readTabSeen());
    sync();
    window.addEventListener(INBOX_SEEN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INBOX_SEEN_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const { data } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => load(),
    enabled: Boolean(session?.access_token),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const s = (k: string) => seen[k] ?? 0;
  const direct = (data?.threads ?? []).filter((t) => {
    if (!t.unread) return false;
    const last = t.messages[t.messages.length - 1];
    return !last || Date.parse(last.createdAt) > s("messages");
  }).length;
  const program = data?.showProgramTab
    ? (data?.items ?? []).filter((i) => Date.parse(i.createdAt) > s("program")).length
    : 0;
  const comments = data?.showCommentsTab
    ? (data?.commentGroups ?? []).filter((g) => Date.parse(g.latestAt) > s("comments")).length
    : 0;
  const unread = direct + program + comments;

  const markSeen = useCallback(() => {
    setSeen(readTabSeen());
  }, []);

  return { unread, markSeen };
}
