"use client";

import * as React from "react";

import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import {
  LeaderboardPodium,
  type LeaderboardRanking as LeaderboardPodiumRanking,
} from "@/design-system/ventura-6bef42/components/ui/leaderboard-podium";
import {
  LeaderboardRankings,
  type LeaderboardRankingItem,
} from "@/design-system/ventura-6bef42/components/ui/leaderboard-rankings";

interface LeaderboardRunOption {
  id: string;
  label: string;
}

interface LeaderboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  hideDateRange?: boolean;
  headerAction?: React.ReactNode;
  fromDate: string | Date;
  toDate: string | Date;
  podiumRankings: LeaderboardPodiumRanking[];
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  valueSuffix?: string;
  onItemClick?: (ranking: LeaderboardRankingItem) => void;
  renderActions?: (ranking: LeaderboardRankingItem) => React.ReactNode;
  runOptions?: LeaderboardRunOption[];
  selectedRunId?: string;
  onRunChange?: (runId: string) => void;
}

function formatRangeDate(date: string | Date) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const LeaderboardCard = React.forwardRef<HTMLDivElement, LeaderboardCardProps>(
  (
    {
      className,
      title = "Leaderboard",
      hideDateRange = false,
      headerAction,
      fromDate,
      toDate,
      podiumRankings,
      rankings,
      currentUserId,
      valueSuffix,
      onItemClick,
      renderActions,
      runOptions,
      selectedRunId,
      onRunChange,
      ...props
    },
    ref,
  ) => {
    const fromLabel = formatRangeDate(fromDate);
    const toLabel = formatRangeDate(toDate);
    const resolvedRunId = selectedRunId ?? runOptions?.[0]?.id ?? "";
    const hasOnRunChange = Boolean(onRunChange);
    const [localRunId, setLocalRunId] = React.useState(resolvedRunId);

    React.useEffect(() => {
      if (hasOnRunChange) return;
      setLocalRunId(resolvedRunId);
    }, [hasOnRunChange, resolvedRunId]);

    const activeRunId = hasOnRunChange ? resolvedRunId : localRunId;

    return (
    <div
      ref={ref}
      className={cn("overflow-hidden rounded-2xl border bg-card shadow-lg sm:rounded-3xl", className)}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5 sm:pt-5 sm:pb-2">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {!hideDateRange ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fromLabel} - {toLabel}
            </p>
          ) : null}
        </div>

        {headerAction}

        {runOptions && runOptions.length > 0 ? (
          <select
            value={activeRunId}
            onChange={(e) => {
              if (onRunChange) {
                onRunChange(e.target.value);
                return;
              }
              setLocalRunId(e.target.value);
            }}
            className="cursor-pointer rounded-md border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {runOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="px-4 pb-5 pt-1 sm:px-5 sm:pb-6 sm:pt-1">
        <LeaderboardPodium
          rankings={podiumRankings}
          currentUserId={currentUserId}
          valueSuffix={valueSuffix}
          onItemClick={onItemClick}
          className="mb-3 sm:mb-4"
        />

        <LeaderboardRankings
          rankings={rankings}
          currentUserId={currentUserId}
          valueSuffix={valueSuffix}
          onItemClick={onItemClick}
          renderActions={renderActions}
        />
      </div>
    </div>
    );
  },
);

LeaderboardCard.displayName = "LeaderboardCard";

export { LeaderboardCard };
export type { LeaderboardCardProps, LeaderboardRunOption };
