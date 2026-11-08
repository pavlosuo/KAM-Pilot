import {
  briefCarbonPrice,
  briefItems,
  type CarbonPrice,
  type RegulatoryBrief,
  type RuleItem,
  type RuleMetric,
} from "@/lib/regulation/types";
import type { Scenario } from "./assumptions";
import { fmtCompact, fmtNum, fmtPct, fmtTonnes } from "./format";
import type { ReviewModel } from "./metrics";
import type { Observation } from "./observations";
import { ZERO_WEIGHTS, type PriorityKey, type Weights } from "./priorities";
import type { MetricKey } from "./provenance";

/**
 * Deterministic bridge between web-researched country rules and the review
 * model: the AI supplies rule text, dates and a carbon price with a source;
 * every number shown next to a rule is computed here from the customer data.
 */

const STATUS_STRENGTH: Record<RuleItem["status"], number> = { in_force: 1, phasing_in: 1, upcoming: 0.9, proposed: 0.5, uncertain: 0.3 };
const CONFIDENCE_STRENGTH: Record<RuleItem["confidence"], number> = { high: 1, medium: 0.75, low: 0.4 };

/** Emphasis the researched rules add to the dashboard (0–3 per priority). */
export function regulationWeights(brief: RegulatoryBrief | null | undefined): Weights | null {
  const items = briefItems(brief);
  if (!items.length) return null;
  const w: Weights = { ...ZERO_WEIGHTS };
  for (const it of items) {
    const s = STATUS_STRENGTH[it.status] * CONFIDENCE_STRENGTH[it.confidence];
    w[it.priority] += s;
    if (it.category === "carbon_pricing") w.emissions += s * 0.5;
    if (it.category === "reporting" || it.category === "claims") w.evidence += s * 0.5;
    if (it.category === "tax_incentive" || it.category === "funding") w.cost += s * 0.5;
  }
  for (const k of Object.keys(w) as PriorityKey[]) w[k] = Math.min(3, Math.round(w[k] * 10) / 10);
  return w;
}

export interface MetricReading {
  label: string;
  value: string;
  raw: number;
  metric: MetricKey | null;
}

/** Resolves the figure a rule points at from the scoped review model. */
export function metricReading(m: ReviewModel, metric: RuleMetric, scenario: Scenario): MetricReading | null {
  const sv = m.impact.savings[scenario];
  switch (metric) {
    case "co2Saving":
      return { label: "CO₂e avoided vs alternative", value: fmtTonnes(sv.co2Kg), raw: sv.co2Kg, metric: "co2Saving" };
    case "footprintCo2":
      return { label: "Allocated service footprint", value: fmtTonnes(m.impact.footprint.co2Kg), raw: m.impact.footprint.co2Kg, metric: "footprintCo2" };
    case "waterSaving":
      return { label: "Fresh water saved", value: `${fmtCompact(sv.waterL)} L`, raw: sv.waterL, metric: "waterSaving" };
    case "energySaving":
      return { label: "Energy saved", value: `${fmtCompact(sv.energyKwh)} kWh`, raw: sv.energyKwh, metric: "energySaving" };
    case "textileWaste":
      return { label: "Textile waste attributed", value: `${fmtCompact(m.impact.waste.totalKg)} kg`, raw: m.impact.waste.totalKg, metric: "wasteAttributed" };
    case "wasteDiverted": {
      const share = m.impact.waste.totalKg ? m.impact.waste.divertedKg / m.impact.waste.totalKg : 0;
      return { label: "Recycled or reused", value: `${fmtCompact(m.impact.waste.divertedKg)} kg (${fmtPct(share)})`, raw: m.impact.waste.divertedKg, metric: "wasteDiverted" };
    }
    case "repairs":
      return { label: "Repairs completed", value: fmtNum(m.repairs.repairs), raw: m.repairs.repairs, metric: "repairs" };
    case "postponed":
      return { label: "Replacements postponed", value: fmtNum(m.repairs.postponed[scenario]), raw: m.repairs.postponed[scenario], metric: "postponed" };
    case "onTime":
      return { label: "On-time service cycles", value: fmtPct(m.cycles.onTimeShare, 1), raw: m.cycles.onTimeShare, metric: "onTime" };
    case "idleGarments":
      return { label: "Idle garments", value: fmtNum(m.activity.idleLatest), raw: m.activity.idleLatest, metric: "idleGarments" };
    default:
      return null;
  }
}

export interface CarbonValue {
  price: CarbonPrice;
  eur: Record<Scenario, number>;
  tonnes: Record<Scenario, number>;
}

/** Illustrative money value of the avoided CO₂e at the researched carbon price. */
export function carbonValue(m: ReviewModel, brief: RegulatoryBrief | null | undefined): CarbonValue | null {
  const price = briefCarbonPrice(brief);
  if (!price) return null;
  const t = (s: Scenario) => Math.max(0, m.impact.savings[s].co2Kg) / 1000;
  const tonnes = { low: t("low"), base: t("base"), high: t("high") };
  return {
    price,
    tonnes,
    eur: { low: tonnes.low * price.eurPerTonne, base: tonnes.base * price.eurPerTonne, high: tonnes.high * price.eurPerTonne },
  };
}

/** Parses YYYY, YYYY-MM or YYYY-MM-DD to a comparable UTC date (start of the period). */
export function effectiveDate(eff: string | null): Date | null {
  if (!eff) return null;
  const m = eff.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), m[2] ? Number(m[2]) - 1 : 0, m[3] ? Number(m[3]) : 1));
}

export interface TimelineEntry {
  item: RuleItem;
  date: Date;
  monthsAway: number;
}

/** Dated rules ordered in time, with months from `today` (negative = already applies). */
export function ruleTimeline(brief: RegulatoryBrief | null | undefined, today: Date): TimelineEntry[] {
  return briefItems(brief)
    .map((item) => ({ item, date: effectiveDate(item.effective) }))
    .filter((x): x is { item: RuleItem; date: Date } => !!x.date)
    .map(({ item, date }) => ({
      item,
      date,
      monthsAway: (date.getUTCFullYear() - today.getUTCFullYear()) * 12 + (date.getUTCMonth() - today.getUTCMonth()),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Rules ranked by decision relevance for the current emphasis. */
export function rankRules(brief: RegulatoryBrief | null | undefined, weights: Weights): RuleItem[] {
  return [...briefItems(brief)].sort((a, b) => {
    const s = (x: RuleItem) => (weights[x.priority] + 0.5) * STATUS_STRENGTH[x.status] * CONFIDENCE_STRENGTH[x.confidence] + (x.metric !== "none" ? 0.3 : 0);
    return s(b) - s(a);
  });
}

/**
 * Observations created from the brief: a carbon-price valuation of the avoided
 * emissions and the most relevant dated rules tied to the account's figures.
 */
export function regulatoryObservations(m: ReviewModel, brief: RegulatoryBrief | null | undefined, weights: Weights, scenario: Scenario, today: Date): Observation[] {
  if (!brief) return [];
  const out: Observation[] = [];
  const cv = carbonValue(m, brief);
  if (cv && cv.tonnes.base > 0) {
    out.push({
      id: "rule-carbon-value",
      kind: "rule",
      title: `At ${brief.country}'s carbon price (€${fmtNum(cv.price.eurPerTonne)}/t), the ${fmtTonnes(m.impact.savings.base.co2Kg)} CO₂e avoided is worth about €${fmtCompact(cv.eur.base)}`,
      detail: `${cv.price.instrument} (${cv.price.year}), applies to ${cv.price.appliesTo}. Range €${fmtCompact(cv.eur.low)}–€${fmtCompact(cv.eur.high)} across the low/high cases. Illustrative only: it shows the carbon cost a less efficient alternative would carry, not a saving on the customer's invoice or tax bill.`,
      evidence: [
        { label: "CO₂e avoided (base)", value: fmtTonnes(m.impact.savings.base.co2Kg), metric: "co2Saving" },
        { label: "Carbon price", value: `€${fmtNum(cv.price.eurPerTonne)}/t` },
        { label: "Illustrative value", value: `€${fmtCompact(cv.eur.base)}` },
      ],
      tags: ["emissions", "cost"],
      siteIds: [],
      action: "Use the carbon-price view to explain why process efficiency matters as carbon pricing widens; keep it separate from contract prices.",
      owner: "Shared",
      question: "Should the next contract track the carbon cost exposure of the service alongside its price?",
      confidence: cv.price.source.verified ? "Medium" : "Low",
      assumptionIds: ["A001", "P01"],
      magnitude: 0.7,
    });
  }

  const ranked = rankRules(brief, weights).filter((r) => r.category !== "carbon_pricing" || !cv);
  for (const r of ranked.slice(0, 4)) {
    const reading = metricReading(m, r.metric, scenario);
    const date = effectiveDate(r.effective);
    const months = date ? (date.getUTCFullYear() - today.getUTCFullYear()) * 12 + (date.getUTCMonth() - today.getUTCMonth()) : null;
    const when = r.effective ? (months != null && months > 0 ? ` - from ${r.effective}, in ${months} month${months === 1 ? "" : "s"}` : ` - since ${r.effective}`) : "";
    out.push({
      id: `rule-${r.id}`,
      kind: "rule",
      title: `${r.title}${when}`,
      detail: [r.summary, r.relevance].filter(Boolean).join(" "),
      evidence: [
        ...(reading ? [{ label: reading.label, value: reading.value, ...(reading.metric ? { metric: reading.metric } : {}) }] : []),
        { label: r.jurisdiction, value: r.status.replace("_", " ") },
      ],
      tags: [r.priority],
      siteIds: [],
      action: r.action || "Agree how this rule changes what the customer needs from the service.",
      owner: "Shared",
      question: `How does ${r.title.toLowerCase().replace(/[.:]+$/, "")} change what you need from us?`,
      confidence: r.confidence === "high" ? "High" : r.confidence === "medium" ? "Medium" : "Low",
      assumptionIds: [],
      magnitude: months != null && months >= 0 && months <= 18 ? 0.75 : 0.55,
    });
  }
  return out;
}
