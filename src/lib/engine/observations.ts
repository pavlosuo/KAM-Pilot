import type { Dataset } from "../data/types";
import type { Avatar } from "./avatars";
import { fmtCompact, fmtNum, fmtPct, fmtTonnes } from "./format";
import type { ReviewModel, SiteSummary } from "./metrics";
import { relevance, type PriorityKey, type Weights } from "./priorities";
import type { MetricKey } from "./provenance";
import type { RebalancePlan } from "./rebalance";

export type ObservationKind = "value" | "risk" | "opportunity" | "rule" | "data";
export type Owner = "Customer" | "Lindström" | "Shared";

export interface Evidence {
  label: string;
  value: string;
  metric?: MetricKey;
}

export interface Observation {
  id: string;
  kind: ObservationKind;
  title: string;
  detail: string;
  evidence: Evidence[];
  tags: PriorityKey[];
  siteIds: string[];
  action: string;
  owner: Owner;
  question: string;
  confidence: "High" | "Medium" | "Low";
  assumptionIds: string[];
  /** Size of the effect, 0..1, before priority weighting. */
  magnitude: number;
  /** KPI and internal-benchmark target for the joint improvement plan. */
  plan?: { kpi: string; current: string; target: string; benchmark: string };
  score?: number;
}

const siteName = (s: SiteSummary) => s.site.name.replace(/^[A-Za-z]+\s/, "");
const names = (list: SiteSummary[]) => list.map(siteName).join(", ");

function quantile(values: number[], q: number) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return 0;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

/**
 * Deterministic observation rules. Each observation states its evidence,
 * provenance, owner, a steering-committee question and - where relevant - an
 * internal benchmark target (the customer's own best-quartile sites), so
 * nothing relies on an unsupported external claim.
 */
export function generateObservations(
  m: ReviewModel,
  ds: Dataset,
  weights: Weights,
  plan: RebalancePlan,
  avatar?: Avatar,
  /** Pre-built observations (e.g. country rules) scored together with the data rules. */
  extra: Observation[] = [],
): Observation[] {
  const out: Observation[] = [];
  const base = m.impact.savings.base;
  const low = m.impact.savings.low;
  const high = m.impact.savings.high;
  const bName = m.baseline.name.toLowerCase();
  const sites = m.sites;
  const products = new Map(ds.products.map((p) => [p.id, p]));

  // VALUE - water
  if (base.waterL > 0) {
    const pools = base.waterL / 2_500_000;
    out.push({
      id: "value-water",
      kind: "value",
      title: `${fmtCompact(base.waterL)} litres of fresh water saved versus ${bName}`,
      detail: `Lindström's laundries used ${fmtNum(m.impact.intensity.waterLPerKg, 1)} L per washed kg for this customer against ${fmtNum(m.baseline.waterLPerKg, 1)} L/kg in the ${bName} scenario. Range ${fmtCompact(low.waterL)}–${fmtCompact(high.waterL)} L${pools >= 0.2 ? ` (≈ ${fmtNum(pools, 1)} Olympic pools at base)` : ""}.`,
      evidence: [
        { label: "Water saving (base)", value: `${fmtCompact(base.waterL)} L`, metric: "waterSaving" },
        { label: "Allocated water use", value: `${fmtCompact(m.impact.footprint.waterL)} L`, metric: "footprintWater" },
      ],
      tags: ["water"],
      siteIds: [],
      action: "Use the water figure in the customer's sustainability reporting only as an allocated estimate with the stated baseline.",
      owner: "Shared",
      question: `Is ${bName} the right comparison for how you would wash garments without the service?`,
      confidence: "Medium",
      assumptionIds: ["A001", "A003", "P01"],
      magnitude: 0.6,
    });
  }

  // VALUE - emissions
  if (base.co2Kg > 0) {
    out.push({
      id: "value-emissions",
      kind: "value",
      title: `${fmtTonnes(base.co2Kg)} CO₂e lower than ${bName}, plus ${fmtTonnes(m.repairs.avoidedKgCo2e.base)} avoided through repairs`,
      detail: `Process and delivery emissions allocated to the account were ${fmtTonnes(m.impact.footprint.co2Kg)}. The saving range is ${fmtTonnes(low.co2Kg)}–${fmtTonnes(high.co2Kg)}; repair-related avoided product emissions are reported separately because they rely on assumption A002 and uploaded product footprints.`,
      evidence: [
        { label: "Emission saving (base)", value: fmtTonnes(base.co2Kg), metric: "co2Saving" },
        { label: "Allocated footprint", value: fmtTonnes(m.impact.footprint.co2Kg), metric: "footprintCo2" },
        { label: "Avoided via repairs", value: fmtTonnes(m.repairs.avoidedKgCo2e.base), metric: "avoidedProductCo2" },
      ],
      tags: ["emissions", "evidence"],
      siteIds: [],
      action: "Agree which of these figures enter the customer's Scope 3 narrative, and confirm factors with the method owner before external use.",
      owner: "Shared",
      question: "Which emission figures does your reporting team need from us, and in what format?",
      confidence: "Medium",
      assumptionIds: ["A001", "A002", "A005", "P01"],
      magnitude: 0.65,
    });
  }

  // VALUE - circularity
  if (m.repairs.repairs > 0) {
    const divertedShare = m.impact.waste.totalKg ? m.impact.waste.divertedKg / m.impact.waste.totalKg : 0;
    out.push({
      id: "value-circularity",
      kind: "value",
      title: `${fmtNum(m.repairs.repairs)} repairs kept garments in use - ${fmtNum(m.repairs.postponed.low)}–${fmtNum(m.repairs.postponed.high)} replacements postponed`,
      detail: `Each repair is assumed to postpone up to one replacement (A002). ${fmtPct(divertedShare)} of the textile waste attributed to the account went to recycling or reuse instead of mixed waste.`,
      evidence: [
        { label: "Repairs", value: fmtNum(m.repairs.repairs), metric: "repairs" },
        { label: "Replacements postponed", value: `${fmtNum(m.repairs.postponed.low)}–${fmtNum(m.repairs.postponed.high)}`, metric: "postponed" },
        { label: "Waste to recycling/reuse", value: `${fmtCompact(m.impact.waste.divertedKg)} kg`, metric: "wasteDiverted" },
      ],
      tags: ["circularity"],
      siteIds: [],
      action: "Keep repair-first handling; report postponed replacements as a range, not a single number.",
      owner: "Lindström",
      question: "Would a yearly circularity statement (repairs, reuse, recycling) help your own reporting?",
      confidence: "Medium",
      assumptionIds: ["A002", "A003", "A004"],
      magnitude: 0.5,
    });
  }

  // OPPORTUNITY - idle garments
  if (sites.length) {
    const sorted = [...sites].sort((a, b) => a.activity.utilization - b.activity.utilization);
    const worst = sorted.slice(0, 3);
    const q3 = quantile(
      sites.map((s) => s.activity.utilization),
      0.75,
    );
    const idleShare = m.activity.garmentsLatest ? m.activity.idleLatest / m.activity.garmentsLatest : 0;
    const avgCost =
      m.products.reduce((t, p) => t + p.product.purchaseCostEur * p.garmentsLatest, 0) / Math.max(1, m.products.reduce((t, p) => t + p.garmentsLatest, 0));
    out.push({
      id: "opp-utilization",
      kind: "opportunity",
      title: `${fmtNum(m.activity.idleLatest)} allocated garments (${fmtPct(idleShare)}) were not seen in circulation`,
      detail: `Utilization was lowest at ${names(worst)} (${worst.map((s) => fmtPct(s.activity.utilization)).join(", ")}). Your best-quartile sites reach ${fmtPct(q3)}. Idle stock ties up roughly €${fmtCompact(m.activity.idleLatest * avgCost)} of estimated garment value.`,
      evidence: [
        { label: "Garments in active use", value: fmtPct(m.activity.utilization), metric: "utilization" },
        { label: "Idle garments (last month)", value: fmtNum(m.activity.idleLatest), metric: "idleGarments" },
      ],
      tags: ["cost", "circularity"],
      siteIds: worst.map((s) => s.site.id),
      action: "Review allocation at the lowest-utilization sites with site managers; apply the rebalancing plan before ordering new garments.",
      owner: "Shared",
      question: "Can site managers confirm leavers and size changes monthly so allocation follows real headcount?",
      confidence: "Medium",
      assumptionIds: ["P03"],
      magnitude: Math.min(1, idleShare * 4),
      plan: { kpi: "Garments in active use", current: fmtPct(m.activity.utilization), target: fmtPct(q3), benchmark: "Your best-quartile sites" },
    });
  }

  // RISK - wash rhythm (hygiene)
  if (sites.length) {
    const target = m.assumptions.washTargetPerMonth;
    const rhythm = m.activity.washesPerGarmentMonth;
    const sorted = [...sites].sort((a, b) => a.activity.washesPerGarmentMonth - b.activity.washesPerGarmentMonth);
    const worst = sorted.slice(0, 3);
    const q3 = quantile(
      sites.map((s) => s.activity.washesPerGarmentMonth),
      0.75,
    );
    const food = /food/i.test(m.customer.industry);
    out.push({
      id: "risk-wash-rhythm",
      kind: "risk",
      title: `Garments were washed ${fmtNum(rhythm, 1)}× a month on average - ${fmtPct(rhythm / target)} of the expected ${fmtNum(target)}× rhythm`,
      detail: `Lowest wash rhythm at ${names(worst)} (${worst.map((s) => fmtNum(s.activity.washesPerGarmentMonth, 1)).join(", ")}×/month).${food ? " In food production, garments kept too long between washes are a hygiene-plan risk." : ""} The expected rhythm is an editable assumption (P02).`,
      evidence: [
        { label: "Washes per garment / month", value: fmtNum(rhythm, 2), metric: "washRhythm" },
        { label: "Expected rhythm (P02)", value: `${fmtNum(target)}× / month` },
      ],
      tags: ["hygiene", "service"],
      siteIds: worst.map((s) => s.site.id),
      action: "Agree the wash rhythm per product in the hygiene plan and remind wearers at the lowest sites; Lindström flags garments that miss two cycles.",
      owner: "Customer",
      question: "Which roles must meet a weekly wash rhythm, and how should we remind wearers who keep garments too long?",
      confidence: "Low",
      assumptionIds: ["P02"],
      magnitude: Math.min(1, Math.max(0.2, 1 - rhythm / target)) * (food ? 1 : 0.7),
      plan: { kpi: "Washes per garment / month", current: fmtNum(rhythm, 2), target: fmtNum(q3, 2), benchmark: "Your best-quartile sites" },
    });
  }

  // RISK - service requests
  if (sites.length && m.activity.serviceRequests > 0) {
    const sorted = [...sites].sort((a, b) => b.activity.requestsPer1000WearerMonths - a.activity.requestsPer1000WearerMonths);
    const worst = sorted.slice(0, 3);
    const peak = [...m.monthly].sort((a, b) => b.serviceRequests - a.serviceRequests)[0];
    out.push({
      id: "risk-service-requests",
      kind: "risk",
      title: `${fmtNum(m.activity.serviceRequests)} service requests - ${names(worst)} raise them most often`,
      detail: `${fmtPct(m.activity.requestFreeSiteMonthShare)} of site-months were request-free. Highest rates per 1,000 wearers: ${worst
        .map((s) => `${siteName(s)} ${fmtNum(s.activity.requestsPer1000WearerMonths, 2)}`)
        .join(", ")}. Peak month: ${peak?.month ?? "-"} (${fmtNum(peak?.serviceRequests ?? 0)}).`,
      evidence: [
        { label: "Service requests", value: fmtNum(m.activity.serviceRequests), metric: "serviceRequests" },
        { label: "Request-free site-months", value: fmtPct(m.activity.requestFreeSiteMonthShare), metric: "requestFree" },
      ],
      tags: ["service"],
      siteIds: worst.map((s) => s.site.id),
      action: "Run a short root-cause review of requests at the top three sites (sizes, stock buffers, delivery days).",
      owner: "Lindström",
      question: "Which request types frustrate your teams most - sizes, missing garments or timing?",
      confidence: "Medium",
      assumptionIds: [],
      magnitude: 0.45,
    });
  }

  // RISK - timeliness
  if (m.cycles.cycles > 0) {
    const sorted = [...sites].filter((s) => s.cycles.cycles > 0).sort((a, b) => b.cycles.late / b.cycles.cycles - a.cycles.late / a.cycles.cycles);
    const worst = sorted.slice(0, 3);
    out.push({
      id: "risk-late-cycles",
      kind: m.cycles.onTimeShare >= 0.98 ? "value" : "risk",
      title: `${fmtPct(m.cycles.onTimeShare, 1)} of tracked service cycles were on time (avg ${fmtNum(m.cycles.avgHours)} h pickup → delivery)`,
      detail: `${fmtNum(m.cycles.late)} late cycles in the RFID sample; most frequent at ${names(worst)}. Late cycles averaged well above the ${fmtNum(m.cycles.avgHours)} h norm.`,
      evidence: [
        { label: "On-time cycles", value: fmtPct(m.cycles.onTimeShare, 1), metric: "onTime" },
        { label: "Average cycle", value: `${fmtNum(m.cycles.avgHours)} h`, metric: "cycleHours" },
      ],
      tags: ["service"],
      siteIds: worst.map((s) => s.site.id),
      action: "Lindström reviews route timing for the three sites with the most late cycles and reports back next quarter.",
      owner: "Lindström",
      question: "Do late deliveries hit shift starts at these sites, or is there enough buffer stock?",
      confidence: "Medium",
      assumptionIds: [],
      magnitude: Math.min(1, (1 - m.cycles.onTimeShare) * 20),
    });
  }

  // OPPORTUNITY - hard-to-repair product
  const worstProduct = m.repairs.byProduct[0];
  if (worstProduct && m.repairs.byProduct.length > 1) {
    const p = products.get(worstProduct.productId);
    const avgQ = m.repairs.repairs / Math.max(1, m.activity.washedPieces);
    out.push({
      id: "opp-product-repairs",
      kind: "opportunity",
      title: `${p?.name ?? worstProduct.productId} needs repair most often (${fmtPct(worstProduct.quotient, 2)} of washes vs ${fmtPct(avgQ, 2)} overall)`,
      detail: `${fmtNum(worstProduct.count)} repairs on this product. Frequent repairs are good for lifetime but can signal a product that does not fit the work. Top repair types: ${m.repairs.byType
        .slice(0, 3)
        .map((t) => t.type.toLowerCase())
        .join(", ")}.`,
      evidence: [
        { label: "Repair quotient", value: fmtPct(worstProduct.quotient, 2), metric: "repairQuotient" },
        { label: "Repairs on product", value: fmtNum(worstProduct.count), metric: "repairs" },
      ],
      tags: ["circularity", "cost"],
      siteIds: [],
      action: "Test a more durable model or reinforced variant at one site; compare repair rates after six months.",
      owner: "Shared",
      question: `Is ${p?.name ?? "this product"} the right garment for the tasks at your sites?`,
      confidence: "Medium",
      assumptionIds: [],
      magnitude: Math.min(1, worstProduct.quotient / Math.max(avgQ, 1e-6) - 0.8),
    });
  }

  // OPPORTUNITY - dormant garments (RFID)
  if (m.dormancy.trackedAssets > 0 && m.dormancy.dormantAssets > 0) {
    const sorted = [...sites].filter((s) => s.dormancy.trackedAssets > 5).sort((a, b) => b.dormancy.dormantShare - a.dormancy.dormantShare);
    const worst = sorted.slice(0, 3);
    out.push({
      id: "opp-dormant",
      kind: "opportunity",
      title: `RFID signal: ${fmtPct(m.dormancy.dormantShare)} of tracked garments had no pickup in the last ${m.assumptions.dormantDays} days`,
      detail: `${fmtNum(m.dormancy.dormantAssets)} of ${fmtNum(m.dormancy.trackedAssets)} tracked garments look dormant - kept in lockers, lost, or belonging to leavers. Highest shares: ${worst
        .map((s) => `${siteName(s)} ${fmtPct(s.dormancy.dormantShare)}`)
        .join(", ")}. The cycle file is a sparse sample (avg ${fmtNum(m.dormancy.avgDaysBetweenPickups)} days between pickups), so verify with a full scan export before acting.`,
      evidence: [
        { label: "Dormant tracked garments", value: fmtPct(m.dormancy.dormantShare), metric: "dormant" },
        { label: "Tracked sample", value: fmtNum(m.dormancy.trackedAssets) },
      ],
      tags: ["cost", "hygiene"],
      siteIds: worst.map((s) => s.site.id),
      action: "Send site managers a monthly list of garments not seen by the laundry to recover, re-assign or retire.",
      owner: "Shared",
      question: "Who at each site could own a monthly 'garments not seen' list?",
      confidence: "Low",
      assumptionIds: ["P06"],
      magnitude: Math.min(0.6, m.dormancy.dormantShare * 1.2),
    });
  }

  // OPPORTUNITY - rebalancing
  if (plan.transferredPieces + plan.returnedPieces > 0) {
    out.push({
      id: "opp-rebalance",
      kind: "opportunity",
      title: plan.transferredPieces
        ? `Move ${fmtNum(plan.transferredPieces)} garments between sites and release ${fmtNum(plan.returnedPieces)} to the pool`
        : `Release ${fmtNum(plan.returnedPieces)} surplus garments back to Lindström's pool`,
      detail: plan.transferredPieces
        ? `Sites served by the same laundry can share stock: ${plan.transfers.length} transfers cover every site running above ${fmtPct(m.assumptions.targetUtilization)} utilization without new garments (≈ ${fmtTonnes(plan.embodiedKgCo2eAvoided)} embodied CO₂e not produced). Releasing the remaining surplus lowers the account's allocation.`
        : `No site runs above ${fmtPct(m.assumptions.targetUtilization)} utilization, so no transfers are needed. Allocation above the target at the remaining sites can be released, lowering the account's garment allocation.`,
      evidence: [
        { label: "Garments transferable", value: fmtNum(plan.transferredPieces), metric: "rebalance" },
        { label: "Garments releasable", value: fmtNum(plan.returnedPieces), metric: "rebalance" },
      ],
      tags: ["cost", "circularity", "improvement"],
      siteIds: plan.hotSites,
      action: "Approve the transfer list for the next delivery cycle; review releases with site managers.",
      owner: "Shared",
      question: "Can we move surplus garments between your sites before ordering new ones?",
      confidence: "Medium",
      assumptionIds: ["P03"],
      magnitude: Math.min(1, (plan.transferredPieces + plan.returnedPieces) / Math.max(1, m.activity.garmentsLatest) * 5),
    });
  }

  // DATA - allocation consistency / evidence readiness
  const flagged = m.laundries.filter((l) => l.flagged);
  if (flagged.length) {
    const affected = sites.filter((s) => s.dataFlags.includes("laundry-share"));
    out.push({
      id: "data-laundry-share",
      kind: "data",
      title: `Laundry totals for ${flagged.map((f) => f.name).join(", ")} do not match customer volumes`,
      detail: `${affected.length} site(s) are served by a laundry that reported less washed kg than the volumes assigned to its customers. Site figures stay reliable; confirm the laundry's totals before sharing them externally.`,
      evidence: [{ label: "Sites affected", value: fmtNum(affected.length) }],
      tags: ["evidence"],
      siteIds: affected.map((s) => s.site.id),
      action: "Confirm the washed-kg source for this laundry with the WWS data owner.",
      owner: "Lindström",
      question: "Do you need site-level evidence for these sites in this year's report?",
      confidence: "High",
      assumptionIds: ["A003"],
      magnitude: 0.4,
    });
  }

  out.push({
    id: "data-evidence-path",
    kind: "data",
    title: "Footprint figures are allocated estimates - ready for discussion, not yet for disclosure",
    detail:
      "Water, energy and emissions are laundry-level values shared to the account by washed kg. For external reporting, connect approved meter data, emission factors and product footprints (see Data readiness).",
    evidence: [{ label: "Allocation method", value: "Share of washed kg (A003)" }],
    tags: ["evidence"],
    siteIds: [],
    action: "Agree the data needed for next year's report: site hierarchy, approved factors, RFID scan export.",
    owner: "Shared",
    question: "What would make these figures usable in your own sustainability report?",
    confidence: "High",
    assumptionIds: ["A003", "A005", "A008"],
    magnitude: 0.3,
  });

  out.push(...extra.map((o) => ({ ...o })));
  const conf = { High: 1, Medium: 0.9, Low: 0.7 } as const;
  for (const o of out) {
    const avatarBoost = avatar ? relevance(o.tags, avatar.weights) * 0.15 : 0;
    o.score = (0.4 + relevance(o.tags, weights)) * (0.55 + o.magnitude) * conf[o.confidence] + avatarBoost + (o.kind === "value" ? 0.15 : 0);
  }
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function steeringQuestions(obs: Observation[], n = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of obs) {
    if (seen.has(o.question)) continue;
    seen.add(o.question);
    out.push(o.question);
    if (out.length >= n) break;
  }
  return out;
}
