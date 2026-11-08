import type { Customer, IndustryPriority } from "../data/types";

export type PriorityKey = "water" | "emissions" | "cost" | "circularity" | "service" | "hygiene" | "evidence" | "improvement";

export const PRIORITY_KEYS: PriorityKey[] = ["water", "emissions", "cost", "circularity", "service", "hygiene", "evidence", "improvement"];

export type Weights = Record<PriorityKey, number>;

export const PRIORITY_META: Record<PriorityKey, { label: string; short: string; description: string }> = {
  water: { label: "Water", short: "Water", description: "Fresh water used and saved versus the alternative" },
  emissions: { label: "Emissions", short: "CO₂e", description: "Process and delivery emissions, avoided product emissions" },
  cost: { label: "Cost & allocation", short: "Cost", description: "Idle garments, right-sizing, money value of savings" },
  circularity: { label: "Circularity", short: "Circular", description: "Repairs, postponed replacements, waste routes" },
  service: { label: "Service performance", short: "Service", description: "On-time cycles, turnaround, service requests" },
  hygiene: { label: "Hygiene & compliance", short: "Hygiene", description: "Wash rhythm, garment control, traceability" },
  evidence: { label: "Reporting evidence", short: "Evidence", description: "Sources, boundaries and data quality for Scope 3 / CSRD-style reporting" },
  improvement: { label: "Next-year plan", short: "Next year", description: "Actions, owners and steering-committee questions" },
};

export const ZERO_WEIGHTS: Weights = { water: 0, emissions: 0, cost: 0, circularity: 0, service: 0, hygiene: 0, evidence: 0, improvement: 0 };

const KEYWORDS: Record<PriorityKey, string[]> = {
  water: ["water", "litre", "liter", "drought", "wastewater", "vesi", "vatten", "woda"],
  emissions: ["emission", "co2", "carbon", "climate", "ghg", "scope 3", "scope3", "footprint", "net zero", "decarbon", "päästö", "utsläpp"],
  cost: ["cost", "money", "budget", "price", "saving money", "euro", "€", "spend", "cheap", "expensive", "cfo", "finance", "allocation", "idle", "efficien", "roi", "procure", "kustann", "kostnad"],
  circularity: ["circular", "repair", "reuse", "recycl", "waste", "lifetime", "life time", "lifespan", "durab", "textile waste", "kierrät", "återvinn"],
  service: ["service", "deliver", "on time", "on-time", "late", "delay", "turnaround", "reliab", "availability", "request", "continuity", "sla", "uptime"],
  hygiene: ["hygiene", "clean", "wash", "contamina", "food safety", "haccp", "brc", "compliance", "traceab", "infection", "audit", "safety", "hygien"],
  evidence: ["evidence", "report", "csrd", "esrs", "scope 3", "audit", "data quality", "source", "assumption", "transparen", "proof", "disclos"],
  improvement: ["next year", "improve", "plan", "future", "roadmap", "action", "recommend", "steering", "opportunit", "what should", "priorit", "2026", "2027"],
};

const INTENSIFIERS = ["super", "very", "most", "critical", "key", "top", "really", "extremely", "main", "first", "biggest", "crucial", "number one", "#1"];
const NEGATORS = ["not ", "don't", "do not", "no ", "less ", "ignore", "isn't", "doesn't care"];

/**
 * Transparent rules-based reading of a free-text priority statement.
 * The AI interpretation (when available) refines this; both are shown.
 */
export function parsePriorityText(text: string): { weights: Weights; matches: Array<{ key: PriorityKey; term: string; weight: number }> } {
  const t = ` ${text.toLowerCase()} `;
  const weights: Weights = { ...ZERO_WEIGHTS };
  const matches: Array<{ key: PriorityKey; term: string; weight: number }> = [];
  const clauses = t.split(/[.,;!?\n]| and | but | also /);
  for (const clause of clauses) {
    for (const key of PRIORITY_KEYS) {
      for (const term of KEYWORDS[key]) {
        if (!clause.includes(term)) continue;
        const negated = NEGATORS.some((ng) => clause.includes(ng) && clause.indexOf(ng) < clause.indexOf(term));
        const intense = INTENSIFIERS.some((w) => clause.includes(w));
        const w = negated ? 0 : intense ? 3 : 2;
        if (w > weights[key]) weights[key] = w;
        if (!matches.some((m) => m.key === key)) matches.push({ key, term, weight: w });
        break;
      }
    }
  }
  return { weights, matches };
}

const THEME_TO_KEYS: Array<[RegExp, PriorityKey[]]> = [
  [/hygiene|traceab/i, ["hygiene"]],
  [/compliance|evidence/i, ["evidence", "hygiene"]],
  [/water/i, ["water"]],
  [/service|continuity|reliab|availability/i, ["service"]],
  [/cost|allocation/i, ["cost"]],
  [/repair|lifetime|circular/i, ["circularity"]],
  [/safety/i, ["service", "hygiene"]],
  [/emission|scope 3|carbon/i, ["emissions", "evidence"]],
];

/** Industry rules (Industry_Priorities sheet) → default emphasis weights. */
export function industryWeights(industry: string, rules: IndustryPriority[]): Weights {
  const w: Weights = { ...ZERO_WEIGHTS };
  for (const r of rules.filter((x) => x.industry === industry)) {
    const strength = r.rank === 1 ? 3 : r.rank === 2 ? 2 : 1;
    for (const [re, keys] of THEME_TO_KEYS) {
      if (re.test(r.theme)) for (const k of keys) w[k] = Math.max(w[k], strength);
    }
  }
  return w;
}

export function customerTopicWeights(customer: Customer): Weights {
  const w: Weights = { ...ZERO_WEIGHTS };
  for (const topic of customer.priorityTopics) {
    for (const [re, keys] of THEME_TO_KEYS) if (re.test(topic)) for (const k of keys) w[k] = Math.max(w[k], 2);
  }
  return w;
}

/**
 * Effective emphasis = industry context + stated customer topics + avatar
 * + researched country rules, with an explicit prompt dominating when present.
 */
export function blendWeights(parts: { industry: Weights; topics: Weights; avatar: Weights; prompt?: Weights | null; regulation?: Weights | null }): Weights {
  const out: Weights = { ...ZERO_WEIGHTS };
  const hasPrompt = parts.prompt && Object.values(parts.prompt).some((v) => v > 0);
  for (const k of PRIORITY_KEYS) {
    const base = parts.industry[k] * 0.35 + parts.topics[k] * 0.25 + parts.avatar[k] * 0.6 + (parts.regulation?.[k] ?? 0) * 0.2;
    out[k] = hasPrompt ? base * 0.35 + (parts.prompt![k] ?? 0) * 1.2 : base;
  }
  return out;
}

export function rankPriorities(w: Weights): PriorityKey[] {
  return [...PRIORITY_KEYS].sort((a, b) => w[b] - w[a]);
}

/** Relevance of an item tagged with priorities under the current weights. */
export function relevance(tags: PriorityKey[], w: Weights): number {
  if (!tags.length) return 0;
  const sorted = tags.map((t) => w[t] ?? 0).sort((a, b) => b - a);
  return sorted[0] + sorted.slice(1).reduce((t, v) => t + v * 0.3, 0);
}
