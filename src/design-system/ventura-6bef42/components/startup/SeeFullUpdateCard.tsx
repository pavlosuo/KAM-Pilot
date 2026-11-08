import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { getLatestUpdateForTeam } from "@/design-system/ventura-6bef42/lib/team-update-view.functions";
import {
  getWeekUpdateView,
  listPublishedUpdateWeeks,
  getCustomerConversationSeries,
} from "@/design-system/ventura-6bef42/lib/update-history.functions";
import { getStartupPublishStreak } from "@/design-system/ventura-6bef42/lib/streak.functions";
import {
  getProgramLatestUpdate,
  getProgramUpdateWeeks,
  getProgramWeekUpdateView,
  getProgramConversationSeries,
  getProgramStartupStreak,
} from "@/design-system/ventura-6bef42/lib/program-update-view.functions";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { StreakBadge } from "@/design-system/ventura-6bef42/components/startup-updates/StreakBadge";
import { ProgressionCardsGrid, type ProgressionCard } from "@/design-system/ventura-6bef42/components/startup-updates/ProgressionCards";
import { ChevronLeft, ChevronRight, FileText, ExternalLink, Loader2, TrendingUp, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import venturaLogo from "@/design-system/ventura-6bef42/assets/ventura-orb-logo.png.asset.json";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWeekRange(weekStart: string | null, weekEnd: string | null): string {
  if (!weekStart || !weekEnd) return "";
  const s = new Date(weekStart + "T00:00:00Z");
  const e = new Date(weekEnd + "T00:00:00Z");
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  return sameMonth
    ? `${format(s, "MMMM d")} – ${format(e, "d")}`
    : `${format(s, "MMMM d")} – ${format(e, "MMMM d")}`;
}

function shortWeekLabel(weekStart: string): string {
  return format(new Date(weekStart + "T00:00:00Z"), "MMM d");
}

export function SeeFullUpdateCard({
  startupId,
  startupName,
  programSlug,
  trigger,
}: {
  startupId: string;
  startupName: string;
  startupLogoUrl?: string | null;
  /** When set, data is loaded through the program dashboard session instead of team auth. */
  programSlug?: string;
  trigger?: (props: { onClick: () => void; disabled: boolean }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const latestFn = useServerFn(getLatestUpdateForTeam);
  const weeksFn = useServerFn(listPublishedUpdateWeeks);
  const weekViewFn = useServerFn(getWeekUpdateView);
  const seriesFn = useServerFn(getCustomerConversationSeries);
  const streakFn = useServerFn(getStartupPublishStreak);

  const pLatestFn = useServerFn(getProgramLatestUpdate);
  const pWeeksFn = useServerFn(getProgramUpdateWeeks);
  const pWeekViewFn = useServerFn(getProgramWeekUpdateView);
  const pSeriesFn = useServerFn(getProgramConversationSeries);
  const pStreakFn = useServerFn(getProgramStartupStreak);

  const { session } = useAuth();
  const scope = programSlug ?? "team";

  const { data: streakData } = useQuery({
    queryKey: ["startup-publish-streak", scope, startupId],
    queryFn: () =>
      programSlug
        ? (pStreakFn({ data: { slug: programSlug, startupId } }) as ReturnType<typeof streakFn>)
        : streakFn({ data: { startupId } }),
    enabled: !!programSlug || !!session,
    retry: false,
    staleTime: 30_000,
  });
  const streak = streakData?.streak ?? 0;

  const { data: latest, isLoading } = useQuery({
    queryKey: ["team-latest-update", scope, startupId],
    queryFn: () =>
      programSlug
        ? (pLatestFn({ data: { slug: programSlug, startupId } }) as ReturnType<typeof latestFn>)
        : latestFn({ data: { startupId } }),
    staleTime: 30_000,
  });

  const { data: weeksData } = useQuery({
    queryKey: ["update-history-weeks", scope, startupId],
    queryFn: () =>
      programSlug
        ? (pWeeksFn({ data: { slug: programSlug, startupId } }) as ReturnType<typeof weeksFn>)
        : weeksFn({ data: { startupId } }),
    enabled: open,
    staleTime: 30_000,
  });
  const weeks = useMemo(() => weeksData?.weeks ?? [], [weeksData]);

  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (selectedWeek == null && weeks.length > 0) {
      setSelectedWeek(weeks[weeks.length - 1]);
    }
  }, [open, weeks, selectedWeek]);
  useEffect(() => {
    if (!open) setSelectedWeek(null);
  }, [open]);

  const { data: weekView, isFetching: weekLoading } = useQuery({
    queryKey: ["update-history-week", scope, startupId, selectedWeek],
    queryFn: () =>
      programSlug
        ? (pWeekViewFn({
            data: { slug: programSlug, startupId, weekOf: selectedWeek! },
          }) as ReturnType<typeof weekViewFn>)
        : weekViewFn({ data: { startupId, weekOf: selectedWeek! } }),
    enabled: open && !!selectedWeek,
    staleTime: 30_000,
  });

  const { data: seriesData } = useQuery({
    queryKey: ["customer-conv-series", scope, startupId],
    queryFn: () =>
      programSlug
        ? (pSeriesFn({ data: { slug: programSlug, startupId } }) as ReturnType<typeof seriesFn>)
        : seriesFn({ data: { startupId } }),
    enabled: open,
    staleTime: 30_000,
  });

  if (!latest || !latest.update) return null;

  const attachments = latest.attachments;

  const weekIdx = selectedWeek ? weeks.indexOf(selectedWeek) : -1;
  const hasPrev = weekIdx > 0;
  const hasNext = weekIdx >= 0 && weekIdx < weeks.length - 1;
  const goPrev = () => hasPrev && setSelectedWeek(weeks[weekIdx - 1]);
  const goNext = () => hasNext && setSelectedWeek(weeks[weekIdx + 1]);

  const weekRange = formatWeekRange(weekView?.weekStart ?? null, weekView?.weekEnd ?? null);
  const authors = weekView?.authors ?? [];
  const goals = weekView?.goals ?? [];
  const completedGoals = goals.filter((g) => g.status === "done").length;
  const cards: ProgressionCard[] = (weekView?.cards ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    value: c.value,
    icon_name: c.icon_name,
    image_url: c.image_url,
    description: c.description,
  }));

  const series = seriesData?.series ?? [];
  const seriesCharts = series.map((s) => ({
    slot: s.slot,
    question: s.question,
    data: s.points.map((p) => ({
      week: shortWeekLabel(p.weekOf),
      weekRange: formatWeekRange(
        p.weekOf,
        new Date(new Date(p.weekOf + "T00:00:00Z").getTime() + 6 * 86400000)
          .toISOString()
          .slice(0, 10),
      ),
      total: p.total,
    })),
  }));
  const isSelectedLatestWeek = selectedWeek === weeks[weeks.length - 1];

  return (
    <>
      {trigger ? (
        trigger({ onClick: () => setOpen(true), disabled: false })
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/60 hover:shadow-md hover:scale-[1.01] cursor-pointer"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-white p-1.5">
            <img src={venturaLogo.url} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-semibold leading-tight text-foreground">
              See full update
            </span>
          </div>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-[min(1200px,95vw)] max-w-none grid-rows-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-4 text-left sm:px-6 sm:pb-4 sm:pt-6">
            <div className="flex flex-col gap-2 pr-8 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:pr-10">
              <div className="min-w-0 flex-1">
                <DialogTitle className="break-words text-left text-base leading-tight sm:text-lg">
                  {startupName} —{" "}
                  {isSelectedLatestWeek ? "Latest weekly update" : "Weekly update"}
                </DialogTitle>
                {weekRange ? (
                  <DialogDescription className="mt-1 text-left text-xs sm:text-sm">
                    {weekRange}
                  </DialogDescription>
                ) : null}
              </div>
              <StreakBadge streak={streak} size="sm" className="shrink-0 self-start sm:self-center" />
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            <div className="grid grid-cols-1 gap-y-6 md:grid-cols-[1fr_360px] md:gap-y-0">
              {/* Left: founders' posts */}
              <div className="px-4 pb-6 pt-4 sm:px-6 sm:pt-5">
              {isLoading || (weekLoading && !weekView) ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6 pr-1">
                  {authors.length > 0 ? (
                    <div className="space-y-6">
                      {authors.map((a, idx) => (
                        <div
                          key={a.updateId}
                          className={`space-y-2 ${idx !== authors.length - 1 ? "border-b border-border pb-6" : ""}`}
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {a.authorName} posted
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            {a.summary || "(no text)"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No written content for this update.
                    </p>
                  )}

                  {goals.length > 0 && (
                    <section className="rounded-2xl border border-border bg-card/70 p-3">
                      <div className="mb-2 flex items-center justify-between px-1">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Goals this week
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {completedGoals} / {goals.length} completed
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {goals.map((g) => {
                          const done = g.status === "done";
                          return (
                            <li
                              key={g.id}
                              className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5"
                            >
                              {done ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              ) : (
                                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-sm leading-snug ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
                                >
                                  {g.title}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {g.authorName}
                                  {g.status === "carried_over"
                                    ? " · carried over"
                                    : g.status === "dropped"
                                      ? " · dropped"
                                      : ""}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {seriesCharts.length > 0 && (
                    <div className="space-y-4">
                      {seriesCharts.map((sc) => (
                        <section
                          key={sc.slot}
                          className="rounded-2xl border border-border bg-card/70 p-3"
                        >
                          <div className="mb-2 flex items-start gap-2 px-1">
                            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {sc.question}
                            </h4>
                          </div>
                          {sc.data.length > 0 ? (
                            <div className="h-56 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sc.data} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
                                  <defs>
                                    <linearGradient id={`ccFill-main-${sc.slot}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                  <XAxis
                                    dataKey="week"
                                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={{ stroke: "var(--border)" }}
                                    padding={{ left: 8, right: 8 }}
                                  />
                                  <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      background: "var(--popover)",
                                      border: "1px solid var(--border)",
                                      borderRadius: 8,
                                      fontSize: 12,
                                    }}
                                    labelStyle={{ color: "var(--foreground)" }}
                                    labelFormatter={(_label, payload) =>
                                      (payload && payload[0] && (payload[0].payload as { weekRange?: string }).weekRange) || _label
                                    }
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="var(--primary)"
                                    strokeWidth={2.5}
                                    fill={`url(#ccFill-main-${sc.slot})`}
                                    dot={{ r: 3.5, fill: "var(--background)", strokeWidth: 2, stroke: "var(--foreground)" }}
                                    activeDot={{ r: 5.5, fill: "var(--foreground)", strokeWidth: 2, stroke: "var(--background)" }}
                                    connectNulls
                                    isAnimationActive
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <p className="px-1 py-3 text-xs text-muted-foreground">
                              No data yet.
                            </p>
                          )}
                          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                            Sum across the team, per week.
                          </p>
                        </section>
                      ))}
                    </div>
                  )}

                  {isSelectedLatestWeek && attachments.length > 0 && (

                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Attached files
                      </h4>
                      <ul className="space-y-2 text-sm">
                        {attachments.map((a) => (
                          <li key={a.id}>
                            {a.url ? (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center gap-2 rounded-lg border p-2.5 hover:border-primary/50 hover:bg-accent/40 transition"
                              >
                                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                                <span className="flex-1 truncate">{a.file_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatBytes(a.file_size)}
                                </span>
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                              </a>
                            ) : (
                              <span className="block rounded-lg border p-2.5">{a.file_name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: panels */}
            <aside className="border-t bg-muted/20 px-4 pb-6 pt-5 sm:px-5 md:border-l md:border-t-0">
              {/* Week navigation */}
              <section className="rounded-2xl border border-border bg-card/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Week
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {weekIdx >= 0 ? `${weekIdx + 1} / ${weeks.length}` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center gap-1"
                    onClick={goPrev}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center gap-1"
                    onClick={goNext}
                    disabled={!hasNext}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </section>

              {/* Progression cards for this week */}
              <section className="mt-4">
                {cards.length > 0 ? (
                  <ProgressionCardsGrid cards={cards} columns={1} />
                ) : (
                  <p className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-xs text-muted-foreground">
                    No progression cards were saved for this week.
                  </p>
                )}
              </section>



            </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
