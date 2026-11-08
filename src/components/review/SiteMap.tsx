import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import geo from "@/data/geo-nordics.json";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { cityCoord } from "@/lib/data/geo";
import type { SiteSummary } from "@/lib/engine/metrics";
import { fmtNum, fmtPct } from "@/lib/engine/format";
import { STATUS_META } from "@/lib/ui/palette";
import { shortSiteName } from "@/lib/ui/names";
import type { TokenColors } from "@/lib/ui/use-token-colors";

export type MapColorBy = "status" | "utilization" | "washRhythm" | "co2";

type Ring = number[][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
const FEATURES = (geo as { features: Array<{ properties: { iso: string; name: string }; geometry: Geometry }> }).features;

const W = 1000;

/**
 * Lightweight SVG map (no tiles, works offline and in exports). Equirectangular
 * projection corrected by the cosine of the mid latitude.
 */
export function SiteMap({
  sites,
  colors,
  colorBy,
  selectedId,
  onSelect,
  washTarget,
  className,
}: {
  sites: SiteSummary[];
  colors: TokenColors;
  colorBy: MapColorBy;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  washTarget: number;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const placed = useMemo(
    () =>
      sites
        .map((s) => ({ s, c: cityCoord(s.site.city) }))
        .filter((x): x is { s: SiteSummary; c: [number, number] } => !!x.c),
    [sites],
  );

  const view = useMemo(() => {
    const lons = placed.map((p) => p.c[0]);
    const lats = placed.map((p) => p.c[1]);
    const pad = 2.2;
    const lonMin = (lons.length ? Math.min(...lons) : 10) - pad;
    const lonMax = (lons.length ? Math.max(...lons) : 30) + pad;
    const latMin = (lats.length ? Math.min(...lats) : 50) - pad * 0.7;
    const latMax = (lats.length ? Math.max(...lats) : 66) + pad * 0.7;
    const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
    const spanX = (lonMax - lonMin) * k;
    const spanY = latMax - latMin;
    // Fit the whole region inside a wide, short box so the full map is visible without scrolling.
    const H = 380;
    const scale = Math.min(W / spanX, H / spanY);
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;
    const project = ([lon, lat]: number[]) => [offX + (lon - lonMin) * k * scale, offY + (latMax - lat) * scale] as const;
    return { project, H };
  }, [placed]);

  const paths = useMemo(() => {
    const ringPath = (ring: Ring) =>
      ring
        .map((pt, i) => {
          const [x, y] = view.project(pt);
          return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join("") + "Z";
    return FEATURES.map((f) => {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      return { iso: f.properties.iso, name: f.properties.name, d: polys.map((p) => p.map(ringPath).join("")).join("") };
    });
  }, [view]);

  const activeCountries = new Set(sites.map((s) => s.site.country));
  const maxWearers = Math.max(1, ...sites.map((s) => s.activity.wearerAssignmentsLatest));
  const co2Max = Math.max(1, ...sites.map((s) => s.impact.co2SavingKg));

  const colorFor = (s: SiteSummary) => {
    if (colorBy === "status") return s.status === "act" ? colors.act : s.status === "watch" ? colors.watch : colors.onTrack;
    if (colorBy === "utilization") {
      const u = s.activity.utilization;
      return u >= 0.88 ? colors.onTrack : u >= 0.8 ? colors.watch : colors.act;
    }
    if (colorBy === "washRhythm") {
      const r = s.activity.washesPerGarmentMonth / washTarget;
      return r >= 0.75 ? colors.onTrack : r >= 0.5 ? colors.watch : colors.act;
    }
    return colors.emissions;
  };
  const radiusFor = (s: SiteSummary) => {
    if (colorBy === "co2") return 8 + 18 * Math.sqrt(Math.max(0, s.impact.co2SavingKg) / co2Max);
    return 8 + 16 * Math.sqrt(s.activity.wearerAssignmentsLatest / maxWearers);
  };

  const hovered = placed.find((p) => p.s.site.id === hover);
  const hoveredXY = hovered ? view.project(hovered.c) : null;

  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${W} ${view.H}`} className="h-auto w-full" role="img" aria-label="Map of delivery sites">
        <g>
          {paths.map((p) => (
            <path
              key={p.iso}
              d={p.d}
              fill={activeCountries.has(p.name) ? colors.mutedBg : colors.background}
              stroke={colors.border}
              strokeWidth={0.8}
              strokeLinejoin="round"
              fillRule="evenodd"
            />
          ))}
        </g>
        <g>
          {placed
            .slice()
            .sort((x, y) => radiusFor(y.s) - radiusFor(x.s))
            .map(({ s, c }, i) => {
              const [x, y] = view.project(c);
              const r = radiusFor(s);
              const col = colorFor(s);
              const sel = selectedId === s.site.id || hover === s.site.id;
              return (
                <motion.g
                  key={s.site.id}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.02 * i }}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(s.site.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(s.site.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.site.name}: ${STATUS_META[s.status].label}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect?.(s.site.id);
                  }}
                >
                  {s.status === "act" && colorBy === "status" && (
                    <circle cx={x} cy={y} r={r + 5} fill={col} opacity={0.18} className="animate-pulse" />
                  )}
                  <circle cx={x} cy={y} r={r} fill={col} fillOpacity={sel ? 0.95 : 0.72} stroke={colors.card} strokeWidth={sel ? 2.5 : 1.5} />
                </motion.g>
              );
            })}
        </g>
      </svg>
      {hovered && hoveredXY && (
        <div
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-xl border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
          style={{ left: `${(hoveredXY[0] / W) * 100}%`, top: `calc(${(hoveredXY[1] / view.H) * 100}% - 0.75rem)` }}
        >
          <p className="text-sm font-semibold">{shortSiteName(hovered.s.site)}</p>
          <p className="text-muted-foreground">
            {hovered.s.site.siteType} · {hovered.s.site.country}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
            <dt className="text-muted-foreground">Wearer assignments</dt>
            <dd className="text-right tabular-nums">{fmtNum(hovered.s.activity.wearerAssignmentsLatest)}</dd>
            <dt className="text-muted-foreground">In active use</dt>
            <dd className="text-right tabular-nums">{fmtPct(hovered.s.activity.utilization, 1)}</dd>
            <dt className="text-muted-foreground">Washes / month</dt>
            <dd className="text-right tabular-nums">{fmtNum(hovered.s.activity.washesPerGarmentMonth, 2)}</dd>
            <dt className="text-muted-foreground">CO₂e saved</dt>
            <dd className="text-right tabular-nums">{fmtNum(hovered.s.impact.co2SavingKg / 1000, 1)} t</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
