"use client";

import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { getPublicStartupProgress } from "@/design-system/ventura-6bef42/lib/pinned-badge.functions";
import { BADGE_DEFS } from "@/design-system/ventura-6bef42/components/startup-updates/goals/badges";
import { levelFromXp } from "@/design-system/ventura-6bef42/lib/xp";

function levelBadgeStyle(level: number) {
  const step = Math.min(4, Math.max(0, Math.floor((level - 1) / 5)));
  const t = step / 4;
  const hue = 45;
  const sat = Math.round(0 + (95 - 0) * t);
  const light = Math.round(72 + (52 - 72) * t);
  const darkText = step >= 3;
  const textColor = darkText
    ? "hsl(45 90% 18%)"
    : `hsl(${hue} ${Math.max(45, sat)}% 24%)`;
  return {
    background: `linear-gradient(135deg, hsl(${hue} ${sat}% ${light}%) 0%, hsl(${hue} ${sat}% ${light - 8}%) 100%)`,
    borderColor: `hsl(${hue} ${sat}% ${light - 18}%)`,
    color: textColor,
    iconColor: textColor,
  };
}

export function PublicProgressBadge({ startupId, className = "" }: { startupId: string; className?: string }) {
  const fn = useServerFn(getPublicStartupProgress);
  const { data } = useQuery({
    queryKey: ["public-startup-progress", startupId],
    queryFn: () => fn({ data: { startupId } }),
    staleTime: 60_000,
  });
  if (!data) return null;
  const level = levelFromXp(data.totalXp);
  const badge = data.pinnedBadgeCode ? BADGE_DEFS[data.pinnedBadgeCode] : null;
  if (data.totalXp === 0 && !badge) return null;
  const style = levelBadgeStyle(level);
  return (
    <>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${className}`}
        style={{ background: style.background, borderColor: style.borderColor, color: style.color }}
        title={`${data.totalXp} XP`}
      >
        <Trophy className="h-3.5 w-3.5" style={{ color: style.iconColor }} /> Level {level}
      </span>
      {badge && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-500/5 border border-amber-500/40 px-3 py-1 text-xs font-medium ${className}`}
          title={badge.description}
        >
          <span className="text-sm leading-none">{badge.emoji}</span> {badge.label}
        </span>
      )}
    </>
  );
}
