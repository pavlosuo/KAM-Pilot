import type { RecapBeat, RecapTone, RecapVisual } from "@/lib/engine/recap";
import type { HealthStatus } from "@/lib/engine/metrics";
import type { Deck, DeckSlide } from "./deck";
import type { HexPalette } from "./colors";

/**
 * Renderer-neutral slide layout. Every slide becomes a list of simple drawing
 * operations in inches on a 16:9 page; the PowerPoint, PDF and on-screen
 * painters only translate these operations, so all three look the same.
 */

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
const M = 0.6;

export type Align = "left" | "center" | "right";

export type Op =
  | { op: "rect"; x: number; y: number; w: number; h: number; fill?: string; line?: string; lineW?: number; radius?: number }
  | { op: "ellipse"; x: number; y: number; w: number; h: number; fill?: string; line?: string; lineW?: number; dash?: boolean }
  | { op: "tri"; x: number; y: number; w: number; h: number; fill: string }
  /** Ring segment: angles in degrees clockwise from 12 o'clock. */
  | { op: "arc"; cx: number; cy: number; r: number; thick: number; from: number; to: number; fill: string }
  | {
      op: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      size: number;
      color: string;
      bold?: boolean;
      italic?: boolean;
      align?: Align;
      valign?: "top" | "middle";
      caps?: boolean;
      spacing?: number;
    };

export interface SlideOps {
  bg: string;
  ops: Op[];
}

/** Width of a text run in points. */
export type Measure = (text: string, size: number, bold: boolean) => number;

/** Line height multiple shared by all painters. */
export const LINE_HEIGHT = 1.22;

/** Largest font size (pt) at which the text fits the box when wrapped by words. */
export function fittedTextSize(text: string, width: number, height: number, preferred: number, measure: (text: string, size: number) => number, min = 6): number {
  const fits = (size: number) => {
    const available = width * 72 * 0.95;
    let lines = 0;
    for (const paragraph of text.split("\n")) {
      let line = "";
      lines += 1;
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (measure(word, size) > available) return false;
        const candidate = line ? `${line} ${word}` : word;
        if (line && measure(candidate, size) > available) {
          lines += 1;
          line = word;
        } else line = candidate;
      }
    }
    return lines * size * LINE_HEIGHT <= height * 72 * 0.96;
  };
  let size = preferred;
  while (size > min && !fits(size)) size -= 0.5;
  return size;
}

/** Wraps text into lines that fit `width` inches at `size` points. */
export function wrapLines(text: string, width: number, size: number, bold: boolean, measure: Measure): string[] {
  const out: string[] = [];
  const available = width * 72 * 0.98;
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate, size, bold) > available) {
        out.push(line);
        line = word;
      } else line = candidate;
    }
    out.push(line);
  }
  return out;
}

/** Ring segment path (angles clockwise from 12 o'clock), in points. */
export function arcPath(cx: number, cy: number, r: number, thick: number, from: number, to: number) {
  const pt = (rad: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${cx + rad * Math.sin(a)} ${cy - rad * Math.cos(a)}`;
  };
  const ri = Math.max(0, r - thick);
  const large = to - from > 180 ? 1 : 0;
  return `M ${pt(r, from)} A ${r} ${r} 0 ${large} 1 ${pt(r, to)} L ${pt(ri, to)} A ${ri} ${ri} 0 ${large} 0 ${pt(ri, from)} Z`;
}

/** Mixes two #rrggbb colours (t = share of `b`). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/* ----------------------------------------------------------------------------
 * Pictograms (unit box 0..1), drawn with simple shapes so every renderer can
 * paint them natively.
 * ------------------------------------------------------------------------- */

type Prim = { t: "ellipse" | "rect" | "tri"; x: number; y: number; w: number; h: number; r?: number; cut?: boolean };

export const PICTOGRAMS: Record<"family" | "home" | "garment" | "truck", Prim[]> = {
  family: [
    { t: "ellipse", x: 0.31, y: 0.02, w: 0.38, h: 0.38 },
    { t: "rect", x: 0.16, y: 0.44, w: 0.68, h: 0.54, r: 0.45 },
  ],
  home: [
    { t: "tri", x: 0, y: 0.04, w: 1, h: 0.46 },
    { t: "rect", x: 0.14, y: 0.46, w: 0.72, h: 0.52 },
    { t: "rect", x: 0.42, y: 0.66, w: 0.16, h: 0.32, cut: true },
  ],
  garment: [
    { t: "rect", x: 0.02, y: 0.12, w: 0.96, h: 0.3, r: 0.3 },
    { t: "rect", x: 0.2, y: 0.12, w: 0.6, h: 0.86, r: 0.08 },
    { t: "ellipse", x: 0.37, y: 0.02, w: 0.26, h: 0.2, cut: true },
  ],
  truck: [
    { t: "rect", x: 0, y: 0.16, w: 0.62, h: 0.54, r: 0.08 },
    { t: "rect", x: 0.64, y: 0.34, w: 0.36, h: 0.36, r: 0.18 },
    { t: "rect", x: 0.72, y: 0.41, w: 0.16, h: 0.12, cut: true },
    { t: "ellipse", x: 0.08, y: 0.62, w: 0.26, h: 0.26 },
    { t: "ellipse", x: 0.66, y: 0.62, w: 0.26, h: 0.26 },
  ],
};

function pictogram(ops: Op[], kind: keyof typeof PICTOGRAMS, x: number, y: number, size: number, color: string, bg: string) {
  for (const p of PICTOGRAMS[kind]) {
    const px = x + p.x * size;
    const py = y + p.y * size;
    const pw = p.w * size;
    const ph = p.h * size;
    const fill = p.cut ? bg : color;
    if (p.t === "ellipse") ops.push({ op: "ellipse", x: px, y: py, w: pw, h: ph, fill });
    else if (p.t === "tri") ops.push({ op: "tri", x: px, y: py, w: pw, h: ph, fill });
    else ops.push({ op: "rect", x: px, y: py, w: pw, h: ph, fill, radius: p.r ? p.r * Math.min(pw, ph) : undefined });
  }
}

/* ----------------------------------------------------------------------------
 * Layout
 * ------------------------------------------------------------------------- */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

class Builder {
  ops: Op[] = [];
  constructor(
    readonly P: HexPalette,
    readonly measure: Measure,
    readonly bg: string,
  ) {}
  /** Adds a text box at the largest size (≤ preferred) that fits. */
  text(text: string, b: Box, o: { size: number; color: string; bold?: boolean; italic?: boolean; align?: Align; valign?: "top" | "middle"; caps?: boolean; spacing?: number; min?: number }) {
    const t = o.caps ? text.toUpperCase() : text;
    if (!t.trim()) return 0;
    const size = fittedTextSize(t, b.w, b.h, o.size, (v, s) => this.measure(v, s, !!o.bold) + (o.spacing ? v.length * o.spacing : 0), o.min);
    this.ops.push({ op: "text", ...b, text: t, size, color: o.color, bold: o.bold, italic: o.italic, align: o.align, valign: o.valign, caps: o.caps, spacing: o.spacing });
    return size;
  }
  /** Height (in) a text would use at `size` within `w`. */
  textHeight(text: string, w: number, size: number, bold = false) {
    return (wrapLines(text, w, size, bold, this.measure).length * size * LINE_HEIGHT) / 72;
  }
  rect(b: Box, o: { fill?: string; line?: string; lineW?: number; radius?: number }) {
    this.ops.push({ op: "rect", ...b, ...o });
  }
  ellipse(b: Box, o: { fill?: string; line?: string; lineW?: number; dash?: boolean }) {
    this.ops.push({ op: "ellipse", ...b, ...o });
  }
}

const TONE_KEY: Record<RecapTone, keyof HexPalette> = {
  navy: "navy",
  blue: "blue",
  green: "green",
  red: "red",
  orange: "orange",
  pink: "pink",
  turquoise: "turquoise",
  purple: "purple",
};
const STATUS_KEY: Record<HealthStatus, keyof HexPalette> = { "on-track": "green", watch: "orange", act: "red" };

function footer(b: Builder, deck: Deck, index: number, dark: boolean) {
  const color = dark ? mix(b.P.navy, b.P.card, 0.65) : b.P.grey;
  b.text(deck.footer, { x: M, y: SLIDE_H - 0.42, w: SLIDE_W - 2 * M - 1, h: 0.26 }, { size: 9, color });
  b.text(String(index + 1), { x: SLIDE_W - M - 0.8, y: SLIDE_H - 0.42, w: 0.8, h: 0.26 }, { size: 9, color, align: "right" });
}

function cover(b: Builder, s: Extract<DeckSlide, { kind: "cover" }>) {
  const { P } = b;
  const soft = mix(P.navy, P.card, 0.85);
  b.rect({ x: 0, y: 0, w: SLIDE_W, h: 0.12 }, { fill: P.red });
  b.text(s.company, { x: M, y: 0.75, w: 9, h: 0.5 }, { size: 22, bold: true, color: P.card });
  b.text(s.period, { x: M, y: 1.45, w: SLIDE_W - 2 * M, h: 1.55 }, { size: 104, bold: true, color: P.card });
  b.text("with Lindström", { x: M, y: 2.95, w: SLIDE_W - 2 * M, h: 0.95 }, { size: 54, bold: true, color: soft });
  b.text(`Prepared for ${s.preparedFor} · ${s.scope}`, { x: M, y: 4.1, w: SLIDE_W - 2 * M, h: 0.5 }, { size: 20, color: soft });
  const gap = 0.35;
  const cw = (SLIDE_W - 2 * M - gap * 3) / 4;
  s.stats.slice(0, 4).forEach((st, i) => {
    const x = M + i * (cw + gap);
    b.rect({ x, y: 5.2, w: cw, h: 0.06 }, { fill: P.card });
    b.text(st.value, { x, y: 5.4, w: cw, h: 0.8 }, { size: 44, bold: true, color: P.card });
    b.text(st.label, { x, y: 6.25, w: cw, h: 0.6 }, { size: 15, color: soft });
  });
}

function question(b: Builder, s: Extract<DeckSlide, { kind: "question" }>) {
  const { P } = b;
  b.ellipse({ x: M, y: 2.3, w: 1.25, h: 1.25 }, { fill: P.navy });
  b.text(String(s.number), { x: M, y: 2.3, w: 1.25, h: 1.25 }, { size: 46, bold: true, color: P.card, align: "center", valign: "middle" });
  b.rect({ x: M + 1.7, y: 2.3, w: 1.1, h: 0.1 }, { fill: P.red });
  b.text(s.question, { x: M + 1.7, y: 2.6, w: SLIDE_W - 2 * M - 1.7, h: 2.9 }, { size: 54, bold: true, color: P.navy });
}

function beatHeader(b: Builder, s: Extract<DeckSlide, { kind: "beat" }>) {
  const { P } = b;
  b.ellipse({ x: M, y: 0.4, w: 0.55, h: 0.55 }, { fill: P.navy });
  b.text(String(s.number), { x: M, y: 0.4, w: 0.55, h: 0.55 }, { size: 17, bold: true, color: P.card, align: "center", valign: "middle" });
  b.text(s.question, { x: M + 0.75, y: 0.4, w: SLIDE_W - 2 * M - 0.75, h: 0.55 }, { size: 21, bold: true, color: P.navy, valign: "middle" });
  const track = { x: M, y: 1.15, w: SLIDE_W - 2 * M, h: 0.06 };
  b.rect(track, { fill: s.tone === "mist" ? mix(P.line, P.card, 0.2) : P.line, radius: 0.03 });
  b.rect({ ...track, w: (track.w * s.step) / s.steps }, { fill: P.red, radius: 0.03 });
}

function beatText(b: Builder, beat: RecapBeat, area: Box, cardFill: string) {
  const { P } = b;
  const tone = P[TONE_KEY[beat.tone]];
  let y = area.y;
  b.text(beat.kicker, { x: area.x, y, w: area.w, h: 0.34 }, { size: 13, bold: true, color: tone, caps: true, spacing: 1.2 });
  y += 0.45;
  if (beat.figure) {
    b.text(beat.figure.text, { x: area.x, y, w: area.w, h: 1.2 }, { size: 80, bold: true, color: P.navy, min: 30 });
    y += 1.25;
    if (beat.unit) {
      b.text(beat.unit, { x: area.x, y, w: area.w, h: 0.5 }, { size: 25, bold: true, color: P.navy });
      y += 0.6;
    }
    const hs = 20;
    const hh = Math.min(1.0, b.textHeight(beat.headline, area.w, hs) + 0.05);
    b.text(beat.headline, { x: area.x, y, w: area.w, h: hh }, { size: hs, color: P.ink });
    y += hh + 0.2;
  } else {
    const hs = 32;
    const hh = Math.min(2.0, b.textHeight(beat.headline, area.w, hs, true) + 0.05);
    b.text(beat.headline, { x: area.x, y, w: area.w, h: hh }, { size: hs, bold: true, color: P.navy });
    y += hh + 0.3;
  }
  if (beat.comparison) {
    const inner = area.w - 0.45;
    const cs = 17;
    const ch = Math.min(1.5, b.textHeight(beat.comparison, inner, cs, true) + 0.36);
    b.rect({ x: area.x, y, w: area.w, h: ch }, { fill: cardFill, line: P.line, lineW: 0.75 });
    b.rect({ x: area.x, y, w: 0.09, h: ch }, { fill: tone });
    b.text(beat.comparison, { x: area.x + 0.3, y: y + 0.14, w: inner, h: ch - 0.26 }, { size: cs, bold: true, color: P.ink, valign: "middle" });
    y += ch + 0.22;
  }
  const left = area.y + area.h - y;
  if (beat.note && left > 0.3) b.text(beat.note, { x: area.x, y, w: area.w, h: Math.min(0.75, left) }, { size: 11, color: P.grey });
}

function visual(b: Builder, v: RecapVisual, toneName: RecapTone, a: Box, cardFill: string) {
  const { P } = b;
  const tone = P[TONE_KEY[toneName]];
  // Empty tracks must stay visible on grey slides.
  const track = b.bg === P.mist ? P.line : P.mist;
  switch (v.kind) {
    case "stack": {
      const total = v.parts.reduce((t, p) => t + p.value, 0) || 1;
      const bar = { x: a.x, y: a.y + 0.25, w: a.w, h: 0.95 };
      b.rect(bar, { fill: track, radius: 0.08 });
      let x = bar.x;
      v.parts.forEach((p) => {
        const w = (bar.w * p.value) / total;
        if (w > 0.005) b.rect({ x, y: bar.y, w, h: bar.h }, { fill: P[TONE_KEY[p.tone]], line: b.bg, lineW: 1.5 });
        x += w;
      });
      const rowH = Math.min(0.68, (a.h - 1.55) / Math.max(1, v.parts.length));
      v.parts.forEach((p, i) => {
        const y = a.y + 1.55 + i * rowH;
        b.rect({ x: a.x, y: y + (rowH - 0.26) / 2, w: 0.26, h: 0.26 }, { fill: P[TONE_KEY[p.tone]], radius: 0.05 });
        b.text(p.label, { x: a.x + 0.45, y, w: a.w - 0.45 - 1.65, h: rowH }, { size: 16, color: P.ink, valign: "middle" });
        b.text(p.text, { x: a.x + a.w - 1.6, y, w: 1.6, h: rowH }, { size: 18, bold: true, color: P.navy, align: "right", valign: "middle" });
      });
      return;
    }
    case "icons": {
      const n = Math.max(1, Math.min(100, Math.round(v.count)));
      const capH = 0.5;
      const gh = a.h - capH - 0.15;
      const cols = n <= 4 ? n : n <= 8 ? 4 : Math.max(1, Math.ceil(Math.sqrt((n * a.w) / gh)));
      const rows = Math.ceil(n / cols);
      const cell = Math.min(1.4, a.w / cols, gh / rows);
      const size = cell * 0.76;
      const ox = a.x + (a.w - cols * cell) / 2;
      const oy = a.y + (gh - rows * cell) / 2;
      const dimFrom = n - Math.max(0, Math.min(n, Math.round(v.dim ?? 0)));
      for (let i = 0; i < n; i++) {
        const cx = ox + (i % cols) * cell + (cell - size) / 2;
        const cy = oy + Math.floor(i / cols) * cell + (cell - size) / 2;
        pictogram(b.ops, v.icon, cx, cy, size, i >= dimFrom ? P.silver : tone, b.bg);
      }
      b.text(v.caption, { x: a.x, y: a.y + a.h - capH, w: a.w, h: capH }, { size: 15, bold: true, color: P.grey, align: "center", valign: "middle" });
      return;
    }
    case "earth": {
      const capH = 0.5;
      const d = Math.min(a.w, a.h - capH - 0.1) * 0.94;
      const r = d / 2;
      const cx = a.x + a.w / 2;
      const cy = a.y + (a.h - capH) / 2;
      b.ellipse({ x: cx - r, y: cy - r, w: d, h: d }, { line: P.green, lineW: 4 });
      const g = r * 0.73;
      b.ellipse({ x: cx - g, y: cy - g, w: 2 * g, h: 2 * g }, { fill: mix(P.blue, b.bg, 0.9), line: P.blue, lineW: 2.5 });
      const meridian = mix(P.blue, b.bg, 0.7);
      b.ellipse({ x: cx - g * 0.42, y: cy - g, w: g * 0.84, h: 2 * g }, { line: meridian, lineW: 1.5 });
      b.ellipse({ x: cx - g, y: cy - g * 0.37, w: 2 * g, h: g * 0.74 }, { line: meridian, lineW: 1.5 });
      b.ellipse({ x: cx - 0.16, y: cy - r - 0.16, w: 0.32, h: 0.32 }, { fill: P.green });
      b.ellipse({ x: cx - 0.06, y: cy - r - 0.06, w: 0.12, h: 0.12 }, { fill: P.card });
      const laps = Math.max(0, v.laps);
      const shown = laps >= 10 ? Math.round(laps).toLocaleString("en-US") : (Math.round(laps * 10) / 10).toFixed(1);
      b.text(`×${shown}`, { x: cx - g, y: cy - 0.55, w: 2 * g, h: 1.1 }, { size: 60, bold: true, color: P.navy, align: "center", valign: "middle" });
      b.text("Times around the Earth (40,075 km) in a new car", { x: a.x, y: a.y + a.h - capH, w: a.w, h: capH }, { size: 15, bold: true, color: P.grey, align: "center", valign: "middle" });
      return;
    }
    case "ring": {
      const d = Math.min(a.w, a.h) * 0.86;
      const r = d / 2;
      const cx = a.x + a.w / 2;
      const cy = a.y + a.h / 2;
      const thick = d * 0.1;
      const val = Math.max(0, Math.min(1, v.value));
      // Full circles are drawn as thick outlines: office apps render near-360° block arcs unreliably.
      const ring = (fill: string) => b.ellipse({ x: cx - r + thick / 2, y: cy - r + thick / 2, w: 2 * r - thick, h: 2 * r - thick }, { line: fill, lineW: thick * 72 });
      ring(track);
      if (val >= 0.998) ring(P[TONE_KEY[v.tone]]);
      else if (val > 0.002) b.ops.push({ op: "arc", cx, cy, r, thick, from: 0, to: val * 360, fill: P[TONE_KEY[v.tone]] });
      const pct = val * 100 < 10 ? (val * 100).toFixed(1) : String(Math.round(val * 100));
      b.text(`${pct}%`, { x: cx - r * 0.75, y: cy - 0.75, w: r * 1.5, h: 0.95 }, { size: 52, bold: true, color: P.navy, align: "center", valign: "middle" });
      b.text(v.label, { x: cx - r * 0.75, y: cy + 0.25, w: r * 1.5, h: 0.6 }, { size: 16, bold: true, color: P.grey, align: "center" });
      return;
    }
    case "sites": {
      const n = v.sites.length;
      const cols = n > 36 ? 8 : n > 16 ? 6 : n > 8 ? 4 : 3;
      const rows = Math.max(1, Math.ceil(n / cols));
      const legendH = 0.45;
      const labels = n <= 30;
      const cellW = a.w / cols;
      const cellH = Math.min(1.1, (a.h - legendH - 0.15) / rows);
      const labelH = labels ? 0.26 : 0;
      const dot = Math.max(0.12, Math.min(cellW * 0.5, cellH - labelH - 0.12, 0.62));
      const gridH = rows * cellH;
      const oy = a.y + (a.h - legendH - gridH) / 2;
      v.sites.forEach((s, i) => {
        const x = a.x + (i % cols) * cellW;
        const y = oy + Math.floor(i / cols) * cellH;
        b.ellipse({ x: x + (cellW - dot) / 2, y, w: dot, h: dot }, { fill: P[STATUS_KEY[s.status]] });
        if (labels) b.text(s.name, { x: x + 0.03, y: y + dot + 0.05, w: cellW - 0.06, h: labelH }, { size: 10, bold: true, color: P.grey, align: "center", min: 6.5 });
      });
      const items: Array<[HealthStatus, string]> = [
        ["on-track", "On track"],
        ["watch", "Watch"],
        ["act", "Act"],
      ];
      const iw = 1.5;
      const lx = a.x + (a.w - iw * items.length) / 2;
      items.forEach(([st, label], i) => {
        const x = lx + i * iw;
        const y = a.y + a.h - legendH + 0.08;
        b.ellipse({ x, y: y + 0.06, w: 0.2, h: 0.2 }, { fill: P[STATUS_KEY[st]] });
        b.text(label, { x: x + 0.3, y, w: iw - 0.35, h: 0.32 }, { size: 13, color: P.grey, valign: "middle" });
      });
      return;
    }
    case "bars": {
      const n = Math.max(1, v.bars.length);
      const capH = v.caption ? 0.5 : 0;
      const rowH = Math.min(1.05, (a.h - capH) / n);
      const max = Math.max(...v.bars.map((x) => x.value), 0) || 1;
      const valueW = 1.55;
      const oy = a.y + (a.h - capH - rowH * n) / 2;
      v.bars.forEach((bar, i) => {
        const y = oy + i * rowH;
        b.text(bar.label, { x: a.x, y, w: a.w, h: rowH * 0.4 }, { size: 16, bold: true, color: P.ink, valign: "middle" });
        const slot = { x: a.x, y: y + rowH * 0.44, w: a.w - valueW - 0.15, h: rowH * 0.38 };
        b.rect(slot, { fill: track, radius: 0.04 });
        const w = bar.value > 0 ? Math.max(0.05, (slot.w * bar.value) / max) : 0;
        if (w > 0) b.rect({ ...slot, w }, { fill: P[TONE_KEY[bar.tone]], radius: 0.04 });
        b.text(bar.text, { x: a.x + a.w - valueW, y: slot.y, w: valueW, h: slot.h }, { size: 18, bold: true, color: P.navy, align: "right", valign: "middle" });
      });
      if (v.caption) b.text(v.caption, { x: a.x, y: a.y + a.h - capH, w: a.w, h: capH }, { size: 14, color: P.grey, valign: "middle" });
      return;
    }
    case "steps": {
      const n = Math.max(1, v.steps.length);
      const rowH = Math.min(1.7, a.h / n);
      const oy = a.y + (a.h - rowH * n) / 2;
      const d = 0.62;
      if (n > 1) b.rect({ x: a.x + d / 2 - 0.03, y: oy + rowH / 2, w: 0.06, h: rowH * (n - 1) }, { fill: mix(P.navy, b.bg, 0.8) });
      v.steps.forEach((st, i) => {
        const y = oy + i * rowH;
        const ch = rowH - 0.2;
        b.ellipse({ x: a.x, y: y + (ch - d) / 2, w: d, h: d }, { fill: P.navy });
        b.text(String(i + 1), { x: a.x, y: y + (ch - d) / 2, w: d, h: d }, { size: 20, bold: true, color: P.card, align: "center", valign: "middle" });
        const cx = a.x + d + 0.25;
        const cw = a.w - d - 0.25;
        b.rect({ x: cx, y, w: cw, h: ch }, { fill: cardFill, line: P.line, lineW: 0.75, radius: 0.06 });
        b.text(st.title, { x: cx + 0.22, y: y + 0.14, w: cw - 0.44, h: ch - 0.62 }, { size: 16, bold: true, color: P.ink });
        const owner = (st.owner === "Shared" ? "Together" : st.owner).toUpperCase();
        const ow = Math.min(cw - 0.44, b.measure(owner, 9, true) / 72 + owner.length * 0.012 + 0.32);
        b.rect({ x: cx + 0.22, y: y + ch - 0.42, w: ow, h: 0.28 }, { fill: mix(P.navy, b.bg, 0.88), radius: 0.14 });
        b.text(owner, { x: cx + 0.22, y: y + ch - 0.42, w: ow, h: 0.28 }, { size: 9, bold: true, color: P.navy, align: "center", valign: "middle", spacing: 0.8 });
      });
      return;
    }
    case "targets": {
      const n = Math.max(1, v.items.length);
      const rowH = Math.min(1.05, a.h / n);
      const oy = a.y + (a.h - rowH * n) / 2;
      v.items.forEach((t, i) => {
        const y = oy + i * rowH;
        const h = rowH - 0.18;
        b.rect({ x: a.x, y, w: a.w, h }, { fill: cardFill, line: P.line, lineW: 0.75, radius: 0.06 });
        b.text(t.kpi, { x: a.x + 0.25, y, w: a.w - 3.4, h }, { size: 16, bold: true, color: P.ink, valign: "middle" });
        b.text(t.current, { x: a.x + a.w - 3.1, y, w: 1.25, h }, { size: 19, bold: true, color: P.grey, align: "right", valign: "middle" });
        b.text("→", { x: a.x + a.w - 1.8, y, w: 0.4, h }, { size: 19, color: P.silver, align: "center", valign: "middle" });
        b.text(t.target, { x: a.x + a.w - 1.4, y, w: 1.2, h }, { size: 19, bold: true, color: P.green, align: "right", valign: "middle" });
      });
      return;
    }
    case "timeline": {
      const n = Math.max(1, v.items.length);
      const rowH = Math.min(1.15, a.h / n);
      const oy = a.y + (a.h - rowH * n) / 2;
      v.items.forEach((t, i) => {
        const y = oy + i * rowH;
        const h = rowH - 0.18;
        b.rect({ x: a.x, y, w: a.w, h }, { fill: cardFill, line: P.line, lineW: 0.75, radius: 0.06 });
        const ix = a.x + 0.25;
        const iy = y + h / 2 - 0.2;
        b.rect({ x: ix, y: iy, w: 0.4, h: 0.4 }, { line: P.purple, lineW: 1.75, radius: 0.05 });
        b.rect({ x: ix, y: iy, w: 0.4, h: 0.11 }, { fill: P.purple });
        b.text(t.title, { x: a.x + 0.9, y: y + 0.1, w: a.w - 1.1, h: h * 0.56 }, { size: 16, bold: true, color: P.ink, valign: "middle" });
        b.text(`${t.when} · ${t.status}`, { x: a.x + 0.9, y: y + 0.1 + h * 0.56, w: a.w - 1.1, h: h * 0.36 }, { size: 12, color: P.grey });
      });
      return;
    }
  }
}

function beat(b: Builder, s: Extract<DeckSlide, { kind: "beat" }>) {
  beatHeader(b, s);
  const cardFill = s.tone === "mist" ? b.P.card : b.P.mist;
  const top = 1.6;
  const bottom = SLIDE_H - 0.7;
  const leftW = 5.45;
  beatText(b, s.beat, { x: M, y: top, w: leftW, h: bottom - top }, cardFill);
  const vx = M + leftW + 0.55;
  visual(b, s.beat.visual, s.beat.tone, { x: vx, y: top + 0.05, w: SLIDE_W - M - vx, h: bottom - top - 0.05 }, b.P.card);
}

function closing(b: Builder, s: Extract<DeckSlide, { kind: "closing" }>) {
  const { P } = b;
  const soft = mix(P.navy, P.card, 0.75);
  b.text(s.headline, { x: M, y: 0.8, w: SLIDE_W - 2 * M, h: 1.0 }, { size: 40, bold: true, color: P.card });
  b.text("What we propose", { x: M, y: 2.0, w: 6, h: 0.32 }, { size: 13, bold: true, color: soft, caps: true, spacing: 1.2 });
  const n = Math.max(1, s.actions.length);
  const rowH = Math.min(1.25, 4.3 / n);
  s.actions.forEach((t, i) => {
    const y = 2.5 + i * rowH;
    const h = rowH - 0.2;
    b.rect({ x: M, y, w: SLIDE_W - 2 * M, h }, { fill: mix(P.navy, P.card, 0.12), radius: 0.06 });
    b.ellipse({ x: M + 0.25, y: y + (h - 0.6) / 2, w: 0.6, h: 0.6 }, { fill: P.card });
    b.text(String(i + 1), { x: M + 0.25, y: y + (h - 0.6) / 2, w: 0.6, h: 0.6 }, { size: 19, bold: true, color: P.navy, align: "center", valign: "middle" });
    b.text(t, { x: M + 1.1, y: y + 0.08, w: SLIDE_W - 2 * M - 1.35, h: h - 0.16 }, { size: 19, color: P.card, valign: "middle" });
  });
}

function titled(b: Builder, title: string) {
  b.rect({ x: M, y: 0.45, w: 1.0, h: 0.09 }, { fill: b.P.red });
  b.text(title, { x: M, y: 0.7, w: SLIDE_W - 2 * M, h: 0.7 }, { size: 32, bold: true, color: b.P.navy });
}

function notes(b: Builder, s: Extract<DeckSlide, { kind: "notes" }>) {
  titled(b, s.title);
  b.text(s.text, { x: M, y: 1.7, w: SLIDE_W - 2 * M, h: 5.0 }, { size: 20, color: b.P.ink });
}

function sources(b: Builder, s: Extract<DeckSlide, { kind: "sources" }>) {
  const { P } = b;
  titled(b, s.title);
  const dh = Math.min(1.6, b.textHeight(s.disclosure, SLIDE_W - 2 * M, 17) + 0.1);
  b.text(s.disclosure, { x: M, y: 1.7, w: SLIDE_W - 2 * M, h: dh }, { size: 17, color: P.ink });
  if (!s.sources.length) return;
  let y = 1.7 + dh + 0.35;
  b.text("Everyday comparisons", { x: M, y, w: 6, h: 0.32 }, { size: 13, bold: true, color: P.grey, caps: true, spacing: 1.2 });
  y += 0.5;
  const rowH = Math.min(0.75, (SLIDE_H - 0.8 - y) / s.sources.length);
  for (const src of s.sources) {
    b.ellipse({ x: M, y: y + 0.12, w: 0.14, h: 0.14 }, { fill: P.red });
    b.text(src.label, { x: M + 0.35, y, w: SLIDE_W - 2 * M - 0.35, h: rowH * 0.55 }, { size: 15, bold: true, color: P.ink });
    b.text(src.url, { x: M + 0.35, y: y + rowH * 0.5, w: SLIDE_W - 2 * M - 0.35, h: rowH * 0.42 }, { size: 11, color: P.blue });
    y += rowH;
  }
}

/** Lays out every slide of the deck. */
export function layoutDeck(deck: Deck, P: HexPalette, measure: Measure): SlideOps[] {
  return deck.slides.map((s, i) => {
    const dark = s.kind === "cover" || s.kind === "closing";
    const bg = dark ? P.navy : (s.kind === "question" || s.kind === "beat") && s.tone === "mist" ? P.mist : P.card;
    const b = new Builder(P, measure, bg);
    switch (s.kind) {
      case "cover":
        cover(b, s);
        break;
      case "question":
        question(b, s);
        break;
      case "beat":
        beat(b, s);
        break;
      case "closing":
        closing(b, s);
        break;
      case "notes":
        notes(b, s);
        break;
      case "sources":
        sources(b, s);
        break;
    }
    if (s.kind !== "cover") footer(b, deck, i, dark);
    return { bg, ops: b.ops };
  });
}

/** Characters outside WinAnsi (what the standard fonts can measure). */
export const NOT_WIN_ANSI = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g;

/** Characters the standard PDF/Office fonts cannot measure count as a wide glyph. */
export function measurable(text: string): string {
  return text.replace(/→/g, "->").replace(NOT_WIN_ANSI, "M");
}
