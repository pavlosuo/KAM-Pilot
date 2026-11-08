"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/design-system/ventura-6bef42/components/ui/popover";
import {
  Zap,
  Trophy,
  ChevronRight,
  Mic,
  Pin,
  PinOff,
  Info,
  FileText,
  TextQuote,
  BarChart3,
  CheckCircle2,
  RotateCcw,
  Flame,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getWeeklyGoalsState } from "@/design-system/ventura-6bef42/lib/weekly-goals.functions";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { setPinnedBadge } from "@/design-system/ventura-6bef42/lib/pinned-badge.functions";
import { getStartupPublishStreak } from "@/design-system/ventura-6bef42/lib/streak.functions";
import { BADGE_DEFS } from "@/design-system/ventura-6bef42/components/startup-updates/goals/badges";
import { levelFromXp, xpProgressInLevel, XP_PER_LEVEL, XP_REWARD } from "@/design-system/ventura-6bef42/lib/xp";

const XP_RULES: Array<{ label: string; xp: string; icon: LucideIcon }> = [
  { label: "Publish a weekly text update", xp: `${XP_REWARD.textUpdatePublish}`, icon: FileText },
  { label: "Long update (≥500 chars)", xp: `+${XP_REWARD.textUpdateLong}`, icon: TextQuote },
  { label: "Answer a tracked metric slot", xp: `${XP_REWARD.metricAnswer}`, icon: BarChart3 },
  { label: "Mark a weekly goal as done", xp: `${XP_REWARD.goalDone}`, icon: CheckCircle2 },
  { label: "Perfect week (≥3 goals, all done)", xp: `+${XP_REWARD.goalPerfectBonus}`, icon: Trophy },
  { label: "Redeem a carried-over goal", xp: `+${XP_REWARD.goalCarryoverBonus}`, icon: RotateCcw },
  { label: "New progression card headline", xp: `${XP_REWARD.cardHeadline}`, icon: FileText },
  { label: "Streak growth", xp: `${XP_REWARD.streakGrowth}`, icon: Flame },
  { label: "All team members publish this week", xp: `${XP_REWARD.teamAllPublished} × team size`, icon: Users },
];
import { StreakBadge } from "@/design-system/ventura-6bef42/components/startup-updates/StreakBadge";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { toast } from "sonner";

type Variant = "card" | "inset";

export function ProgressXpCard({
  startupId,
  className,
  currentWeekPublished,
  nextWeekStart,
  canPinBadge = false,
  variant = "card",
  showWeeklyButton,
}: {
  startupId: string;
  className?: string;
  currentWeekPublished?: boolean;
  nextWeekStart?: string | null;
  canPinBadge?: boolean;
  variant?: Variant;
  /** Defaults: true in "card", false in "inset". */
  showWeeklyButton?: boolean;
}) {
  const fn = useServerFn(getWeeklyGoalsState);
  const pinFn = useServerFn(setPinnedBadge);
  const streakFn = useServerFn(getStartupPublishStreak);
  const qc = useQueryClient();
  const [allOpen, setAllOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["weekly-goals", startupId],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return null;
      return fn({ data: { startupId } });
    },
    staleTime: 30_000,
    retry: false,
  });

  const { data: streakData } = useQuery({
    queryKey: ["startup-publish-streak", startupId],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return null;
      return streakFn({ data: { startupId } });
    },
    staleTime: 30_000,
    retry: false,
  });
  const streak = streakData?.streak ?? 0;

  const totalXp = data?.totalXp ?? 0;
  const badges = data?.badges ?? [];
  const earnedCodes = new Set(badges.map((b) => b.code));
  const pinnedCode = data?.pinnedBadgeCode ?? null;

  const level = levelFromXp(totalXp);
  const { current: progress, needed, pct } = xpProgressInLevel(totalXp);

  const allBadges = Object.values(BADGE_DEFS);
  const previewCount = 3;
  const previewBadges = allBadges.slice(0, previewCount);
  const remaining = Math.max(0, allBadges.length - previewCount);

  const active =
    (data?.needsReview || (data?.thisWeekGoals?.length ?? 0) > 0) ?? false;

  const showBtn = showWeeklyButton ?? variant === "card";

  const togglePin = async (code: string) => {
    const nextCode = pinnedCode === code ? null : code;
    try {
      await pinFn({ data: { startupId, code: nextCode } });
      qc.invalidateQueries({ queryKey: ["weekly-goals", startupId] });
      toast.success(nextCode ? "Badge pinned to public profile" : "Badge unpinned");
    } catch (e) {
      toast.error((e as Error).message || "Could not update pinned badge");
    }
  };

  const renderBadgeTile = (code: string, size: "sm" | "md" = "md") => {
    const b = BADGE_DEFS[code];
    if (!b) return null;
    const earned = earnedCodes.has(code);
    const pinned = pinnedCode === code;
    const clickable = canPinBadge && earned;
    const dim = size === "sm" ? "h-11 w-11 text-lg" : "h-14 w-14 text-2xl";
    return (
      <button
        key={code}
        type="button"
        onClick={
          clickable
            ? () => togglePin(code)
            : !earned
              ? () =>
                  toast(`${b.label} — locked`, {
                    description: `How to unlock: ${b.description}`,
                  })
              : undefined
        }
        title={`${b.label} — ${b.description}${clickable ? (pinned ? " · click to unpin" : " · click to pin") : ""}`}
        className={cn(
          "relative flex flex-none items-center justify-center rounded-xl transition-all",
          dim,
          earned
            ? "bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-500/5 border border-amber-500/40 shadow-sm"
            : "bg-muted/40 border border-dashed border-muted-foreground/20 grayscale opacity-50",
          pinned && "ring-2 ring-primary",
          clickable && "cursor-pointer hover:brightness-110",
          !earned && "cursor-pointer hover:opacity-75",
        )}
      >
        <span className="leading-none">{b.emoji}</span>
        {pinned && (
          <span className="absolute top-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Pin className="h-2.5 w-2.5" />
          </span>
        )}
        {clickable && !pinned && (
          <span className="absolute top-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <PinOff className="h-2.5 w-2.5" />
          </span>
        )}
      </button>
    );
  };

  const body = (
    <div className="space-y-5">
      {/* Top row: label + active pill */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          Startup XP
        </div>
        <StreakBadge streak={streak} size="sm" />
      </div>

      {/* XP + level */}
      <div data-tour="xp">

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{totalXp}</span>
          <span className="text-sm font-medium text-muted-foreground">XP</span>
          <span className="mx-1 text-muted-foreground">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-lg font-semibold">Level {level}</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="How to get XP?"
                  title="How to get XP?"
                  className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <Info className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-80 overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 shadow-xl"
              >
                <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Info className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold">How to get XP?</div>
                </div>
                <ul className="divide-y divide-border/50">
                  {XP_RULES.map((r) => (
                    <li
                      key={r.label}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <r.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-foreground">{r.label}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-primary">{r.xp}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
                  {XP_PER_LEVEL} XP per level.
                </div>
              </PopoverContent>
            </Popover>
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          {progress}/150 XP · {needed} to Level {level + 1}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Badges header + view all */}
      <div data-tour="achievements">

        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ACHIEVEMENTS {badges.length}/{allBadges.length}
          </div>
          <Dialog open={allOpen} onOpenChange={setAllOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                View all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>All achievements ({badges.length}/{allBadges.length})</DialogTitle>
              </DialogHeader>
              {canPinBadge && (
                <p className="text-xs text-muted-foreground">
                  Click an earned badge to pin it on your public profile.
                </p>
              )}
              <div className="group grid grid-cols-4 gap-3 sm:grid-cols-5">
                {allBadges.map((b) => {
                  const earned = earnedCodes.has(b.code);
                  return (
                    <div key={b.code} className="flex flex-col items-center gap-1.5">
                      {renderBadgeTile(b.code, "md")}
                      <div className="w-full text-center text-[10px] font-medium uppercase leading-tight tracking-wider break-words">
                        {BADGE_DEFS[b.code].label}
                      </div>
                      {!earned && (
                        <div className="text-[9px] text-muted-foreground text-center leading-tight">
                          Locked
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="group flex items-center gap-2">
          {previewBadges.map((b) => renderBadgeTile(b.code, "md"))}
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setAllOpen(true)}
              className="flex h-14 w-14 flex-none items-center justify-center rounded-xl border bg-muted/40 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              +{remaining}
            </button>
          )}
        </div>
      </div>

      {showBtn && currentWeekPublished !== undefined && (
        <div className="pt-1">
          {currentWeekPublished ? (
            <Button className="w-full" disabled>
              See you on {nextWeekStart}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link
                to="/startup-updates/$startupId"
                params={{ startupId }}
                className="inline-flex items-center justify-center gap-2"
              >
                <Mic className="h-3.5 w-3.5" /> Weekly update
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === "inset") {
    return <div className={cn("p-6", className)}>{body}</div>;
  }

  return (
    <Card className={cn("rounded-2xl overflow-hidden", className)}>
      <CardContent className="p-6">{body}</CardContent>
    </Card>
  );
}
