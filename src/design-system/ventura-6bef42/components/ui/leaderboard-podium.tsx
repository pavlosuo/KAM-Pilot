"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";

import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface LeaderboardRanking {
  userId: string;
  userName: string;
  rank: number;
  value: number;
  avatarUrl?: string | null;
}

interface LeaderboardPodiumProps extends React.HTMLAttributes<HTMLDivElement> {
  rankings: LeaderboardRanking[];
  currentUserId?: string;
  valueSuffix?: string;
  onItemClick?: (ranking: LeaderboardRanking) => void;
}

const HEIGHTS: Record<number, string> = { 1: "h-28", 2: "h-24", 3: "h-20" };
const ORDER = [2, 1, 3];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function LeaderboardPodium({ rankings, currentUserId, valueSuffix = " XP", onItemClick, className, ...props }: LeaderboardPodiumProps) {
  const byRank = new Map(rankings.map((r) => [r.rank, r]));

  return (
    <div className={cn("flex items-end justify-center gap-5 sm:gap-10", className)} {...props}>
      {ORDER.map((rank, i) => {
        const entry = byRank.get(rank);
        if (!entry) return null;
        const isMe = currentUserId && entry.userId === currentUserId;
        const size = rank === 1 ? "h-20 w-20 text-base" : "h-14 w-14 text-sm";
        const ring = rank === 1 ? "ring-2 ring-foreground" : "ring-1 ring-border";
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, type: "spring", stiffness: 220, damping: 22 }}
            className={cn("flex w-28 flex-col items-center gap-2 sm:w-36 md:w-40", onItemClick && "cursor-pointer")}
            onClick={onItemClick ? () => onItemClick(entry) : undefined}
          >
            <div className="relative">
              {rank === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 6, rotate: -12 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: 0.45, type: "spring", stiffness: 300 }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2 hidden sm:block"
                >
                  <Crown className="h-4 w-4 text-foreground" />
                </motion.div>
              )}
              <div
                className={cn(
                  "flex items-center justify-center overflow-hidden rounded-full border-2 bg-background font-semibold shadow-sm",
                  size,
                  ring,
                  rank === 1 && "border-foreground",
                )}
              >
                {entry.avatarUrl ? (
                  <img src={entry.avatarUrl} alt={entry.userName} className="h-full w-full object-cover" />
                ) : (
                  initials(entry.userName)
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="line-clamp-1 text-xs font-semibold leading-tight">{entry.userName}</p>
              <p className="text-[10px] text-muted-foreground">{entry.value.toLocaleString()}{valueSuffix}</p>
            </div>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.5, ease: "easeOut" }}
              className="w-full origin-bottom overflow-hidden"
            >
              <div
                className={cn(
                  "flex w-full items-start justify-center rounded-t-xl border border-b-0 pt-2 text-sm font-bold transition-colors",
                  HEIGHTS[rank],
                  rank === 1 && "bg-foreground text-background",
                  rank === 2 && "bg-muted text-foreground",
                  rank === 3 && "bg-muted/50 text-foreground/80",
                  isMe && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {rank}
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

export { LeaderboardPodium };
export type { LeaderboardRanking, LeaderboardPodiumProps };
