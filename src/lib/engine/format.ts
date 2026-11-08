export function fmtNum(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** Compact human number: 1.4M, 255k, 980. */
export function fmtCompact(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "-";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(digits)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(a >= 1e5 ? 0 : digits)}k`;
  return fmtNum(v, a < 10 && v % 1 !== 0 ? 1 : 0);
}

export function fmtPct(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtEur(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return `€${fmtCompact(v)}`;
}

/** kgCO2e → tonnes with sensible precision. */
export function fmtTonnes(kg: number): string {
  const t = kg / 1000;
  return `${fmtNum(t, t < 10 ? 1 : 0)} t`;
}

export function fmtLitres(l: number): string {
  if (Math.abs(l) >= 1e6) return `${(l / 1e6).toFixed(2)}M L`;
  if (Math.abs(l) >= 1e3) return `${fmtNum(l / 1e3, 0)}k L`;
  return `${fmtNum(l)} L`;
}

export function fmtMonth(m: string, style: "short" | "long" = "short"): string {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  const d = new Date(Date.UTC(y, mo - 1, 1));
  return d.toLocaleDateString("en-GB", { month: style === "short" ? "short" : "long", year: "numeric", timeZone: "UTC" });
}

export function fmtPeriod(from: string, to: string): string {
  if (from === to) return fmtMonth(from, "long");
  const [fy] = from.split("-");
  const [ty] = to.split("-");
  if (from.endsWith("-01") && to.endsWith("-12") && fy === ty) return `Full year ${fy}`;
  return `${fmtMonth(from)} – ${fmtMonth(to)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
