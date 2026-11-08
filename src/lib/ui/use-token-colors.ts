import { useEffect, useState } from "react";
import { CHART_CLASSES, type ChartColorKey } from "./palette";
import { usePreferences } from "@/lib/state/preferences-store";

export type TokenColors = Record<ChartColorKey, string>;

const FALLBACK = Object.fromEntries(Object.keys(CHART_CLASSES).map((k) => [k, "currentColor"])) as TokenColors;

/** Resolves design-token utility classes to concrete rgb() strings for charts and exports. */
export function readTokenColors(): TokenColors {
  if (typeof document === "undefined") return FALLBACK;
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.visibility = "hidden";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);
  const out = {} as TokenColors;
  for (const [k, cls] of Object.entries(CHART_CLASSES)) {
    const span = document.createElement("span");
    span.className = cls;
    host.appendChild(span);
    out[k as ChartColorKey] = getComputedStyle(span).color;
  }
  host.remove();
  return out;
}

/** Converts any CSS colour (incl. oklch) to #RRGGBB via canvas. */
export function toHex(color: string): string {
  if (typeof document === "undefined") return "#000000";
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function useTokenColors(): TokenColors {
  const { theme, hydrated } = usePreferences();
  const [colors, setColors] = useState<TokenColors>(FALLBACK);
  useEffect(() => {
    // wait a frame so the theme class has been applied
    const id = requestAnimationFrame(() => setColors(readTokenColors()));
    return () => cancelAnimationFrame(id);
  }, [theme, hydrated]);
  return colors;
}
