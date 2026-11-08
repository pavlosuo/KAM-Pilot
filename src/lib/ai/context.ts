import type { AccountContextValue } from "@/lib/state/account-context";
import { PRIORITY_META } from "@/lib/engine/priorities";
import { PROVENANCE } from "@/lib/engine/provenance";
import { fmtPeriod } from "@/lib/engine/format";
import { audienceLabel, avatarLocation } from "@/lib/engine/avatars";
import { carbonValue, metricReading, rankRules } from "@/lib/engine/regulatory";
import { briefCompanyFacts } from "@/lib/regulation/types";

const r = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Compact, fully-calculated fact sheet sent to the AI. The model narrates and
 * prioritises these facts; it never computes new figures on its own.
 */
export function buildAiContext(a: AccountContextValue) {
  const m = a.model;
  const s = a.settings.scenario;
  return {
    disclaimer: "Figures come from the uploaded customer data. Preserve source statuses and estimate/assumption labels. Uploading does not establish audit or verification.",
    customer: { name: m.customer.name, industry: m.customer.industry, segment: m.customer.segment, statedTopics: m.customer.priorityTopics },
    period: fmtPeriod(a.months[0], a.months[a.months.length - 1]),
    baseline: { name: m.baseline.name, note: m.baseline.note },
    headlineScenario: s,
    audience: {
      avatar: audienceLabel(a.avatar),
      role: a.avatar.role,
      tone: a.avatar.tone,
      detail: a.avatar.detail,
      concerns: a.avatar.concerns,
      showMoney: a.avatar.showMoney,
      location: avatarLocation(a.avatar),
      decisionsOwned: a.avatar.profile?.decisions ?? [],
      goals: a.avatar.profile?.goals ?? [],
      reportingDuties: a.avatar.profile?.reporting ?? [],
      upcomingMoments: a.avatar.profile?.moments ?? [],
      avoid: a.avatar.profile?.avoid ?? [],
    },
    countryRules: countryRules(a),
    priorityRanking: a.ranked.slice(0, 5).map((k) => ({ key: k, label: PRIORITY_META[k].label, weight: r(a.weights[k], 2) })),
    userPriorityStatement: a.settings.prompt?.text ?? null,
    kpis: {
      deliverySites: m.sites.length,
      activeWearers_dedupEstimate: m.activity.wearersLatest,
      wearerProductAssignments: m.activity.wearerAssignmentsLatest,
      garmentsInCirculation: m.activity.garmentsLatest,
      rfidActiveGarments: m.activity.rfidActiveLatest,
      garmentUtilizationPct: r(m.activity.utilization * 100, 1),
      idleGarments: m.activity.idleLatest,
      washedKg: r(m.activity.washedKg),
      washesPerGarmentPerMonth: r(m.activity.washesPerGarmentMonth, 2),
      expectedWashesPerMonth_P02: a.assumptions.washTargetPerMonth,
      serviceRequests: m.activity.serviceRequests,
      requestFreeSiteMonthsPct: r(m.activity.requestFreeSiteMonthShare * 100, 1),
      onTimeCyclesPct: m.cycles.cycles ? r(m.cycles.onTimeShare * 100, 2) : null,
      avgCycleHours: m.cycles.cycles ? r(m.cycles.avgHours, 1) : null,
      repairs: m.repairs.repairs,
      dormantTrackedGarmentsPct: r(m.dormancy.dormantShare * 100, 1),
    },
    footprint_allocated: {
      waterL: r(m.impact.footprint.waterL),
      energyKwh: r(m.impact.footprint.energyKwh),
      co2Kg: r(m.impact.footprint.co2Kg),
      textileWasteKg: r(m.impact.footprint.wasteKg),
      provenance: PROVENANCE.footprintCo2.cls,
    },
    handprint_vs_baseline: {
      waterSavingL: { low: r(m.impact.savings.low.waterL), base: r(m.impact.savings.base.waterL), high: r(m.impact.savings.high.waterL) },
      energySavingKwh: { low: r(m.impact.savings.low.energyKwh), base: r(m.impact.savings.base.energyKwh), high: r(m.impact.savings.high.energyKwh) },
      co2SavingKg: { low: r(m.impact.savings.low.co2Kg), base: r(m.impact.savings.base.co2Kg), high: r(m.impact.savings.high.co2Kg) },
      moneyValueEur_illustrative: {
        base: r(m.impact.savingsEur.base.energy + m.impact.savingsEur.base.water),
        note: "Illustrative prices P04/P05; not contract prices",
      },
      replacementsPostponed: { low: r(m.repairs.postponed.low), base: r(m.repairs.postponed.base), high: r(m.repairs.postponed.high) },
      avoidedProductCo2Kg: { low: r(m.repairs.avoidedKgCo2e.low), base: r(m.repairs.avoidedKgCo2e.base), high: r(m.repairs.avoidedKgCo2e.high) },
      wasteToRecyclingOrReuseKg: r(m.impact.waste.divertedKg),
      provenance: "estimated",
    },
    sites: m.sites.map((x) => ({
      name: x.site.name,
      country: x.site.country,
      type: x.site.siteType,
      status: x.status,
      utilizationPct: r(x.activity.utilization * 100, 1),
      washesPerGarmentMonth: r(x.activity.washesPerGarmentMonth, 2),
      requestsPer1000WearerMonths: r(x.activity.requestsPer1000WearerMonths, 2),
      latePct: r(x.cycles.cycles ? (x.cycles.late / x.cycles.cycles) * 100 : 0, 2),
      dormantPct: r(x.dormancy.dormantShare * 100, 1),
      wearers: x.activity.wearersLatest,
      co2SavingKg: r(x.impact.co2SavingKg),
      dataFlag: x.dataFlags.length ? "laundry totals inconsistent" : null,
    })),
    products: m.products.map((p) => ({
      name: p.product.name,
      garments: p.garmentsLatest,
      utilizationPct: r(p.utilization * 100, 1),
      repairQuotientPct: r(p.repairQuotient * 100, 2),
      repairs: p.repairs,
    })),
    rebalancingPlan: {
      transferablePieces: a.plan.transferredPieces,
      releasablePieces: a.plan.returnedPieces,
      transfers: a.plan.transfers.slice(0, 8).map((t) => ({
        from: a.customerSites.find((x) => x.id === t.fromSiteId)?.name,
        to: a.customerSites.find((x) => x.id === t.toSiteId)?.name,
        product: a.dataset.products.find((p) => p.id === t.productId)?.name,
        pieces: t.pieces,
      })),
    },
    observations: a.observations.slice(0, 10).map((o) => ({
      kind: o.kind,
      title: o.title,
      detail: o.detail,
      action: o.action,
      owner: o.owner,
      steeringQuestion: o.question,
      confidence: o.confidence,
      assumptions: o.assumptionIds,
    })),
    dataFlags: m.dataFlags.map((f) => f.text),
    assumptions: {
      A002_repairFactor: a.assumptions.repairFactor,
      P01_baselineBand: a.assumptions.baselineBand,
      P02_washTarget: a.assumptions.washTargetPerMonth,
      P03_targetUtilization: a.assumptions.targetUtilization,
      P06_dormantDays: a.assumptions.dormantDays,
    },
  };
}

function countryRules(a: AccountContextValue) {
  if (!a.brief) return null;
  const cv = carbonValue(a.model, a.brief);
  const facts = briefCompanyFacts(a.brief);
  return {
    note: "AI web research of public sources; cite as 'according to <source>' and never present as legal or tax advice.",
    country: a.brief.country,
    researchedAt: a.brief.generatedAt.slice(0, 10),
    carbonPrice: cv
      ? {
          instrument: cv.price.instrument,
          year: cv.price.year,
          eurPerTonne: cv.price.eurPerTonne,
          appliesTo: cv.price.appliesTo,
          source: cv.price.source.url,
          avoidedCo2CarbonValueEur_illustrative: { low: r(cv.eur.low), base: r(cv.eur.base), high: r(cv.eur.high) },
        }
      : null,
    companyOrSector: facts ? { foundForCompany: facts.found, summary: facts.summary, targets: facts.targets } : null,
    rules: rankRules(a.brief, a.weights)
      .slice(0, 8)
      .map((x) => ({
        title: x.title,
        status: x.status,
        effective: x.effective,
        jurisdiction: x.jurisdiction,
        whyItMatters: x.relevance,
        talkingPoint: x.action,
        linkedAccountFigure: metricReading(a.model, x.metric, a.settings.scenario),
        source: x.sources[0]?.url ?? null,
      })),
  };
}

export type AiContext = ReturnType<typeof buildAiContext>;
