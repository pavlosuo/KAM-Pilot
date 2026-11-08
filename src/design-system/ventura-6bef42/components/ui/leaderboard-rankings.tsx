"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface LeaderboardRankingItem {
  userId: string;
  rank: number;
  userName: string;
  byline?: string;
  value: number;
  displayed?: boolean;
  avatarUrl?: string | null;
}

interface LeaderboardRankingsProps extends React.HTMLAttributes<HTMLDivElement> {
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  valueSuffix?: string;
  onItemClick?: (item: LeaderboardRankingItem) => void;
  renderActions?: (item: LeaderboardRankingItem) => React.ReactNode;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function LeaderboardRankings({
  rankings,
  currentUserId,
  valueSuffix = "",
  onItemClick,
  renderActions,
  className,
  ...props
}: LeaderboardRankingsProps) {
  const items = rankings.filter((r) => r.displayed !== false);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {items.map((item, i) => {
        const isMe = currentUserId && item.userId === currentUserId;
        return (
          <motion.div
            key={item.userId}
            layout
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.35, ease: "easeOut" }}
            className={cn(
              "group flex items-center gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/30 hover:shadow-md",
              isMe && "border-primary/60 bg-primary/5",
              onItemClick && "cursor-pointer",
            )}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          >
            <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground/70">
              {item.rank}
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-[10px] font-semibold">
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt={item.userName} className="h-full w-full object-cover" />
              ) : (
                initials(item.userName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.userName}</p>
              {item.byline ? (
                <p className="truncate text-[11px] text-muted-foreground">{item.byline}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
              {item.value.toLocaleString()}{valueSuffix}
            </span>
            {renderActions ? (
              <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                {renderActions(item)}
              </div>
            ) : null}
          </motion.div>
        );
      })}
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No rankings yet.</p>
      ) : null}
    </div>
  );
}

export { LeaderboardRankings };
export type { LeaderboardRankingItem, LeaderboardRankingsProps };
