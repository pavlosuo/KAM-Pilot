import type {
  ActivityRow,
  AssetSummary,
  Baseline,
  CycleAgg,
  Customer,
  Dataset,
  ImpactRow,
  Product,
  RepairRow,
  Site,
} from "../data/types";
import { SCENARIOS, type AssumptionValues, type Scenario } from "./assumptions";
import type { PriorityKey, Weights } from "./priorities";

export interface Scope {
  customerId: string;
  months: string[];
  siteIds?: string[] | null;
  productIds?: string[] | null;
}

type Keyed = { customerId: string; siteId: string; productId?: string; month?: string };

export function inScope<T extends Keyed>(rows: T[], scope: Scope): T[] {
  const months = new Set(scope.months);
  const sites = scope.siteIds?.length ? new Set(scope.siteIds) : null;
  const products = scope.productIds?.length ? new Set(scope.productIds) : null;
  return rows.filter(
    (r) =>
      r.customerId === scope.customerId &&
      (r.month == null || months.has(r.month)) &&
      (!sites || sites.has(r.siteId)) &&
      (!products || r.productId == null || products.has(r.productId)),
  );
}

export const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((t, r) => t + f(r), 0);
const safeDiv = (a: number, b: number) => (b ? a / b : 0);

/* ----------------------------------------------------------------------------
 * Activity
 * ------------------------------------------------------------------------- */

export interface ActivityTotals {
  lastMonth: string | null;
  wearerAssignmentsLatest: number; // summed product rows (pack definition)
  wearersLatest: number; // deduplicated estimate: max product line per site
  garmentsLatest: number;
  rfidActiveLatest: number;
  idleLatest: number;
  utilization: number; // Σ scanned / Σ allocated over the period
  washedPieces: number;
  washedKg: number;
  garmentMonths: number; // Σ allocated over months
  washesPerGarmentMonth: number;
  garmentsPerWearer: number;
  serviceRequests: number;
  requestsPer1000WearerMonths: number;
  siteMonths: number;
  requestFreeSiteMonthShare: number;
}

export function activityTotals(rows: ActivityRow[]): ActivityTotals {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const lastMonth = months[months.length - 1] ?? null;
  const latest = rows.filter((r) => r.month === lastMonth);
  const perSiteMax = new Map<string, number>();
  for (const r of latest) perSiteMax.set(r.siteId, Math.max(perSiteMax.get(r.siteId) ?? 0, r.activeWearers));
  const wearersLatest = [...perSiteMax.values()].reduce((a, b) => a + b, 0);
  const allocated = sum(rows, (r) => r.allocatedPieces);
  const scanned = sum(rows, (r) => r.activeAssetsScanned);
  // Deduplicated wearer-months (max product line per site & month).
  const wm = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.siteId}|${r.month}`;
    wm.set(k, Math.max(wm.get(k) ?? 0, r.activeWearers));
  }
  const wearerMonths = [...wm.values()].reduce((a, b) => a + b, 0);
  const srBySiteMonth = new Map<string, number>();
  for (const r of rows) srBySiteMonth.set(`${r.siteId}|${r.month}`, (srBySiteMonth.get(`${r.siteId}|${r.month}`) ?? 0) + r.serviceRequests);
  const siteMonths = srBySiteMonth.size;
  const free = [...srBySiteMonth.values()].filter((v) => v === 0).length;
  const garmentsLatest = sum(latest, (r) => r.allocatedPieces);
  const rfidLatest = sum(latest, (r) => r.activeAssetsScanned);
  return {
    lastMonth,
    wearerAssignmentsLatest: sum(latest, (r) => r.activeWearers),
    wearersLatest,
    garmentsLatest,
    rfidActiveLatest: rfidLatest,
    idleLatest: Math.max(0, garmentsLatest - rfidLatest),
    utilization: safeDiv(scanned, allocated),
    washedPieces: sum(rows, (r) => r.washedPieces),
    washedKg: sum(rows, (r) => r.washedKg),
    garmentMonths: allocated,
    washesPerGarmentMonth: safeDiv(sum(rows, (r) => r.washedPieces), allocated),
    garmentsPerWearer: safeDiv(garmentsLatest, wearersLatest),
    serviceRequests: sum(rows, (r) => r.serviceRequests),
    requestsPer1000WearerMonths: safeDiv(sum(rows, (r) => r.serviceRequests), wearerMonths) * 1000,
    siteMonths,
    requestFreeSiteMonthShare: safeDiv(free, siteMonths),
  };
}

/* ----------------------------------------------------------------------------
 * Service cycles (RFID sample)
 * ------------------------------------------------------------------------- */

export interface CycleTotals {
  cycles: number;
  late: number;
  onTimeShare: number;
  avgHours: number;
  maxHours: number;
}

export function cycleTotals(rows: CycleAgg[]): CycleTotals {
  const cycles = sum(rows, (r) => r.cycles);
  const late = sum(rows, (r) => r.late);
  return {
    cycles,
    late,
    onTimeShare: cycles ? 1 - late / cycles : 1,
    avgHours: safeDiv(sum(rows, (r) => r.totalHours), cycles),
    maxHours: rows.reduce((m, r) => Math.max(m, r.maxHours), 0),
  };
}

export interface DormancyTotals {
  trackedAssets: number;
  dormantAssets: number;
  dormantShare: number;
  avgDaysBetweenPickups: number;
}

export function dormancy(assets: AssetSummary[], periodEnd: string, dormantDays: number): DormancyTotals {
  const end = Date.parse(`${periodEnd}T23:59:59Z`);
  const threshold = end - dormantDays * 86_400_000;
  let dormant = 0;
  let gaps = 0;
  let gapCount = 0;
  for (const a of assets) {
    if (Date.parse(`${a.lastPickup}T00:00:00Z`) < threshold) dormant++;
    if (a.cycles > 1) {
      gaps += (Date.parse(a.lastPickup) - Date.parse(a.firstPickup)) / 86_400_000;
      gapCount += a.cycles - 1;
    }
  }
  return {
    trackedAssets: assets.length,
    dormantAssets: dormant,
    dormantShare: safeDiv(dormant, assets.length),
    avgDaysBetweenPickups: safeDiv(gaps, gapCount),
  };
}

/* ----------------------------------------------------------------------------
 * Repairs (circularity handprint)
 * ------------------------------------------------------------------------- */

export interface RepairTotals {
  repairs: number;
  repairQuotient: number; // repairs per washed piece
  postponed: Record<Scenario, number>;
  avoidedKgCo2e: Record<Scenario, number>;
  avoidedPurchaseEur: Record<Scenario, number>;
  byType: Array<{ type: string; count: number }>;
  byProduct: Array<{ productId: string; count: number; quotient: number }>;
}

export function repairTotals(rows: RepairRow[], washedPiecesByProduct: Map<string, number>, products: Map<string, Product>, a: AssumptionValues): RepairTotals {
  const repairs = sum(rows, (r) => r.repairCount);
  const avoidedBase = sum(rows, (r) => r.repairCount * (products.get(r.productId)?.footprintKgCo2e ?? r.productFootprintKgCo2e));
  const eurBase = sum(rows, (r) => r.repairCount * (products.get(r.productId)?.purchaseCostEur ?? 0));
  const byType = new Map<string, number>();
  const byProduct = new Map<string, number>();
  for (const r of rows) {
    byType.set(r.repairType, (byType.get(r.repairType) ?? 0) + r.repairCount);
    byProduct.set(r.productId, (byProduct.get(r.productId) ?? 0) + r.repairCount);
  }
  const washedTotal = [...washedPiecesByProduct.values()].reduce((x, y) => x + y, 0);
  const rec = (v: number) => Object.fromEntries(SCENARIOS.map((s) => [s, v * a.repairFactor[s]])) as Record<Scenario, number>;
  return {
    repairs,
    repairQuotient: safeDiv(repairs, washedTotal),
    postponed: rec(repairs),
    avoidedKgCo2e: rec(avoidedBase),
    avoidedPurchaseEur: rec(eurBase),
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((x, y) => y.count - x.count),
    byProduct: [...byProduct.entries()]
      .map(([productId, count]) => ({ productId, count, quotient: safeDiv(count, washedPiecesByProduct.get(productId) ?? 0) }))
      .sort((x, y) => y.quotient - x.quotient),
  };
}

/* ----------------------------------------------------------------------------
 * Footprint & handprint
 * ------------------------------------------------------------------------- */

export interface ResourceSet {
  waterL: number;
  energyKwh: number;
  co2Kg: number;
}

export interface WasteRoutes {
  totalKg: number;
  recyclingKg: number;
  reuseKg: number;
  energyRecoveryKg: number;
  incinerationKg: number;
  divertedKg: number; // recycling + reuse
  handprintDivertedKg: number; // vs alternative's mixed-waste share (A004)
}

export interface ImpactTotals {
  washedKg: number;
  footprint: ResourceSet & { processCo2Kg: number; deliveryCo2Kg: number; wasteKg: number };
  alternative: Record<Scenario, ResourceSet>;
  savings: Record<Scenario, ResourceSet>;
  savingsEur: Record<Scenario, { energy: number; water: number }>;
  intensity: { waterLPerKg: number; energyKwhPerKg: number; co2KgPerKg: number };
  waste: WasteRoutes;
}

export function scenarioFactor(s: Scenario, band: number) {
  return s === "low" ? 1 - band : s === "high" ? 1 + band : 1;
}

export function impactTotals(rows: ImpactRow[], ds: Dataset, baseline: Baseline, a: AssumptionValues): ImpactTotals {
  const washedKg = sum(rows, (r) => r.washedKg);
  const waterL = sum(rows, (r) => r.waterL);
  const energyKwh = sum(rows, (r) => r.energyKwh);
  const processCo2Kg = sum(rows, (r) => r.processKgCo2e);
  const deliveryCo2Kg = sum(rows, (r) => r.deliveryKgCo2e);
  const wasteKg = sum(rows, (r) => r.wasteKg);
  const footprint = { waterL, energyKwh, co2Kg: processCo2Kg + deliveryCo2Kg, processCo2Kg, deliveryCo2Kg, wasteKg };

  const alternative = {} as Record<Scenario, ResourceSet>;
  const savings = {} as Record<Scenario, ResourceSet>;
  const savingsEur = {} as Record<Scenario, { energy: number; water: number }>;
  for (const s of SCENARIOS) {
    const f = scenarioFactor(s, a.baselineBand);
    const alt = {
      waterL: washedKg * baseline.waterLPerKg * f,
      energyKwh: washedKg * baseline.energyKwhPerKg * f,
      co2Kg: washedKg * (baseline.processKgCo2ePerKg + baseline.deliveryKgCo2ePerKg) * f,
    };
    alternative[s] = alt;
    savings[s] = { waterL: alt.waterL - waterL, energyKwh: alt.energyKwh - energyKwh, co2Kg: alt.co2Kg - footprint.co2Kg };
    savingsEur[s] = {
      energy: savings[s].energyKwh * a.electricityEurPerKwh,
      water: (savings[s].waterL / 1000) * a.waterEurPerM3,
    };
  }

  const wasteBy = new Map(ds.waste.map((w) => [`${w.laundryId}|${w.month}`, w]));
  const routes: WasteRoutes = { totalKg: 0, recyclingKg: 0, reuseKg: 0, energyRecoveryKg: 0, incinerationKg: 0, divertedKg: 0, handprintDivertedKg: 0 };
  for (const r of rows) {
    const w = wasteBy.get(`${r.laundryId}|${r.month}`);
    if (!w || !w.totalKg) continue;
    const k = r.wasteKg / w.totalKg;
    routes.totalKg += r.wasteKg;
    routes.recyclingKg += w.recyclingKg * k;
    routes.reuseKg += w.reuseKg * k;
    routes.energyRecoveryKg += w.energyRecoveryKg * k;
    routes.incinerationKg += w.incinerationKg * k;
  }
  routes.divertedKg = routes.recyclingKg + routes.reuseKg;
  routes.handprintDivertedKg = Math.max(0, routes.divertedKg - (1 - a.mixedWasteShare) * routes.totalKg);

  return {
    washedKg,
    footprint,
    alternative,
    savings,
    savingsEur,
    intensity: {
      waterLPerKg: safeDiv(waterL, washedKg),
      energyKwhPerKg: safeDiv(energyKwh, washedKg),
      co2KgPerKg: safeDiv(footprint.co2Kg, washedKg),
    },
    waste: routes,
  };
}

/* ----------------------------------------------------------------------------
 * Site signals & health
 * ------------------------------------------------------------------------- */

export type SignalKey = "utilization" | "washRhythm" | "requests" | "late" | "dormant";

export const SIGNAL_META: Record<SignalKey, { label: string; higherIsBetter: boolean; tags: PriorityKey[]; unit: "pct" | "num" }> = {
  utilization: { label: "Garments in active use", higherIsBetter: true, tags: ["cost", "circularity"], unit: "pct" },
  washRhythm: { label: "Washes per garment / month", higherIsBetter: true, tags: ["hygiene"], unit: "num" },
  requests: { label: "Service requests / 1,000 wearers", higherIsBetter: false, tags: ["service"], unit: "num" },
  late: { label: "Late service cycles", higherIsBetter: false, tags: ["service"], unit: "pct" },
  dormant: { label: "Dormant tracked garments", higherIsBetter: false, tags: ["cost", "hygiene"], unit: "pct" },
};

export interface SiteSignal {
  key: SignalKey;
  value: number;
  percentile: number; // 0 worst … 1 best within the customer's sites
}

export type HealthStatus = "on-track" | "watch" | "act";

export interface SiteSummary {
  site: Site;
  laundryName: string;
  activity: ActivityTotals;
  cycles: CycleTotals;
  dormancy: DormancyTotals;
  repairs: number;
  repairQuotient: number;
  impact: { washedKg: number; co2SavingKg: number; waterSavingL: number; footprintCo2Kg: number };
  signals: SiteSignal[];
  health: number;
  status: HealthStatus;
  products: string[];
  dataFlags: string[];
}

function percentileRank(values: number[], v: number, higherIsBetter: boolean) {
  if (values.length <= 1) return 0.5;
  const better = values.filter((x) => (higherIsBetter ? x < v : x > v)).length;
  const equal = values.filter((x) => x === v).length - 1;
  return (better + equal * 0.5) / (values.length - 1);
}

export function signalWeights(w: Weights): Record<SignalKey, number> {
  const out = {} as Record<SignalKey, number>;
  for (const k of Object.keys(SIGNAL_META) as SignalKey[]) {
    out[k] = 1 + SIGNAL_META[k].tags.reduce((t, tag) => t + (w[tag] ?? 0), 0);
  }
  return out;
}

export function scoreSites(summaries: Omit<SiteSummary, "signals" | "health" | "status">[], weights: Weights): SiteSummary[] {
  const raw = summaries.map((s) => ({
    utilization: s.activity.utilization,
    washRhythm: s.activity.washesPerGarmentMonth,
    requests: s.activity.requestsPer1000WearerMonths,
    late: s.cycles.cycles ? s.cycles.late / s.cycles.cycles : 0,
    dormant: s.dormancy.dormantShare,
  }));
  const sw = signalWeights(weights);
  const keys = Object.keys(SIGNAL_META) as SignalKey[];
  return summaries.map((s, i) => {
    const signals: SiteSignal[] = keys.map((k) => ({
      key: k,
      value: raw[i][k],
      percentile: percentileRank(
        raw.map((r) => r[k]),
        raw[i][k],
        SIGNAL_META[k].higherIsBetter,
      ),
    }));
    const totalW = keys.reduce((t, k) => t + sw[k], 0);
    const health = signals.reduce((t, sg) => t + sg.percentile * sw[sg.key], 0) / totalW;
    const status: HealthStatus = health < 0.36 ? "act" : health < 0.52 ? "watch" : "on-track";
    return { ...s, signals, health, status };
  });
}

/* ----------------------------------------------------------------------------
 * Review model: one computed object feeds dashboard, AI context and export.
 * ------------------------------------------------------------------------- */

export interface MonthlyPoint {
  month: string;
  washedKg: number;
  wearers: number;
  garments: number;
  utilization: number;
  serviceRequests: number;
  repairs: number;
  co2SavingKg: number;
  waterSavingL: number;
  footprintCo2Kg: number;
  onTimeShare: number;
  washesPerGarment: number;
}

export interface ProductSummary {
  product: Product;
  garmentsLatest: number;
  wearersLatest: number;
  utilization: number;
  washesPerGarmentMonth: number;
  repairs: number;
  repairQuotient: number;
  washedKg: number;
}

export interface ReviewModel {
  customer: Customer;
  scope: Scope;
  baseline: Baseline;
  assumptions: AssumptionValues;
  activity: ActivityTotals;
  cycles: CycleTotals;
  dormancy: DormancyTotals;
  repairs: RepairTotals;
  impact: ImpactTotals;
  sites: SiteSummary[];
  products: ProductSummary[];
  monthly: MonthlyPoint[];
  countries: string[];
  laundries: Array<{ id: string; name: string; country: string; washedKg: number; flagged: boolean }>;
  dataFlags: Array<{ id: string; text: string; severity: "info" | "warning" }>;
}

export function computeReview(ds: Dataset, scope: Scope, baselineId: string, a: AssumptionValues, weights: Weights): ReviewModel {
  const customer = ds.customers.find((c) => c.id === scope.customerId) ?? ds.customers[0];
  const baseline = ds.baselines.find((b) => b.id === baselineId) ?? ds.baselines[0];
  const products = new Map(ds.products.map((p) => [p.id, p]));
  const laundries = new Map(ds.laundries.map((l) => [l.id, l]));

  const act = inScope(ds.activity, scope);
  const rep = inScope(ds.repairs, scope);
  const cyc = inScope(ds.cycles, scope);
  const imp = inScope(ds.impacts, scope);
  const periodEnd = endOfMonth(scope.months[scope.months.length - 1] ?? ds.meta.months[ds.meta.months.length - 1]);
  const periodStart = `${scope.months[0] ?? ds.meta.months[0]}-01`;
  const assets = ds.assets.filter(
    (x) =>
      x.customerId === scope.customerId &&
      (!scope.siteIds?.length || scope.siteIds.includes(x.siteId)) &&
      (!scope.productIds?.length || scope.productIds.includes(x.productId)) &&
      x.firstPickup <= periodEnd &&
      x.lastPickup >= periodStart,
  );

  const washedByProduct = new Map<string, number>();
  for (const r of act) washedByProduct.set(r.productId, (washedByProduct.get(r.productId) ?? 0) + r.washedPieces);

  // Laundry allocation consistency (share > 100%).
  const custKg = new Map<string, number>();
  for (const r of ds.impacts) custKg.set(`${r.laundryId}|${r.month}`, (custKg.get(`${r.laundryId}|${r.month}`) ?? 0) + r.washedKg);
  const flaggedLaundries = new Set(
    ds.laundryMonths.filter((lm) => lm.washedKg > 0 && (custKg.get(`${lm.laundryId}|${lm.month}`) ?? 0) > lm.washedKg * 1.0001).map((lm) => lm.laundryId),
  );

  const scopedSites = ds.sites.filter((s) => s.customerId === customer.id && (!scope.siteIds?.length || scope.siteIds.includes(s.id)));
  const siteBase = scopedSites.map((site) => {
    const sAct = act.filter((r) => r.siteId === site.id);
    const sRep = rep.filter((r) => r.siteId === site.id);
    const sImp = imp.filter((r) => r.siteId === site.id);
    const sWashed = sum(sAct, (r) => r.washedPieces);
    const it = impactTotals(sImp, ds, baseline, a);
    return {
      site,
      laundryName: laundries.get(site.laundryId)?.name ?? site.laundryId,
      activity: activityTotals(sAct),
      cycles: cycleTotals(cyc.filter((r) => r.siteId === site.id)),
      dormancy: dormancy(
        assets.filter((x) => x.siteId === site.id),
        periodEnd,
        a.dormantDays,
      ),
      repairs: sum(sRep, (r) => r.repairCount),
      repairQuotient: safeDiv(sum(sRep, (r) => r.repairCount), sWashed),
      impact: { washedKg: it.washedKg, co2SavingKg: it.savings.base.co2Kg, waterSavingL: it.savings.base.waterL, footprintCo2Kg: it.footprint.co2Kg },
      products: [...new Set(sAct.map((r) => r.productId))],
      dataFlags: flaggedLaundries.has(site.laundryId) ? ["laundry-share"] : [],
    };
  });
  const sites = scoreSites(siteBase, weights);

  const productSummaries: ProductSummary[] = [...new Set(act.map((r) => r.productId))].map((pid) => {
    const pAct = act.filter((r) => r.productId === pid);
    const t = activityTotals(pAct);
    const pr = sum(
      rep.filter((r) => r.productId === pid),
      (r) => r.repairCount,
    );
    return {
      product: products.get(pid)!,
      garmentsLatest: t.garmentsLatest,
      wearersLatest: t.wearerAssignmentsLatest,
      utilization: t.utilization,
      washesPerGarmentMonth: t.washesPerGarmentMonth,
      repairs: pr,
      repairQuotient: safeDiv(pr, t.washedPieces),
      washedKg: t.washedKg,
    };
  });

  const monthly: MonthlyPoint[] = scope.months.map((m) => {
    const mAct = act.filter((r) => r.month === m);
    const t = activityTotals(mAct);
    const it = impactTotals(
      imp.filter((r) => r.month === m),
      ds,
      baseline,
      a,
    );
    const c = cycleTotals(cyc.filter((r) => r.month === m));
    return {
      month: m,
      washedKg: t.washedKg,
      wearers: t.wearersLatest,
      garments: t.garmentsLatest,
      utilization: t.utilization,
      serviceRequests: t.serviceRequests,
      repairs: sum(
        rep.filter((r) => r.month === m),
        (r) => r.repairCount,
      ),
      co2SavingKg: it.savings.base.co2Kg,
      waterSavingL: it.savings.base.waterL,
      footprintCo2Kg: it.footprint.co2Kg,
      onTimeShare: c.onTimeShare,
      washesPerGarment: t.washesPerGarmentMonth,
    };
  });

  const laundryList = [...new Set(scopedSites.map((s) => s.laundryId))].map((id) => ({
    id,
    name: laundries.get(id)?.name ?? id,
    country: laundries.get(id)?.country ?? "",
    washedKg: sum(
      imp.filter((r) => r.laundryId === id),
      (r) => r.washedKg,
    ),
    flagged: flaggedLaundries.has(id),
  }));

  const dataFlags: ReviewModel["dataFlags"] = [];
  for (const l of laundryList.filter((x) => x.flagged)) {
    dataFlags.push({
      id: `share-${l.id}`,
      severity: "warning",
      text: `${l.name}: customers' washed kg adds up to more than the laundry reported. Site figures stay reliable; this laundry's totals are not quoted.`,
    });
  }
  if (assets.length) {
    dataFlags.push({
      id: "rfid-sample",
      severity: "info",
      text: `RFID cycle data covers a sample of ${assets.length.toLocaleString("en-US")} tracked garments; used for turnaround, timeliness and dormancy only.`,
    });
  }
  dataFlags.push({
    id: "wearers-dedup",
    severity: "info",
    text: "Active wearers are de-duplicated as the largest product line per site; the pack's summed figure counts wearer-product assignments.",
  });

  return {
    customer,
    scope,
    baseline,
    assumptions: a,
    activity: activityTotals(act),
    cycles: cycleTotals(cyc),
    dormancy: dormancy(assets, periodEnd, a.dormantDays),
    repairs: repairTotals(rep, washedByProduct, products, a),
    impact: impactTotals(imp, ds, baseline, a),
    sites,
    products: productSummaries,
    monthly,
    countries: [...new Set(scopedSites.map((s) => s.country))],
    laundries: laundryList,
    dataFlags,
  };
}

export function endOfMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo, 0));
  return d.toISOString().slice(0, 10);
}
