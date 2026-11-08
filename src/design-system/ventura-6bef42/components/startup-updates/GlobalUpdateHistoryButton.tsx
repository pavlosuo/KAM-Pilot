"use client";

import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { format, addDays } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/design-system/ventura-6bef42/components/ui/sheet";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { History, FileText, Plus } from "lucide-react";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { ProgressionCardsGrid, type ProgressionCard } from "./ProgressionCards";

type WeeklyUpdate = {
  id: string;
  startup_id: string;
  author_id: string;
  title: string | null;
  summary: string | null;
  transcript: string | null;
  status: string;
  is_published: boolean;
  published_at: string | null;
  week_of: string;
  created_at: string;
};

type StartupRow = { id: string; name: string };

function weekLabel(weekOf: string) {
  const start = new Date(weekOf);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${format(start, "MMMM d")}–${format(end, "d, yyyy")}`;
  if (sameYear) return `${format(start, "MMMM d")} – ${format(end, "MMMM d, yyyy")}`;
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

interface GlobalUpdateHistoryButtonProps {
  variant?: "fab" | "nav";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function GlobalUpdateHistoryButton({
  variant = "fab",
  className,
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: GlobalUpdateHistoryButtonProps = {}) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [startups, setStartups] = useState<StartupRow[]>([]);
  const [updates, setUpdates] = useState<WeeklyUpdate[]>([]);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [selected, setSelected] = useState<WeeklyUpdate | null>(null);
  const [cards, setCards] = useState<ProgressionCard[]>([]);

  // Load user's startups (owned + team-member), published only
  useEffect(() => {
    if (!user) {
      setStartups([]);
      setUpdates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [ownedRes, memberRes] = await Promise.all([
        supabase.from("startups").select("id, name").eq("owner_id", user.id).eq("is_published", true),
        supabase.from("startup_members").select("startup_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const owned = (ownedRes.data ?? []) as StartupRow[];
      const memberIds = ((memberRes.data ?? []) as { startup_id: string }[])
        .map((m) => m.startup_id)
        .filter((id) => !owned.some((o) => o.id === id));
      let memberStartups: StartupRow[] = [];
      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("startups")
          .select("id, name")
          .in("id", memberIds)
          .eq("is_published", true);
        memberStartups = (data ?? []) as StartupRow[];
      }
      if (cancelled) return;
      setStartups([...owned, ...memberStartups]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load updates (published + drafts) when sheet opens
  useEffect(() => {
    if (!open || startups.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = startups.map((s) => s.id);
      const { data } = await supabase
        .from("weekly_updates")
        .select("id, startup_id, author_id, title, summary, transcript, status, is_published, published_at, week_of, created_at")
        .in("startup_id", ids)
        .or("is_published.eq.true,status.eq.draft")
        .order("week_of", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as WeeklyUpdate[];
      setUpdates(list);
      const authorIds = Array.from(new Set(list.map((u) => u.author_id).filter(Boolean)));
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
          if (p.full_name) map[p.id] = p.full_name;
        }
        setAuthorNames(map);
      } else {
        setAuthorNames({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, startups]);

  // Load cards when an update is selected
  useEffect(() => {
    if (!selected) {
      setCards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("startup_progression_cards")
        .select("id, label, value, icon_name, image_url, display_order")
        .eq("weekly_update_id", selected.id)
        .order("display_order", { ascending: true });
      if (!cancelled && data) setCards(data as unknown as ProgressionCard[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Hide the trigger if no startups; keep the controlled sheet mountable so
  // externally-triggered opens (nav bar / hub) always work.
  if (!user) return null;
  if (showTrigger && startups.length === 0) return null;
  if (variant === "fab" && pathname.startsWith("/startup-updates")) return null;

  const startupName = (id: string) => startups.find((s) => s.id === id)?.name ?? "";
  const labelFor = (u: WeeklyUpdate) => {
    const s = startupName(u.startup_id);
    const a = authorNames[u.author_id];
    return a ? `${s}, ${a}` : s;
  };
  const badgeCount = updates.length;

  const trigger =
    variant === "nav" ? (
      <Button
        size="sm"
        className={`relative rounded-full gap-1.5 ${className ?? ""}`}
        aria-label="Startup journal"
      >
        <History className="h-4 w-4" />
        Startup journal
        {badgeCount > 0 && (
          <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[10px] font-semibold text-foreground border border-border">
            {badgeCount}
          </span>
        )}
      </Button>
    ) : (
      <Button
        variant="outline"
        size="icon"
        aria-label="Startup journal"
        className="fixed bottom-20 right-5 z-50 h-12 w-12 rounded-full border border-border bg-background text-foreground shadow-lg backdrop-blur hover:bg-accent"
      >
        <History className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
            {badgeCount}
          </span>
        )}
      </Button>
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="px-6 pt-6">
          <div className="flex items-center justify-between gap-3 pr-8">
            <SheetTitle>Startup journal</SheetTitle>
            <Button asChild size="sm" className="gap-1.5" onClick={() => setOpen(false)}>
              <Link to="/startups">
                <Plus className="h-4 w-4" /> Weekly updates
              </Link>
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pr-5 [scrollbar-gutter:stable]">
          {selected ? (
            <div className="mt-6 space-y-4 pr-1">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                ← Back to list
              </Button>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{weekLabel(selected.week_of)}</h3>
                <p className="text-xs text-muted-foreground">
                  {labelFor(selected)}
                  {selected.published_at && ` • Published ${format(new Date(selected.published_at), "MMM d, yyyy")}`}
                </p>
              </div>

              {selected.summary && (
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Update
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.summary}</p>
                </div>
              )}

              {cards.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Progression
                  </h4>
                  <ProgressionCardsGrid cards={cards} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-3 pr-1">
              {updates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-40" />
                  <p className="text-sm">No updates yet.</p>
                </div>
              ) : (
                updates.map((u) => {
                  const isDraft = !u.is_published && u.status === "draft";
                  const content = (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">
                          {u.week_of ? weekLabel(u.week_of) : "Draft"}
                        </div>
                        {isDraft && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{labelFor(u)}</div>
                      {(u.summary || u.transcript) && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {u.summary || u.transcript}
                        </p>
                      )}
                    </>
                  );
                  if (isDraft) {
                    return (
                      <Link
                        key={u.id}
                        to="/startup-updates/$startupId"
                        params={{ startupId: u.startup_id }}
                        onClick={() => setOpen(false)}
                        className="block w-full cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
                      >
                        {content}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className="block w-full cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
