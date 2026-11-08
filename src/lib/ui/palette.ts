import type { PriorityKey } from "@/lib/engine/priorities";
import type { HealthStatus } from "@/lib/engine/metrics";
import type { AvatarHue } from "@/lib/engine/avatars";

/**
 * Semantic colour roles mapped to token-backed utility classes (Tailwind
 * Lindström brand palette for icons and status). Charts read the resolved colours through useTokenColors.
 */
export const PRIORITY_TEXT: Record<PriorityKey, string> = {
  water: "text-lind-blue",
  emissions: "text-lind-green",
  cost: "text-lind-orange",
  circularity: "text-lind-purple",
  service: "text-lind-navy",
  hygiene: "text-lind-pink",
  evidence: "text-lind-grey",
  improvement: "text-lind-turquoise",
};

export const PRIORITY_BG_SOFT: Record<PriorityKey, string> = {
  water: "bg-lind-blue/10",
  emissions: "bg-lind-green/10",
  cost: "bg-lind-orange/10",
  circularity: "bg-lind-purple/10",
  service: "bg-lind-navy/10",
  hygiene: "bg-lind-pink/10",
  evidence: "bg-lind-grey/10",
  improvement: "bg-lind-turquoise/10",
};

export const PRIORITY_BG: Record<PriorityKey, string> = {
  water: "bg-lind-blue",
  emissions: "bg-lind-green",
  cost: "bg-lind-orange",
  circularity: "bg-lind-purple",
  service: "bg-lind-navy",
  hygiene: "bg-lind-pink",
  evidence: "bg-lind-grey",
  improvement: "bg-lind-turquoise",
};

export const STATUS_META: Record<HealthStatus, { label: string; dot: string; text: string; soft: string; ring: string }> = {
  "on-track": { label: "On track", dot: "bg-lind-green", text: "text-lind-green", soft: "bg-lind-green/10", ring: "ring-lind-green/30" },
  watch: { label: "Watch closely", dot: "bg-lind-orange", text: "text-lind-orange", soft: "bg-lind-orange/10", ring: "ring-lind-orange/30" },
  act: { label: "Act now", dot: "bg-destructive", text: "text-destructive", soft: "bg-destructive/10", ring: "ring-destructive/30" },
};

export const HUE_CLASSES: Record<AvatarHue, { bg: string; soft: string; text: string; ring: string }> = {
  blue: { bg: "bg-lind-blue", soft: "bg-lind-blue/10", text: "text-lind-blue", ring: "ring-lind-blue/30" },
  emerald: { bg: "bg-lind-green", soft: "bg-lind-green/10", text: "text-lind-green", ring: "ring-lind-green/30" },
  amber: { bg: "bg-lind-orange", soft: "bg-lind-orange/10", text: "text-lind-orange", ring: "ring-lind-orange/30" },
  rose: { bg: "bg-lind-pink", soft: "bg-lind-pink/10", text: "text-lind-pink", ring: "ring-lind-pink/30" },
  violet: { bg: "bg-lind-purple", soft: "bg-lind-purple/10", text: "text-lind-purple", ring: "ring-lind-purple/30" },
  cyan: { bg: "bg-lind-turquoise", soft: "bg-lind-turquoise/10", text: "text-lind-turquoise", ring: "ring-lind-turquoise/30" },
  orange: { bg: "bg-lind-red", soft: "bg-lind-red/10", text: "text-lind-red", ring: "ring-lind-red/30" },
  slate: { bg: "bg-lind-navy", soft: "bg-lind-navy/10", text: "text-lind-navy", ring: "ring-lind-navy/30" },
};

/** Classes whose resolved colours are needed by charts / exports. */
export const CHART_CLASSES = {
  water: "text-lind-blue",
  emissions: "text-lind-green",
  cost: "text-lind-orange",
  circularity: "text-lind-purple",
  service: "text-lind-navy",
  hygiene: "text-lind-pink",
  evidence: "text-lind-grey",
  improvement: "text-lind-turquoise",
  onTrack: "text-lind-green",
  watch: "text-lind-orange",
  act: "text-destructive",
  foreground: "text-foreground",
  muted: "text-muted-foreground",
  border: "text-border",
  primary: "text-primary",
  card: "text-card",
  background: "text-background",
  mutedBg: "text-muted",
  // Lindström brand roles used by the Recap deck (exports draw in the Lindström look, not the company accent).
  navy: "text-lind-navy",
  blue: "text-lind-blue",
  green: "text-lind-green",
  red: "text-lind-red",
  orange: "text-lind-orange",
  pink: "text-lind-pink",
  turquoise: "text-lind-turquoise",
  purple: "text-lind-purple",
  ink: "text-lind-ink",
  grey: "text-lind-grey",
  silver: "text-lind-silver",
  line: "text-lind-line",
  mist: "text-lind-mist",
} as const;

export type ChartColorKey = keyof typeof CHART_CLASSES;
