"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, addDays } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/design-system/ventura-6bef42/components/ui/sheet";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { History, FileText, Plus } from "lucide-react";
import { listWeeklyUpdates, getCurrentWeekState } from "@/design-system/ventura-6bef42/lib/weekly-updates.functions";
import { getStartupPublishStreak } from "@/design-system/ventura-6bef42/lib/streak.functions";
import { StreakBadge } from "./StreakBadge";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { ProgressionCardsGrid, type ProgressionCard } from "./ProgressionCards";

type WeeklyUpdate = {
  id: string;
  startup_id: string;
  title: string | null;
  summary: string | null;
  transcript: string | null;
  status: string;
  is_published: boolean;
  published_at: string | null;
  week_of: string;
  recording_seconds: number;
  created_at: string;
};

interface Props {
  startupId: string;
}

function weekLabel(weekOf: string) {
  const start = new Date(weekOf);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${format(start, "MMMM d")}–${format(end, "d, yyyy")}`;
  }
  if (sameYear) {
    return `${format(start, "MMMM d")} – ${format(end, "MMMM d, yyyy")}`;
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

export function PastUpdatesDrawer({ startupId }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WeeklyUpdate | null>(null);
  const [cards, setCards] = useState<ProgressionCard[]>([]);

  const listFn = useServerFn(listWeeklyUpdates);
  const streakFn = useServerFn(getStartupPublishStreak);
  const weekStateFn = useServerFn(getCurrentWeekState);

  const { data } = useQuery({
    queryKey: ["weekly-updates", startupId],
    queryFn: () => listFn({ data: { startupId } }),
    enabled: open,
  });
  const { data: streakData } = useQuery({
    queryKey: ["startup-publish-streak", startupId],
    queryFn: () => streakFn({ data: { startupId } }),
    enabled: open,
    staleTime: 30_000,
  });
  const { data: weekState } = useQuery({
    queryKey: ["weekly-current-week-bounds", startupId],
    queryFn: () => weekStateFn({ data: { startupId } }),
    enabled: open,
    staleTime: 60_000,
  });
  const currentWeekStart = weekState?.weekStart ?? null;
  const streak = streakData?.streak ?? 0;

  const updates = ((data?.updates ?? []) as WeeklyUpdate[]).filter(
    (u) => u.is_published || u.status === "draft",
  );

  useEffect(() => {
    if (!selected) {
      setCards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("startup_progression_cards")
        .select("id, label, value, icon_name, image_url, display_order")
        .eq("weekly_update_id", selected.id)
        .order("display_order", { ascending: true });
      if (!cancelled && !error && data) {
        setCards(data as unknown as ProgressionCard[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-5 z-50 h-12 w-12 rounded-full border border-border bg-background text-foreground shadow-lg backdrop-blur hover:bg-accent"
        >
          <History className="h-5 w-5" />
          {updates.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
              {updates.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="px-6 pt-6">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2">
              <SheetTitle>Startup journal</SheetTitle>
              <StreakBadge streak={streak} size="sm" />
            </div>
            <Button asChild size="sm" className="gap-1.5" onClick={() => setOpen(false)}>
              <Link to="/startups">
                <Plus className="h-4 w-4" /> Weekly updates
              </Link>
            </Button>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 [scrollbar-gutter:stable]">

        {selected ? (
          <div className="mt-6 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              ← Back to list
            </Button>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{weekLabel(selected.week_of)}</h3>
              {selected.published_at && (
                <p className="text-xs text-muted-foreground">
                  Published {format(new Date(selected.published_at), "MMM d, yyyy")}
                </p>
              )}
            </div>

            {(selected.summary || selected.transcript) && (
              <div className="rounded-lg border bg-card p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selected.summary ? "Update" : "Draft transcript"}
                </h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selected.summary || selected.transcript}
                </p>
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
          <div className="mt-6 space-y-3">
            {updates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 opacity-40" />
                <p className="text-sm">No published updates yet.</p>
              </div>
            ) : (
              updates.map((u) => {
                const isDraft = !u.is_published && u.status === "draft";
                const isCurrentWeekDraft = isDraft && currentWeekStart === u.week_of;
                const content = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{weekLabel(u.week_of)}</div>
                      {isDraft && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                          Draft
                        </span>
                      )}
                    </div>
                    {(u.summary || u.transcript) && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {u.summary || u.transcript}
                      </p>
                    )}
                  </>
                );
                if (isCurrentWeekDraft) {
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
                    style={{ cursor: "pointer" }}
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
