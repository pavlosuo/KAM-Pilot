import { Flame } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface StreakBadgeProps {
  streak: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Heat scale: 0 = cool white, ramping up through amber to bright yellow / orange
// the longer the publish streak. Designed to feel like a "warming up" coal.
function heatStyle(streak: number): {
  background: string;
  ring: string;
  text: string;
  glow: string;
  flameClass: string;
  pulse: boolean;
} {
  // Clamp heat at 12 weeks so it doesn't keep getting brighter forever.
  const t = Math.min(streak, 12) / 12;

  if (streak <= 0) {
    return {
      background: "linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)",
      ring: "1px solid #e5e7eb",
      text: "#9ca3af",
      glow: "0 1px 2px rgba(0,0,0,0.04)",
      flameClass: "text-gray-300",
      pulse: false,
    };
  }

  // Interpolate from soft cream → amber → bright yellow
  // Stops: cream(#fff7d6) → amber(#fbbf24) → bright yellow(#fde047) with orange edges
  // We build a radial gradient that intensifies with t.
  const inner =
    t < 0.5
      ? mix("#fff7d6", "#fde047", t / 0.5)
      : mix("#fde047", "#facc15", (t - 0.5) / 0.5);
  const outer =
    t < 0.5
      ? mix("#fde68a", "#fbbf24", t / 0.5)
      : mix("#fbbf24", "#f97316", (t - 0.5) / 0.5);
  const glowColor = mix("#fde68a", "#f97316", t);
  const glowAlpha = 0.25 + 0.45 * t;
  const textColor = t > 0.55 ? "#7c2d12" : "#92400e";

  return {
    background: `radial-gradient(circle at 30% 30%, ${inner} 0%, ${outer} 100%)`,
    ring: `1px solid ${mix("#fcd34d", "#ea580c", t)}`,
    text: textColor,
    glow: `0 0 ${6 + 14 * t}px ${hexToRgba(glowColor, glowAlpha)}, 0 1px 2px rgba(0,0,0,0.08)`,
    flameClass: t > 0.5 ? "text-orange-700" : "text-amber-700",
    pulse: streak >= 4,
  };
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(hex: string) {
  const v = hex.replace("#", "");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}
function hexToRgba(rgbOrHex: string, alpha: number): string {
  if (rgbOrHex.startsWith("rgb(")) {
    return rgbOrHex.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const { r, g, b } = hexToRgb(rgbOrHex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function StreakBadge({ streak, size = "md", className }: StreakBadgeProps) {
  const style = heatStyle(streak);
  const dim =
    size === "sm"
      ? "h-7 min-w-7 px-2 text-[11px]"
      : size === "lg"
        ? "h-10 min-w-10 px-3.5 text-base"
        : "h-8 min-w-8 px-3 text-[11px] sm:text-xs";
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div
      className={cn(
        "group/streak relative inline-flex items-center gap-1 rounded-full font-semibold transition-all",
        dim,
        className,
      )}
      style={{
        background: style.background,
        border: style.ring,
        color: style.text,
        boxShadow: style.glow,
        animation: streak > 0 ? "streak-bob 1.6s ease-in-out infinite" : undefined,
      }}
      aria-label={
        streak > 0
          ? `Publishing streak: ${streak} consecutive week${streak === 1 ? "" : "s"}`
          : "No active publishing streak"
      }
      title={
        streak > 0
          ? `${streak}-week publishing streak`
          : "Publish this week to start a streak"
      }
    >
      {streak > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 ${10 + Math.min(streak, 12) * 2}px ${hexToRgba("#f97316", 0.55)}`,
            animation: "streak-glow 1.6s ease-in-out infinite",
          }}
        />
      )}
      <span
        className="relative inline-flex items-center justify-center"
        style={{
          animation: streak > 0 ? "streak-flame 0.9s ease-in-out infinite" : undefined,
          transformOrigin: "50% 80%",
        }}
      >
        {streak > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              width: "140%",
              height: "140%",
              borderRadius: "9999px",
              background: `radial-gradient(circle, ${hexToRgba("#fde047", 0.6)} 0%, ${hexToRgba("#f97316", 0.2)} 55%, transparent 70%)`,
              filter: "blur(2px)",
              animation: "streak-flame-glow 0.9s ease-in-out infinite",
            }}
          />
        )}
        <Flame
          className={cn(
            iconSize,
            style.flameClass,
            "relative",
          )}
          strokeWidth={2.5}
          fill={streak > 0 ? "currentColor" : "none"}
        />
      </span>
      <span className="relative ml-0.5 whitespace-nowrap leading-none tabular-nums">{streak}-week publishing streak</span>
      <style>{`
        @keyframes streak-flame {
          0%, 100% { transform: scale(1) rotate(-3deg); }
          25% { transform: scale(1.18) rotate(4deg); }
          50% { transform: scale(1.08) rotate(-2deg); }
          75% { transform: scale(1.22) rotate(3deg); }
        }
        @keyframes streak-flame-glow {
          0%, 100% { opacity: 0.55; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes streak-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes streak-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

