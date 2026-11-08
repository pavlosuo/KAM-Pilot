import { CalendarClock, ChevronRight, House, Shirt, Truck, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { RecapFigure, RecapLink, RecapTone, RecapVisual } from "@/lib/engine/recap";
import type { HealthStatus } from "@/lib/engine/metrics";
import { RowLink, TargetLink } from "./DeepLink";

/**
 * Recap visuals. They render their final state (so the page reads correctly
 * without animation); data-* hooks tell the scroll timeline what to animate:
 * data-count (count up), data-grow-x (bars), data-pop (appear), data-dim
 * (turn grey), data-ring (fill a ring), data-orbit (rotate), data-draw (draw a line).
 */

export const TONE_TEXT: Record<RecapTone, string> = {
  navy: "text-lind-navy",
  blue: "text-lind-blue",
  green: "text-lind-green",
  red: "text-lind-red",
  orange: "text-lind-orange",
  pink: "text-lind-pink",
  turquoise: "text-lind-turquoise",
  purple: "text-lind-purple",
};
export const TONE_BG: Record<RecapTone, string> = {
  navy: "bg-lind-navy",
  blue: "bg-lind-blue",
  green: "bg-lind-green",
  red: "bg-lind-red",
  orange: "bg-lind-orange",
  pink: "bg-lind-pink",
  turquoise: "bg-lind-turquoise",
  purple: "bg-lind-purple",
};
export const TONE_BORDER: Record<RecapTone, string> = {
  navy: "border-lind-navy",
  blue: "border-lind-blue",
  green: "border-lind-green",
  red: "border-lind-red",
  orange: "border-lind-orange",
  pink: "border-lind-pink",
  turquoise: "border-lind-turquoise",
  purple: "border-lind-purple",
};
const STATUS_BG: Record<HealthStatus, string> = { "on-track": "bg-lind-green", watch: "bg-lind-orange", act: "bg-lind-red" };

/** Big number that counts up while scrolling. */
export function Counter({ figure, className }: { figure: RecapFigure; className?: string }) {
  return (
    <span
      className={cn("tabular-nums", className)}
      data-count={figure.value}
      data-decimals={figure.decimals}
      data-prefix={figure.prefix}
      data-suffix={figure.suffix}
    >
      {figure.text}
    </span>
  );
}

const ICONS: Record<"family" | "home" | "garment" | "truck", LucideIcon> = { family: Users, home: House, garment: Shirt, truck: Truck };

function IconGrid({ v, tone }: { v: Extract<RecapVisual, { kind: "icons" }>; tone: RecapTone }) {
  const Icon = ICONS[v.icon];
  const n = Math.max(1, Math.min(100, v.count));
  const size =
    n <= 8 ? "h-16 w-16 sm:h-20 sm:w-20 lg:h-28 lg:w-28" : n <= 24 ? "h-11 w-11 sm:h-14 sm:w-14 lg:h-16 lg:w-16" : n <= 50 ? "h-8 w-8 sm:h-11 sm:w-11 lg:h-12 lg:w-12" : "h-6 w-6 sm:h-8 sm:w-8 lg:h-9 lg:w-9";
  const dimFrom = n - (v.dim ?? 0);
  return (
    <figure className="w-full">
      <div className={cn("flex flex-wrap justify-center", n <= 24 ? "gap-3" : "gap-1.5")} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <Icon key={i} data-pop className={cn(size, i >= dimFrom ? "text-lind-silver" : TONE_TEXT[tone])} {...(i >= dimFrom ? { "data-dim": "" } : {})} strokeWidth={1.8} />
        ))}
      </div>
      <figcaption className="mt-5 text-center text-base font-semibold text-lind-grey lg:text-lg">{v.caption}</figcaption>
    </figure>
  );
}

function Stack({ v }: { v: Extract<RecapVisual, { kind: "stack" }> }) {
  const total = v.parts.reduce((t, p) => t + p.value, 0) || 1;
  return (
    <figure className="w-full space-y-5">
      <div className="flex h-16 w-full overflow-hidden rounded-md bg-lind-mist sm:h-20 lg:h-24" aria-hidden="true">
        {v.parts.map((p) => (
          <div key={p.label} data-grow-x className={cn("h-full border-r-2 border-card last:border-r-0", TONE_BG[p.tone])} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="space-y-3">
        {v.parts.map((p) => (
          <li key={p.label} data-pop>
            <RowLink link={p.link} className="py-1">
              <span className="flex items-center gap-3 text-base sm:text-lg">
                <span className={cn("h-4 w-4 shrink-0 rounded-sm", TONE_BG[p.tone])} />
                <span className="min-w-0 flex-1 text-lind-ink">{p.label}</span>
                <span className="shrink-0 font-bold tabular-nums text-lind-navy">{p.text}</span>
              </span>
            </RowLink>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Earth({ v }: { v: Extract<RecapVisual, { kind: "earth" }> }) {
  const laps = Math.max(0, v.laps);
  const turns = Math.min(4, Math.max(0.6, laps));
  const shown = laps >= 10 ? Math.round(laps) : Math.round(laps * 10) / 10;
  const decimals = laps >= 10 ? 0 : 1;
  return (
    <figure className="flex w-full flex-col items-center">
      <div className="relative h-60 w-60 sm:h-72 sm:w-72 lg:h-80 lg:w-80">
        <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden="true">
          <circle cx="120" cy="120" r="112" fill="none" className="stroke-lind-line" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx="120" cy="120" r="82" className="fill-lind-blue/10 stroke-lind-blue" strokeWidth="3" />
          <ellipse cx="120" cy="120" rx="34" ry="82" fill="none" className="stroke-lind-blue/30" strokeWidth="2" />
          <ellipse cx="120" cy="120" rx="82" ry="30" fill="none" className="stroke-lind-blue/30" strokeWidth="2" />
          <path d="M 120 8 A 112 112 0 1 1 119.9 8" fill="none" className="stroke-lind-green" strokeWidth="5" strokeLinecap="round" data-draw />
          <g data-orbit data-turns={turns}>
            <circle cx="120" cy="8" r="11" className="fill-lind-green" />
            <circle cx="120" cy="8" r="4" className="fill-white" />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Counter figure={{ value: shown, decimals, prefix: "×", suffix: "", text: `×${shown.toFixed(decimals)}` }} className="text-5xl font-bold text-lind-navy sm:text-6xl lg:text-7xl" />
        </div>
      </div>
      <figcaption className="mt-3 text-center text-base font-semibold text-lind-grey lg:text-lg">Times around the Earth (40,075 km) in a new car</figcaption>
    </figure>
  );
}

function Ring({ v }: { v: Extract<RecapVisual, { kind: "ring" }> }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const val = Math.max(0, Math.min(1, v.value));
  const pctDecimals = val * 100 < 10 ? 1 : 0;
  const pct = Number((val * 100).toFixed(pctDecimals));
  return (
    <figure className="flex w-full flex-col items-center">
      <div className="relative h-60 w-60 sm:h-72 sm:w-72 lg:h-80 lg:w-80">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r={r} fill="none" className="stroke-lind-mist" strokeWidth="18" />
          <circle cx="100" cy="100" r={r} fill="none" className={cn(TONE_TEXT[v.tone], "stroke-current")} strokeWidth="18" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - val)} data-ring={val} data-circ={c} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Counter figure={{ value: pct, decimals: pctDecimals, prefix: "", suffix: "%", text: `${pct.toFixed(pctDecimals)}%` }} className="text-4xl font-bold text-lind-navy sm:text-5xl lg:text-6xl" />
          <span className="mt-1 text-base font-semibold text-lind-grey lg:text-lg">{v.label}</span>
        </div>
      </div>
    </figure>
  );
}

function Sites({ v }: { v: Extract<RecapVisual, { kind: "sites" }> }) {
  const showLabels = v.sites.length <= 30;
  return (
    <figure className="w-full">
      <ul className={cn("grid w-full gap-x-2 gap-y-4", v.sites.length > 16 ? "grid-cols-6" : v.sites.length > 8 ? "grid-cols-4" : "grid-cols-3")}>
        {v.sites.map((s, i) => (
          <li key={`${s.name}-${i}`} className="min-w-0">
            <SiteDot site={s} showLabel={showLabels} />
          </li>
        ))}
      </ul>
      <figcaption className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-base text-lind-grey">
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full bg-lind-green" /> On track
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full bg-lind-orange" /> Watch
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full bg-lind-red" /> Act
        </span>
      </figcaption>
    </figure>
  );
}

function SiteDot({ site: s, showLabel }: { site: Extract<RecapVisual, { kind: "sites" }>["sites"][number]; showLabel: boolean }) {
  const state = s.status === "act" ? "act now" : s.status === "watch" ? "watch closely" : "on track";
  const body = (
    <>
      <span className="relative block h-9 w-9 rounded-full bg-lind-line transition-transform group-hover:scale-110 sm:h-11 sm:w-11 lg:h-12 lg:w-12">
        <span data-pop className={cn("absolute inset-0 rounded-full ring-lind-blue ring-offset-2 ring-offset-card transition-shadow group-hover:ring-2", STATUS_BG[s.status])} />
      </span>
      {showLabel && <span className="w-full truncate text-center text-xs font-semibold text-lind-grey group-hover:text-lind-blue sm:text-sm">{s.name}</span>}
    </>
  );
  if (!s.siteId) return <span className="flex flex-col items-center gap-1.5" title={`${s.name}: ${state}`}>{body}</span>;
  return (
    <TargetLink target={{ page: "site", siteId: s.siteId }} title={`${s.name}: ${state} - open the site`} className="group flex flex-col items-center gap-1.5 rounded-lg py-1 focus-visible:outline-2">
      {body}
    </TargetLink>
  );
}

function Bars({ v }: { v: Extract<RecapVisual, { kind: "bars" }> }) {
  const max = Math.max(...v.bars.map((b) => b.value), 0) || 1;
  return (
    <figure className="w-full">
      <ul className="space-y-4">
        {v.bars.map((b) => (
          <li key={b.label}>
            <RowLink link={b.link} className="py-1">
              <span className="flex flex-col gap-3">
                <span className="min-w-0 break-words text-base font-semibold text-lind-ink sm:text-lg">{b.label}</span>
                <span className="flex items-center gap-3">
                  <span className="h-9 min-w-0 flex-1 rounded-sm bg-lind-mist sm:h-11 lg:h-12">
                    <span data-grow-x className={cn("block h-full rounded-sm", TONE_BG[b.tone])} style={{ width: `${Math.max(b.value > 0 ? 2 : 0, (b.value / max) * 100)}%` }} />
                  </span>
                  <span data-pop className="min-w-16 text-right text-base font-bold tabular-nums text-lind-navy sm:text-lg">
                    {b.text}
                  </span>
                </span>
              </span>
            </RowLink>
          </li>
        ))}
      </ul>
      {v.caption && <figcaption className="mt-5 text-base text-lind-grey lg:text-lg">{v.caption}</figcaption>}
    </figure>
  );
}

function Steps({ v }: { v: Extract<RecapVisual, { kind: "steps" }> }) {
  return (
    <figure className="relative w-full">
      <span className="absolute bottom-6 left-6 top-6 w-1 origin-top rounded-full bg-lind-navy/20" data-grow-y aria-hidden="true" />
      <ol className="relative space-y-4">
        {v.steps.map((s, i) => (
          <li key={s.title} data-pop className="flex gap-4">
            <span className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lind-navy text-xl font-bold text-white">{i + 1}</span>
            <CardLink link={s.link}>
              <span className="block break-words text-lg font-bold leading-snug text-lind-ink">{s.title}</span>
              <span className="eyebrow mt-2 inline-block rounded-full bg-lind-navy/10 px-2 py-0.5 text-lind-navy">{s.owner === "Shared" ? "Together" : s.owner}</span>
            </CardLink>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** White answer card; when it has a detail page the whole card opens it. */
function CardLink({ link, children, className }: { link?: RecapLink; children: ReactNode; className?: string }) {
  const base = cn("min-w-0 flex-1 rounded-lg bg-card p-4 shadow-lind", className);
  if (!link) return <span className={base}>{children}</span>;
  return (
    <TargetLink
      target={link.to}
      title={`Open ${link.label}`}
      className={cn(base, "group relative flex items-center gap-3 border-2 border-transparent transition-colors hover:border-lind-blue/40 focus-visible:outline-2")}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight className="h-5 w-5 shrink-0 text-lind-blue opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
    </TargetLink>
  );
}

function Targets({ v }: { v: Extract<RecapVisual, { kind: "targets" }> }) {
  return (
    <ul className="w-full space-y-3">
      {v.items.map((t) => (
        <li key={t.kpi} data-pop className="flex">
          <CardLink link={t.link}>
            <span className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3">
              <span className="min-w-0 text-lg font-semibold text-lind-ink">{t.kpi}</span>
              <span className="text-xl font-bold tabular-nums text-lind-grey">{t.current}</span>
              <span className="text-xl text-lind-silver" aria-label="to">
                →
              </span>
              <span className="text-xl font-bold tabular-nums text-lind-green">{t.target}</span>
            </span>
          </CardLink>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ v }: { v: Extract<RecapVisual, { kind: "timeline" }> }) {
  return (
    <ol className="w-full space-y-3">
      {v.items.map((t) => (
        <li key={`${t.when}-${t.title}`} data-pop className="flex">
          <CardLink link={t.link}>
            <span className="flex gap-4">
              <CalendarClock className="mt-1 h-6 w-6 shrink-0 text-lind-purple" />
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-snug text-lind-ink">{t.title}</span>
                <span className="text-base text-lind-grey">
                  {t.when} · {t.status}
                </span>
              </span>
            </span>
          </CardLink>
        </li>
      ))}
    </ol>
  );
}

export function RecapVisualView({ visual, tone }: { visual: RecapVisual; tone: RecapTone }) {
  switch (visual.kind) {
    case "icons":
      return <IconGrid v={visual} tone={tone} />;
    case "stack":
      return <Stack v={visual} />;
    case "earth":
      return <Earth v={visual} />;
    case "ring":
      return <Ring v={visual} />;
    case "sites":
      return <Sites v={visual} />;
    case "bars":
      return <Bars v={visual} />;
    case "steps":
      return <Steps v={visual} />;
    case "targets":
      return <Targets v={visual} />;
    case "timeline":
      return <Timeline v={visual} />;
  }
}
