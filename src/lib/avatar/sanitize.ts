import { ARCHETYPE_IDS, type ArchetypeId } from "@/lib/engine/avatars";
import { PRIORITY_KEYS, ZERO_WEIGHTS, type Weights } from "@/lib/engine/priorities";
import type { InterviewCompany, InterviewDraft } from "./interview-types";

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
};

const clipList = (v: unknown, n: number, max = 220): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = clip(x, max);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= n) break;
  }
  return out;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/**
 * Keeps only values that exist in the uploaded data (company, site country)
 * and clamps everything else, so the AI can never invent a company or a
 * location the dashboard cannot scope to.
 */
export function sanitizeDraft(raw: Partial<InterviewDraft>, companies: InterviewCompany[], previous: InterviewDraft): InterviewDraft {
  const byId = companies.find((c) => c.id === raw.customerId);
  const byName = !byId && raw.customerId ? companies.find((c) => norm(c.name) === norm(String(raw.customerId))) : undefined;
  const company = byId ?? byName ?? companies.find((c) => c.id === previous.customerId) ?? null;

  let country: string | null = null;
  const rc = clip(raw.country, 80)?.replace(/\s*\(.*\)\s*$/, "") ?? null;
  if (company && rc) {
    if (/^(all|all countries|every country|group|global)$/i.test(rc)) country = "ALL";
    else country = company.countries.find((c) => norm(c.name) === norm(rc))?.name ?? null;
  }
  if (!country && previous.country && company && (previous.country === "ALL" || company.countries.some((c) => c.name === previous.country))) {
    country = previous.country;
  }
  if (company && !country && company.countries.length === 1) country = company.countries[0].name;

  const archetype = ARCHETYPE_IDS.includes(raw.archetype as ArchetypeId) ? (raw.archetype as ArchetypeId) : previous.archetype;

  let weights: Weights | null = null;
  if (raw.weights && typeof raw.weights === "object") {
    weights = { ...ZERO_WEIGHTS };
    for (const k of PRIORITY_KEYS) {
      const v = Number((raw.weights as Record<string, unknown>)[k]);
      weights[k] = Number.isFinite(v) ? Math.max(0, Math.min(3, Math.round(v))) : 0;
    }
    if (!Object.values(weights).some((v) => v > 0)) weights = previous.weights;
  } else {
    weights = previous.weights;
  }

  const detail = raw.detail === "headline" || raw.detail === "balanced" || raw.detail === "deep" ? raw.detail : previous.detail;
  const tone = raw.tone === "executive" || raw.tone === "operational" || raw.tone === "technical" ? raw.tone : previous.tone;
  const sk = Number(raw.skepticism);

  const keep = (next: string[], prev: string[]) => (next.length ? next : prev);

  return {
    customerId: company?.id ?? null,
    personName: clip(raw.personName, 80) ?? previous.personName,
    role: clip(raw.role, 120) ?? previous.role,
    country,
    archetype: archetype ?? null,
    decisions: keep(clipList(raw.decisions, 6), previous.decisions),
    goals: keep(clipList(raw.goals, 6), previous.goals),
    reporting: keep(clipList(raw.reporting, 6), previous.reporting),
    moments: keep(clipList(raw.moments, 4), previous.moments),
    avoid: keep(clipList(raw.avoid, 4), previous.avoid),
    detail,
    tone,
    showMoney: typeof raw.showMoney === "boolean" ? raw.showMoney : previous.showMoney,
    skepticism: Number.isFinite(sk) && sk >= 1 && sk <= 5 ? Math.round(sk) : previous.skepticism,
    weights,
    concerns: keep(clipList(raw.concerns, 4, 200), previous.concerns),
    lookups: keep(clipList(raw.lookups, 8, 160), previous.lookups),
  };
}
