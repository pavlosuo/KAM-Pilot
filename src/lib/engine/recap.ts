import type { Customer, Dataset } from "../data/types";
import { audienceArchetypes } from "../avatar/audience";
import type { RegulatoryBrief } from "../regulation/types";
import type { Scenario } from "./assumptions";
import { audienceLabel, type ArchetypeId, type Avatar } from "./avatars";
import {
  aboutCount,
  aboutNumber,
  carEquivalent,
  demonym,
  energyEquivalent,
  perWorkingDay,
  waterEquivalent,
  waterPeople,
  type Factor,
} from "./equivalents";
import { fmtMonth, fmtNum } from "./format";
import type { HealthStatus, ReviewModel, SiteSummary } from "./metrics";
import type { Observation } from "./observations";
import type { PriorityKey, Weights } from "./priorities";
import type { RebalancePlan } from "./rebalance";
import { carbonValue, ruleTimeline } from "./regulatory";

/**
 * The Recap: five questions answered from the uploaded data as a short visual
 * story. Three questions are asked of every Lindström customer (what the year
 * brought - money first -, where the risks are, what to do next); two are
 * chosen for the person's role and for the company's industry and stated
 * priorities. Everything is deterministic: the same data and audience always
 * tell the same story, and every figure comes from the shared review model.
 */

export type RecapTone = "navy" | "blue" | "green" | "red" | "orange" | "pink" | "turquoise" | "purple";

export interface RecapFigure {
  /** Number the counter animates to (already scaled, e.g. 1.4 for "1.4 million"). */
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  text: string;
}

/**
 * Where a Recap element leads in the dashboard. The engine names the place;
 * the page maps it to a route, so the story stays renderer- and router-free.
 */
export type RecapTarget =
  | { page: "overview"; hash?: string }
  | { page: "sites"; color?: "status" | "utilization" | "washRhythm" | "co2"; status?: HealthStatus; sort?: "requests" | "late" | "dormant" | "wash" | "utilization" | "co2" }
  | { page: "site"; siteId: string }
  | { page: "impact"; hash?: string }
  | { page: "insights"; hash?: string }
  | { page: "rules"; hash?: string }
  | { page: "trust"; hash?: string };

export interface RecapLink {
  to: RecapTarget;
  /** Short name of the place ("Sites by wash rhythm"). */
  label: string;
}

export type RecapVisual =
  | { kind: "stack"; parts: Array<{ label: string; value: number; text: string; tone: RecapTone; link?: RecapLink }> }
  | { kind: "icons"; icon: "family" | "home" | "garment" | "truck"; count: number; dim?: number; caption: string }
  | { kind: "earth"; laps: number; km: number }
  | { kind: "ring"; value: number; label: string; tone: RecapTone }
  | { kind: "sites"; sites: Array<{ name: string; status: HealthStatus; siteId?: string }>; caption: string }
  | { kind: "bars"; bars: Array<{ label: string; value: number; text: string; tone: RecapTone; link?: RecapLink }>; caption?: string }
  | { kind: "steps"; steps: Array<{ title: string; detail: string; owner: string; link?: RecapLink }> }
  | { kind: "targets"; items: Array<{ kpi: string; current: string; target: string; link?: RecapLink }> }
  | { kind: "timeline"; items: Array<{ when: string; title: string; status: string; link?: RecapLink }> };

export interface RecapBeat {
  id: string;
  kicker: string;
  figure?: RecapFigure;
  /** Unit shown after the figure ("litres of water"). */
  unit?: string;
  headline: string;
  /** What the number means, in everyday terms. */
  comparison?: string;
  visual: RecapVisual;
  note?: string;
  tone: RecapTone;
  /** Dashboard place with the detail behind this answer. */
  link?: RecapLink;
}

export interface RecapChapter {
  id: string;
  number: number;
  scope: "common" | "role" | "company" | "person";
  /** Small label above the question ("For every customer", "For a procurement manager"). */
  label: string;
  question: string;
  answer: string;
  beats: RecapBeat[];
}

export interface Recap {
  periodLabel: string;
  title: string;
  audience: string;
  scopeLabel: string;
  sitesInScope: number;
  wearers: number;
  /** The year at a glance (cover). */
  stats: Array<{ value: string; label: string; link: RecapLink }>;
  chapters: RecapChapter[];
  closing: { headline: string; actions: string[]; questions: string[] };
  sources: Array<{ label: string; url: string }>;
  disclosure: string;
}

export interface RecapInput {
  model: ReviewModel;
  dataset: Dataset;
  plan: RebalancePlan;
  observations: Observation[];
  avatar: Avatar;
  weights: Weights;
  brief: RegulatoryBrief | null;
  scenario: Scenario;
  today: Date;
  /** Human label of the audience's locations ("Finland", "All locations"). */
  locationLabel: string;
  /** Insights the KAM chose for the review; they become the next steps when set. */
  picked?: string[] | null;
}

/* ----------------------------------------------------------------------------
 * Dashboard links
 * ------------------------------------------------------------------------- */

const L = {
  money: { to: { page: "impact", hash: "money" }, label: "Value in euros" },
  savings: { to: { page: "impact", hash: "savings" }, label: "Water, energy and CO₂" },
  emissions: { to: { page: "impact", hash: "emissions" }, label: "Emissions by month" },
  alternatives: { to: { page: "impact", hash: "alternatives" }, label: "Every alternative compared" },
  repairs: { to: { page: "impact", hash: "repairs" }, label: "Repairs and product life" },
  waste: { to: { page: "impact", hash: "waste" }, label: "Textile waste routes" },
  intensity: { to: { page: "impact", hash: "intensity" }, label: "Per kilo washed" },
  sites: { to: { page: "sites" }, label: "All sites" },
  sitesAct: { to: { page: "sites", status: "act" }, label: "Sites to act on" },
  sitesWatch: { to: { page: "sites", status: "watch" }, label: "Sites to watch" },
  sitesWash: { to: { page: "sites", color: "washRhythm", sort: "wash" }, label: "Wash rhythm per site" },
  sitesUse: { to: { page: "sites", color: "utilization", sort: "utilization" }, label: "Garment use per site" },
  sitesRequests: { to: { page: "sites", sort: "requests" }, label: "Requests per site" },
  sitesLate: { to: { page: "sites", sort: "late" }, label: "Late deliveries per site" },
  sitesDormant: { to: { page: "sites", sort: "dormant" }, label: "Missing garments per site" },
  sitesCo2: { to: { page: "sites", color: "co2", sort: "co2" }, label: "CO₂ saved per site" },
  health: { to: { page: "overview", hash: "service-health" }, label: "Service health" },
  rebalance: { to: { page: "insights", hash: "rebalance" }, label: "Right-sizing plan" },
  plan: { to: { page: "insights", hash: "plan" }, label: "Improvement plan" },
  insights: { to: { page: "insights" }, label: "All insights" },
  carbon: { to: { page: "rules", hash: "carbon" }, label: "Carbon price" },
  deadlines: { to: { page: "rules", hash: "deadlines" }, label: "Deadlines" },
  readiness: { to: { page: "trust", hash: "readiness" }, label: "Reporting readiness" },
} satisfies Record<string, RecapLink>;

const siteLink = (s: SiteSummary): RecapLink => ({ to: { page: "site", siteId: s.site.id }, label: siteLabel(s) });
const obsLink = (o: Observation): RecapLink => ({ to: { page: "insights", hash: `obs-${o.id}` }, label: "The insight" });
const ruleLink = (id: string): RecapLink => ({ to: { page: "rules", hash: `rule-${id}` }, label: "The rule" });

/* ------------------------------------------------------------------------- */

function figure(v: number, opts: { prefix?: string; suffix?: string; decimals?: number } = {}): RecapFigure {
  const prefix = opts.prefix ?? "";
  const a = Math.abs(v);
  let value: number;
  let decimals = opts.decimals ?? 0;
  let suffix = opts.suffix ?? "";
  if (a >= 1e6) {
    value = Math.round(v / 1e5) / 10;
    decimals = 1;
    suffix = ` million${suffix}`;
  } else if (a >= 1e4) {
    value = Math.round(v / 1000) * 1000;
    decimals = 0;
  } else {
    const k = 10 ** decimals;
    value = Math.round(v * k) / k;
  }
  const text = `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  return { value, decimals, prefix, suffix, text };
}

const pctFigure = (share: number, decimals = 0) => figure(share * 100, { suffix: "%", decimals });
const eur = (v: number) => `€${fmtNum(v >= 1e4 ? Math.round(v / 1000) * 1000 : v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v))}`;
const siteLabel = (s: SiteSummary) => s.site.city || s.site.name.replace(/^[A-Za-z]+\s/, "");

function periodLabel(months: string[]): string {
  if (!months.length) return "the period";
  const y0 = months[0].slice(0, 4);
  const y1 = months[months.length - 1].slice(0, 4);
  if (y0 === y1 && months.length >= 12) return y0;
  return `${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])}`;
}

interface Ctx {
  m: ReviewModel;
  ds: Dataset;
  plan: RebalancePlan;
  obs: Observation[];
  avatar: Avatar;
  weights: Weights;
  brief: RegulatoryBrief | null;
  scenario: Scenario;
  today: Date;
  customer: Customer;
  country: string | null;
  months: number;
  period: string;
  baseline: string;
  wearers: number;
  factors: Map<string, Factor>;
  picked: string[] | null;
}

const relevance = (c: Ctx, tags: PriorityKey[]) => tags.reduce((t, k) => t + (c.weights[k] ?? 0), 0);

/* ----------------------------------------------------------------------------
 * Question 1 - what the year brought (money first)
 * ------------------------------------------------------------------------- */

function moneyBeat(c: Ctx): RecapBeat | null {
  const s = c.scenario;
  const parts: Array<{ label: string; value: number; text: string; tone: RecapTone; link?: RecapLink }> = [];
  const repairs = c.m.repairs.avoidedPurchaseEur[s];
  if (repairs > 0) parts.push({ label: "New garments not needed thanks to repairs", value: repairs, text: eur(repairs), tone: "navy", link: L.repairs });
  const energy = c.m.impact.savingsEur[s].energy;
  if (energy > 0) parts.push({ label: `Energy not used vs ${c.baseline}`, value: energy, text: eur(energy), tone: "blue", link: L.money });
  const water = c.m.impact.savingsEur[s].water;
  if (water > 0) parts.push({ label: `Water not used vs ${c.baseline}`, value: water, text: eur(water), tone: "turquoise", link: L.money });
  const carbon = carbonValue(c.m, c.brief);
  if (carbon && carbon.eur[s] > 0)
    parts.push({ label: `CO₂ avoided at ${c.brief?.country}'s carbon price (€${fmtNum(carbon.price.eurPerTonne)}/t)`, value: carbon.eur[s], text: eur(carbon.eur[s]), tone: "green", link: L.carbon });
  const total = parts.reduce((t, p) => t + p.value, 0);
  if (total <= 0) return null;
  const perWearer = c.wearers ? total / c.wearers : 0;
  return {
    id: "money",
    kicker: "Value for your business",
    figure: figure(total, { prefix: "€" }),
    headline: `of value from the Lindström service in ${c.period}`,
    comparison: perWearer >= 1 ? `That is about €${aboutNumber(perWearer)} for each of your ${fmtNum(c.wearers)} wearers.` : undefined,
    visual: { kind: "stack", parts },
    note: `Repairs are valued at the garment purchase price in your data; how much of it shows on your invoice depends on your contract. Energy at €${c.m.assumptions.electricityEurPerKwh}/kWh and water at €${c.m.assumptions.waterEurPerM3}/m³ (editable in Trust center).`,
    tone: "navy",
    link: L.money,
  };
}

function waterComparison(litres: number, country: string | null): { text: string; icons: number; caption: string; factor: Factor } {
  const eq = waterEquivalent(litres, country);
  const where = eq.country ? `in ${eq.country}` : "in Europe";
  if (eq.families >= 1.5) {
    const who = `${demonym(eq.country)} families of four`;
    return {
      text: `That is the water about ${aboutCount(eq.families)} ${who} use at home in a whole year - or ${aboutCount(eq.bathtubs)} full bathtubs.`,
      icons: Math.min(100, Math.round(eq.families)),
      caption: `Each icon: one family's water for a year ${where}`,
      factor: eq.factor,
    };
  }
  const people = waterPeople(litres, eq.factor);
  return {
    text: people >= 1 ? `That is the water about ${aboutCount(people)} people ${where} use at home in a year - or ${aboutCount(eq.bathtubs)} full bathtubs.` : `That is about ${aboutCount(eq.bathtubs)} full bathtubs.`,
    icons: Math.max(1, Math.min(100, Math.round(people))),
    caption: `Each icon: one person's water for a year ${where}`,
    factor: eq.factor,
  };
}

function waterBeat(c: Ctx): RecapBeat | null {
  const l = c.m.impact.savings[c.scenario].waterL;
  if (l <= 0) return null;
  const cmp = waterComparison(l, c.country);
  c.factors.set("water", cmp.factor);
  return {
    id: "water",
    kicker: "Water",
    figure: figure(l),
    unit: "litres of water",
    headline: `saved compared with ${c.baseline}`,
    comparison: cmp.text,
    visual: { kind: "icons", icon: "family", count: Math.max(1, cmp.icons), caption: cmp.caption },
    note: `Comparison: ${cmp.factor.source}.`,
    tone: "blue",
    link: L.savings,
  };
}

function co2Beat(c: Ctx): RecapBeat | null {
  const kg = c.m.impact.savings[c.scenario].co2Kg;
  if (kg <= 0) return null;
  const car = carEquivalent(kg);
  c.factors.set("car", car.factor);
  return {
    id: "co2",
    kicker: "Climate",
    figure: figure(kg / 1000, { decimals: kg < 10_000 ? 1 : 0 }),
    unit: "tonnes of CO₂",
    headline: `less than with ${c.baseline}`,
    comparison:
      car.earthLaps >= 1
        ? `Like driving a new car ${aboutNumber(car.km)} km - about ${aboutCount(car.earthLaps)} times around the Earth.`
        : `Like driving a new car about ${aboutNumber(car.km)} km.`,
    visual: { kind: "earth", laps: car.earthLaps, km: car.km },
    note: `Comparison: ${car.factor.source}.`,
    tone: "green",
    link: L.emissions,
  };
}

function energyBeat(c: Ctx): RecapBeat | null {
  const kwh = c.m.impact.savings[c.scenario].energyKwh;
  if (kwh <= 0) return null;
  const eq = energyEquivalent(kwh, c.country);
  c.factors.set("energy", eq.factor);
  const homes = eq.country ? `${demonym(eq.country)} homes` : "European homes";
  return {
    id: "energy",
    kicker: "Energy",
    figure: figure(kwh),
    unit: "kWh of energy",
    headline: `saved compared with ${c.baseline}`,
    comparison: `About the electricity ${aboutCount(eq.homes)} ${homes} use in a year.`,
    visual: { kind: "icons", icon: "home", count: Math.max(1, Math.min(100, Math.round(eq.homes))), caption: `= ${homes}' electricity for a year` },
    note: `Comparison: ${eq.factor.source}.`,
    tone: "orange",
    link: L.savings,
  };
}

function repairsBeat(c: Ctx): RecapBeat | null {
  const n = c.m.repairs.repairs;
  if (n <= 0) return null;
  const perDay = perWorkingDay(n, c.months);
  return {
    id: "repairs",
    kicker: "Circular economy",
    figure: figure(n),
    unit: "garments repaired",
    headline: "instead of being thrown away and replaced",
    comparison: perDay >= 1 ? `That is about ${aboutCount(perDay)} garments rescued every working day.` : undefined,
    visual: { kind: "icons", icon: "garment", count: Math.max(1, Math.min(100, Math.round(perDay))), caption: "= garments repaired on an average working day" },
    tone: "purple",
    link: L.repairs,
  };
}

function washedBeat(c: Ctx): RecapBeat {
  return {
    id: "washed",
    kicker: "Service",
    figure: figure(c.m.impact.washedKg / 1000, { decimals: 1 }),
    unit: "tonnes of workwear washed",
    headline: `for ${fmtNum(c.wearers)} wearers at ${c.m.sites.length} sites`,
    visual: { kind: "icons", icon: "truck", count: Math.max(1, Math.min(60, Math.round(c.m.sites.length))), caption: "= sites served" },
    tone: "navy",
    link: L.sites,
  };
}

/* ----------------------------------------------------------------------------
 * Question 2 - risks
 * ------------------------------------------------------------------------- */

type RiskId = "sites" | "rhythm" | "idle" | "dormant" | "late" | "requests" | "rules" | "evidence";

interface Candidate {
  id: RiskId;
  severity: number;
  tags: PriorityKey[];
  beat: RecapBeat;
}

const RHYTHM_TONE = (ratio: number): HealthStatus => (ratio >= 1 ? "on-track" : ratio >= 0.75 ? "watch" : "act");

function rhythmBeat(c: Ctx, id = "rhythm"): RecapBeat | null {
  const v = c.m.activity.washesPerGarmentMonth;
  const target = c.m.assumptions.washTargetPerMonth;
  if (v <= 0 || !target) return null;
  const days = 30.4 / v;
  return {
    id,
    kicker: "Hygiene",
    figure: figure(v, { decimals: 1 }),
    unit: "washes per garment a month",
    headline: `against the ${fmtNum(target)} a month a hygiene plan expects`,
    comparison: `A garment in use is washed about every ${aboutCount(days)} days, instead of every ${aboutCount(30.4 / target)}.`,
    visual: {
      kind: "bars",
      bars: [
        { label: "Your garments", value: v, text: fmtNum(v, 1), tone: v >= target ? "green" : "red" },
        { label: "Expected rhythm", value: target, text: fmtNum(target, 0), tone: "navy" },
      ],
      caption: "Washes per allocated garment per month",
    },
    note: "Measured per allocated garment, so unused garments lower the average. Set the expected rhythm per contract in Trust center.",
    tone: v >= target ? "green" : "red",
    link: L.sitesWash,
  };
}

function riskCandidates(c: Ctx): Candidate[] {
  const out: Candidate[] = [];
  const sites = c.m.sites;
  const act = sites.filter((s) => s.status === "act");
  const watch = sites.filter((s) => s.status === "watch");
  if (act.length || watch.length) {
    out.push({
      id: "sites",
      severity: sites.length ? (act.length * 2 + watch.length * 0.5) / sites.length : 0,
      tags: ["service", "hygiene", "cost"],
      beat: {
        id: "risk-sites",
        kicker: "Sites",
        figure: figure(act.length || watch.length),
        unit: act.length ? (act.length === 1 ? "site needs action now" : "sites need action now") : `site${watch.length === 1 ? "" : "s"} to watch`,
        headline: act.length
          ? `${act.map(siteLabel).slice(0, 3).join(", ")}${act.length > 3 ? " and others" : ""}${watch.length ? ` - and ${watch.length} more to keep an eye on` : ""}`
          : `out of ${sites.length} - none needs urgent action`,
        comparison: `${sites.length - act.length - watch.length} of ${sites.length} sites are on track today.`,
        visual: { kind: "sites", sites: sites.map((s) => ({ name: siteLabel(s), status: s.status, siteId: s.site.id })), caption: "Each dot is one of your sites" },
        note: "Site health combines garment use, wash rhythm, service requests, late deliveries and unused garments, compared with your own other sites.",
        tone: act.length ? "red" : "orange",
        link: act.length ? L.sitesAct : L.sitesWatch,
      },
    });
  }
  const ratio = c.m.assumptions.washTargetPerMonth ? c.m.activity.washesPerGarmentMonth / c.m.assumptions.washTargetPerMonth : 1;
  const rb = rhythmBeat(c, "risk-rhythm");
  if (rb && ratio < 0.85) out.push({ id: "rhythm", severity: (1 - ratio) * 1.2, tags: ["hygiene"], beat: rb });

  const util = c.m.activity.utilization;
  const target = c.m.assumptions.targetUtilization;
  if (util < target && c.m.activity.idleLatest > 0) {
    const idleShare = 1 - util;
    out.push({
      id: "idle",
      severity: ((target - util) / target) * 3,
      tags: ["cost", "circularity"],
      beat: {
        id: "risk-idle",
        kicker: "Unused garments",
        figure: figure(c.m.activity.idleLatest),
        unit: "garments not in use",
        headline: `in ${c.m.activity.lastMonth ? fmtMonth(c.m.activity.lastMonth, "long") : "the last month"} - rented, but not seen in circulation`,
        comparison: `That is ${aboutCount(idleShare * 100)} of every 100 garments you rent.`,
        visual: { kind: "icons", icon: "garment", count: 100, dim: Math.round(idleShare * 100), caption: "100 garments: grey ones are not in use" },
        tone: "orange",
        link: L.rebalance,
      },
    });
  }
  const dorm = c.m.dormancy;
  if (dorm.trackedAssets > 0 && dorm.dormantShare > 0.1) {
    out.push({
      id: "dormant",
      severity: dorm.dormantShare,
      tags: ["cost", "hygiene"],
      beat: {
        id: "risk-dormant",
        kicker: "Missing garments",
        figure: pctFigure(dorm.dormantShare),
        unit: "of tracked garments",
        headline: `have not been collected for ${Math.round(c.m.assumptions.dormantDays / 30)} months`,
        comparison: `${fmtNum(dorm.dormantAssets)} of ${fmtNum(dorm.trackedAssets)} RFID-tagged garments - likely unused, lost or kept by people who left.`,
        visual: { kind: "ring", value: dorm.dormantShare, label: "not collected", tone: "red" },
        tone: "red",
        link: L.sitesDormant,
      },
    });
  }
  const cyc = c.m.cycles;
  if (cyc.cycles > 0 && cyc.late / cyc.cycles > 0.01) {
    const share = cyc.late / cyc.cycles;
    out.push({
      id: "late",
      severity: share * 8,
      tags: ["service"],
      beat: {
        id: "risk-late",
        kicker: "Late deliveries",
        figure: figure(cyc.late),
        unit: "late service cycles",
        headline: `out of ${fmtNum(cyc.cycles)} tracked deliveries`,
        comparison: `${fmtNum((1 - share) * 100, 1)}% arrived on time.`,
        visual: { kind: "ring", value: 1 - share, label: "on time", tone: "green" },
        tone: "orange",
        link: L.sitesLate,
      },
    });
  }
  if (c.m.activity.requestsPer1000WearerMonths > 3) {
    const perWeek = c.m.activity.serviceRequests / Math.max(1, (c.months * 52) / 12);
    const top = [...c.m.sites].sort((a, b) => b.activity.serviceRequests - a.activity.serviceRequests).slice(0, 5);
    out.push({
      id: "requests",
      severity: Math.min(1, c.m.activity.requestsPer1000WearerMonths / 12),
      tags: ["service"],
      beat: {
        id: "risk-requests",
        kicker: "Service requests",
        figure: figure(c.m.activity.serviceRequests),
        unit: "service requests",
        headline: `in ${c.period} - about ${aboutNumber(perWeek)} a week`,
        comparison: `${top[0] ? `${siteLabel(top[0])} raised the most (${fmtNum(top[0].activity.serviceRequests)}).` : ""}`,
        visual: {
          kind: "bars",
          bars: top.map((s, i) => ({ label: siteLabel(s), value: s.activity.serviceRequests, text: fmtNum(s.activity.serviceRequests), tone: i === 0 ? "red" : "navy", link: siteLink(s) })),
          caption: "Sites with the most requests",
        },
        tone: "orange",
        link: L.sitesRequests,
      },
    });
  }
  const upcoming = ruleTimeline(c.brief, c.today).filter((t) => t.monthsAway >= -3 && t.monthsAway <= 36);
  if (upcoming.length) {
    out.push({
      id: "rules",
      severity: 0.35 + Math.min(0.3, upcoming.length * 0.08),
      tags: ["evidence", "emissions"],
      beat: {
        id: "risk-rules",
        kicker: `${c.brief?.country ?? "Country"} rules`,
        figure: figure(upcoming.length),
        unit: `rule${upcoming.length === 1 ? "" : "s"} coming into force`,
        headline: "in the next three years that touch your workwear figures",
        visual: {
          kind: "timeline",
          items: upcoming.slice(0, 4).map((t) => ({ when: t.item.effective ?? "", title: t.item.title, status: t.monthsAway <= 0 ? "Applies now" : `In ${t.monthsAway} months`, link: ruleLink(t.item.id) })),
        },
        note: "Researched summaries of public sources, not legal or tax advice.",
        tone: "purple",
        link: L.deadlines,
      },
    });
  }
  out.push({
    id: "evidence",
    severity: 0.15,
    tags: ["evidence"],
    beat: {
      id: "risk-evidence",
      kicker: "Reporting",
      headline: "Footprint figures are shared estimates - good for decisions, not yet for an audited report",
      comparison: "Water, energy and CO₂ come from laundry totals shared by washed kilos. Connecting meter data and approved factors makes them reportable.",
      visual: { kind: "steps", steps: [{ title: "Laundry totals", detail: "Measured per laundry", owner: "Lindström" }, { title: "Shared by kilos", detail: "Your share of washed kg", owner: "Estimate" }, { title: "Your report", detail: "Needs approved factors", owner: "Together" }] },
      tone: "turquoise",
      link: L.readiness,
    },
  });
  return out;
}

/* ----------------------------------------------------------------------------
 * Question 3 - next steps
 * ------------------------------------------------------------------------- */

function nextChapterBeats(c: Ctx, covered: Set<string>): RecapBeat[] {
  const beats: RecapBeat[] = [];
  const picks: Observation[] = [];
  const seen = new Set<string>();
  // The KAM's own review picks lead; otherwise the top-ranked actions for this person.
  const chosen = c.picked?.length ? c.obs.filter((o) => c.picked!.includes(o.id)) : [];
  for (const o of [...chosen, ...c.obs]) {
    if (o.kind === "value" || seen.has(o.action)) continue;
    seen.add(o.action);
    picks.push(o);
    if (picks.length >= 3) break;
  }
  if (picks.length) {
    beats.push({
      id: "next-steps",
      kicker: "Three steps",
      headline: `What we suggest for the next 12 months`,
      visual: { kind: "steps", steps: picks.map((o) => ({ title: o.action, detail: o.title, owner: o.owner, link: obsLink(o) })) },
      tone: "navy",
      link: L.insights,
    });
  }
  const p = c.plan;
  if (p.capitalEurReleased > 0 && !covered.has("rebalance")) {
    beats.push({
      id: "next-rebalance",
      kicker: "Quick win",
      figure: figure(p.capitalEurReleased, { prefix: "€" }),
      unit: "of workwear can be put to work",
      headline: "by moving spare garments to busy sites or returning them",
      comparison: p.transferredPieces
        ? `${fmtNum(p.transferredPieces)} garments can move between your own sites and ${fmtNum(p.returnedPieces)} can go back to Lindström - before anything new is ordered.`
        : `${fmtNum(p.returnedPieces)} spare garments can go back to Lindström before anything new is ordered.`,
      visual: {
        kind: "bars",
        bars: [
          { label: "Move to a busier site", value: p.transferredPieces, text: fmtNum(p.transferredPieces), tone: "green" },
          { label: "Return to Lindström", value: p.returnedPieces, text: fmtNum(p.returnedPieces), tone: "blue" },
        ],
        caption: "Garments, based on the last three months",
      },
      note: "Valued at garment purchase price; Lindström reuses returned garments for other customers.",
      tone: "green",
      link: L.rebalance,
    });
  }
  const targets = c.obs.filter((o) => o.plan && o.plan.current !== o.plan.target).slice(0, 3);
  if (targets.length) {
    beats.push({
      id: "next-targets",
      kicker: "How we will know",
      headline: "Targets for the next review, taken from your own best sites",
      visual: { kind: "targets", items: targets.map((o) => ({ kpi: o.plan!.kpi, current: o.plan!.current, target: o.plan!.target, link: obsLink(o) })) },
      tone: "turquoise",
      link: L.plan,
    });
  }
  return beats;
}

/* ----------------------------------------------------------------------------
 * Questions 4 & 5 - role and company specific
 * ------------------------------------------------------------------------- */

interface Topic {
  id: string;
  tags: PriorityKey[];
  industries?: RegExp;
  topics?: RegExp;
  /** Risk candidates (and question-1 beats) this topic already covers. */
  covers: string[];
  question: (c: Ctx, archetype?: ArchetypeId) => string;
  build: (c: Ctx) => { answer: string; beats: RecapBeat[] } | null;
}

const TOPICS: Topic[] = [
  {
    id: "idle-garments",
    tags: ["cost", "circularity"],
    industries: /manufactur|industr/i,
    topics: /cost|utili[sz]ation/i,
    covers: ["idle", "dormant", "rebalance"],
    question: () => "Are you paying for garments nobody uses?",
    build: (c) => {
      const a = c.m.activity;
      if (!a.garmentsLatest) return null;
      const beats: RecapBeat[] = [
        {
          id: "idle-util",
          kicker: "Garments in use",
          figure: pctFigure(a.utilization),
          unit: "of rented garments",
          headline: "were actually worn and washed during the year",
          comparison: a.idleLatest > 0 ? `${fmtNum(a.idleLatest)} garments sat unused in ${a.lastMonth ? fmtMonth(a.lastMonth, "long") : "the last month"}.` : "Practically every garment was in use.",
          visual: { kind: "icons", icon: "garment", count: 100, dim: Math.round((1 - a.utilization) * 100), caption: "100 garments: grey ones are not in use" },
          tone: a.utilization >= c.m.assumptions.targetUtilization ? "green" : "orange",
          link: L.sitesUse,
        },
      ];
      if (c.plan.capitalEurReleased > 0) {
        beats.push({
          id: "idle-release",
          kicker: "Money tied up",
          figure: figure(c.plan.capitalEurReleased, { prefix: "€" }),
          unit: "of workwear can be freed",
          headline: "by moving spare garments to busy sites or returning them",
          comparison: c.plan.transferredPieces
            ? `${fmtNum(c.plan.transferredPieces)} garments can move between your sites and ${fmtNum(c.plan.returnedPieces)} can go back to Lindström.`
            : `${fmtNum(c.plan.returnedPieces)} spare garments can go back to Lindström.`,
          visual: {
            kind: "bars",
            bars: [
              { label: "Move to a busier site", value: c.plan.transferredPieces, text: fmtNum(c.plan.transferredPieces), tone: "green" },
              { label: "Return to Lindström", value: c.plan.returnedPieces, text: fmtNum(c.plan.returnedPieces), tone: "blue" },
            ],
            caption: "Garments, based on the last three months",
          },
          note: "Valued at garment purchase price in your data.",
          tone: "green",
          link: L.rebalance,
        });
      }
      if (c.m.dormancy.trackedAssets > 0 && c.m.dormancy.dormantShare > 0.05) {
        beats.push({
          id: "idle-dormant",
          kicker: "Not collected",
          figure: pctFigure(c.m.dormancy.dormantShare),
          unit: "of tracked garments",
          headline: `were not picked up for ${Math.round(c.m.assumptions.dormantDays / 30)} months`,
          comparison: "They are likely unused, lost or kept by people who left - a size and stock check frees them up.",
          visual: { kind: "ring", value: c.m.dormancy.dormantShare, label: "not collected", tone: "red" },
          tone: "red",
          link: L.sitesDormant,
        });
      }
      return {
        answer: `${fmtNum(a.utilization * 100)}% of garments were in use${c.plan.capitalEurReleased > 0 ? `; about ${eur(c.plan.capitalEurReleased)} of workwear can be freed` : ""}.`,
        beats,
      };
    },
  },
  {
    id: "service-promise",
    tags: ["service"],
    industries: /health/i,
    topics: /service|continuity|reliab/i,
    covers: ["late", "requests"],
    question: (_c, arch) => (arch === "operations" ? "Are clean garments there when shifts start?" : "Is the service as reliable as promised?"),
    build: (c) => {
      const cyc = c.m.cycles;
      const beats: RecapBeat[] = [];
      if (cyc.cycles > 0) {
        beats.push({
          id: "svc-ontime",
          kicker: "On time",
          figure: pctFigure(cyc.onTimeShare, 1),
          unit: "of deliveries on time",
          headline: `${fmtNum(cyc.late)} late out of ${fmtNum(cyc.cycles)} tracked service cycles`,
          visual: { kind: "ring", value: cyc.onTimeShare, label: "on time", tone: "green" },
          tone: "green",
          link: L.sitesLate,
        });
        beats.push({
          id: "svc-turnaround",
          kicker: "Turnaround",
          figure: figure(cyc.avgHours / 24, { decimals: 1 }),
          unit: "days on average",
          headline: "from pick-up to clean garments back on site",
          comparison: `The slowest cycle took ${aboutCount(cyc.maxHours / 24)} days.`,
          visual: {
            kind: "bars",
            bars: [
              { label: "Average", value: cyc.avgHours, text: `${fmtNum(cyc.avgHours / 24, 1)} days`, tone: "green" },
              { label: "Slowest", value: cyc.maxHours, text: `${fmtNum(cyc.maxHours / 24, 1)} days`, tone: "orange" },
            ],
          },
          tone: "blue",
          link: L.health,
        });
      }
      const a = c.m.activity;
      const top = [...c.m.sites].sort((x, y) => y.activity.serviceRequests - x.activity.serviceRequests).slice(0, 5);
      beats.push({
        id: "svc-requests",
        kicker: "Service requests",
        figure: figure(a.serviceRequests),
        unit: "requests in the year",
        headline: `about ${aboutNumber(a.requestsPer1000WearerMonths)} for every 1,000 wearers a month`,
        comparison: top[0] ? `Most came from ${top.slice(0, 2).map(siteLabel).join(" and ")}.` : undefined,
        visual: {
          kind: "bars",
          bars: top.map((s, i) => ({ label: siteLabel(s), value: s.activity.serviceRequests, text: fmtNum(s.activity.serviceRequests), tone: i === 0 ? "orange" : "navy", link: siteLink(s) })),
          caption: "Sites with the most requests",
        },
        tone: "navy",
        link: L.sitesRequests,
      });
      const answer = cyc.cycles > 0 ? `${fmtNum(cyc.onTimeShare * 100, 1)}% of deliveries were on time, with ${fmtNum(a.serviceRequests)} service requests in the year.` : `${fmtNum(a.serviceRequests)} service requests in the year.`;
      return { answer, beats };
    },
  },
  {
    id: "hygiene-rhythm",
    tags: ["hygiene"],
    industries: /food|beverage|health/i,
    topics: /hygien/i,
    covers: ["rhythm"],
    question: () => "Are garments washed as often as hygiene requires?",
    build: (c) => {
      const b = rhythmBeat(c);
      if (!b) return null;
      const target = c.m.assumptions.washTargetPerMonth;
      const sites = c.m.sites.map((s) => ({ name: siteLabel(s), status: RHYTHM_TONE(s.activity.washesPerGarmentMonth / target), siteId: s.site.id }));
      const below = sites.filter((s) => s.status === "act").length;
      return {
        answer: `Garments were washed ${fmtNum(c.m.activity.washesPerGarmentMonth, 1)} times a month on average, against ${fmtNum(target)} expected${below ? `; ${below} sites are well below` : ""}.`,
        beats: [
          b,
          {
            id: "rhythm-sites",
            kicker: "Site by site",
            figure: figure(below),
            unit: `site${below === 1 ? "" : "s"} below 75% of the rhythm`,
            headline: `out of ${sites.length}`,
            comparison: below ? "Start with these sites: check wearer counts, garment sets and pick-up days." : "Every site is close to the expected rhythm.",
            visual: { kind: "sites", sites, caption: "Green: on rhythm · orange: slightly below · red: well below" },
            tone: below ? "red" : "green",
            link: L.sitesWash,
          },
        ],
      };
    },
  },
  {
    id: "traceability",
    tags: ["hygiene", "evidence"],
    industries: /health/i,
    topics: /tracea|complian/i,
    covers: ["dormant"],
    question: () => "Can you trace every garment if an auditor asks?",
    build: (c) => {
      const d = c.m.dormancy;
      const cyc = c.m.cycles;
      if (!d.trackedAssets && !cyc.cycles) return null;
      const beats: RecapBeat[] = [
        {
          id: "trace-cycles",
          kicker: "Every trip recorded",
          figure: figure(cyc.cycles),
          unit: "garment trips recorded by RFID",
          headline: "pick-up, washing and delivery - each with a time stamp",
          comparison: `That is about ${aboutCount(perWorkingDay(cyc.cycles, c.months))} every working day, for ${fmtNum(d.trackedAssets)} individually tagged garments.`,
          visual: { kind: "icons", icon: "garment", count: Math.max(1, Math.min(100, Math.round(perWorkingDay(cyc.cycles, c.months)))), caption: "= garment trips on an average working day" },
          tone: "navy",
          link: L.health,
        },
      ];
      if (d.trackedAssets > 0) {
        beats.push({
          id: "trace-dormant",
          kicker: "Gaps to close",
          figure: pctFigure(d.dormantShare),
          unit: "of tagged garments",
          headline: `have no pick-up in ${Math.round(c.m.assumptions.dormantDays / 30)} months`,
          comparison: "These are the garments an auditor would ask about first.",
          visual: { kind: "ring", value: d.dormantShare, label: "without recent pick-up", tone: "red" },
          tone: "red",
          link: L.sitesDormant,
        });
      }
      return { answer: `${fmtNum(cyc.cycles)} garment trips were recorded one by one; ${fmtNum(d.dormantShare * 100)}% of tagged garments need a check.`, beats };
    },
  },
  {
    id: "alternatives",
    tags: ["cost", "emissions"],
    covers: [],
    question: () => "What would washing workwear another way cost?",
    build: (c) => {
      const kg = c.m.impact.washedKg;
      const fp = c.m.impact.footprint;
      const a = c.m.assumptions;
      if (!kg || !c.ds.baselines.length) return null;
      const alts = c.ds.baselines.map((b) => {
        const water = kg * b.waterLPerKg - fp.waterL;
        const energy = kg * b.energyKwhPerKg - fp.energyKwh;
        const co2 = kg * (b.processKgCo2ePerKg + b.deliveryKgCo2ePerKg) - fp.co2Kg;
        return { name: b.name, eur: energy * a.electricityEurPerKwh + (water / 1000) * a.waterEurPerM3, co2 };
      });
      const worst = [...alts].sort((x, y) => y.eur - x.eur)[0];
      if (!worst || worst.eur <= 0) return null;
      return {
        answer: `Switching to ${worst.name.toLowerCase()} would cost about ${eur(worst.eur)} more a year in energy and water alone - before staff, machines and space.`,
        beats: [
          {
            id: "alt-eur",
            kicker: "Energy and water bill",
            figure: figure(worst.eur, { prefix: "€" }),
            unit: "more a year",
            headline: `for energy and water with ${worst.name.toLowerCase()}`,
            comparison: "Before counting staff, machines, detergents and the space a laundry needs.",
            visual: {
              kind: "bars",
              bars: [{ label: "Lindström", value: 0, text: "€0 extra", tone: "green" as RecapTone }, ...alts.map((x) => ({ label: x.name, value: Math.max(0, x.eur), text: `+${eur(Math.max(0, x.eur))}`, tone: "orange" as RecapTone }))],
              caption: "Extra energy and water cost per year",
            },
            tone: "orange",
            link: L.alternatives,
          },
          {
            id: "alt-co2",
            kicker: "Extra CO₂",
            figure: figure(Math.max(...alts.map((x) => x.co2)) / 1000),
            unit: "tonnes more CO₂",
            headline: "with the most carbon-intensive alternative",
            visual: {
              kind: "bars",
              bars: [{ label: "Lindström", value: 0, text: "-", tone: "green" as RecapTone }, ...alts.map((x) => ({ label: x.name, value: Math.max(0, x.co2), text: `+${fmtNum(Math.max(0, x.co2) / 1000)} t`, tone: "red" as RecapTone }))],
              caption: "Extra emissions per year",
            },
            tone: "red",
            link: L.alternatives,
          },
        ],
      };
    },
  },
  {
    id: "report-evidence",
    tags: ["evidence", "emissions"],
    topics: /scope|evidence|report|csrd/i,
    covers: ["evidence"],
    question: () => "What can you put in your sustainability report?",
    build: (c) => {
      const fp = c.m.impact.footprint;
      if (!fp.co2Kg) return null;
      const s = c.m.impact.savings;
      const w = c.m.impact.waste;
      const beats: RecapBeat[] = [
        {
          id: "rep-footprint",
          kicker: "Your footprint",
          figure: figure(fp.co2Kg / 1000, { decimals: 1 }),
          unit: "tonnes of CO₂",
          headline: "for washing and delivering your workwear (Scope 3)",
          comparison: c.wearers ? `About ${aboutNumber(fp.co2Kg / c.wearers)} kg per wearer a year.` : undefined,
          visual: {
            kind: "bars",
            bars: [
              { label: "Washing", value: fp.processCo2Kg, text: `${fmtNum(fp.processCo2Kg / 1000, 1)} t`, tone: "navy" },
              { label: "Delivery", value: fp.deliveryCo2Kg, text: `${fmtNum(fp.deliveryCo2Kg / 1000, 1)} t`, tone: "blue" },
            ],
          },
          tone: "navy",
          link: L.emissions,
        },
        {
          id: "rep-range",
          kicker: "Avoided, with a safe range",
          figure: figure(s.low.co2Kg / 1000),
          unit: "tonnes avoided - at least",
          headline: `up to ${fmtNum(s.high.co2Kg / 1000)} t compared with ${c.baseline}`,
          comparison: "Report the low value to stay on the safe side.",
          visual: {
            kind: "bars",
            bars: [
              { label: "Low", value: s.low.co2Kg, text: `${fmtNum(s.low.co2Kg / 1000)} t`, tone: "green" },
              { label: "Base", value: s.base.co2Kg, text: `${fmtNum(s.base.co2Kg / 1000)} t`, tone: "navy" },
              { label: "High", value: s.high.co2Kg, text: `${fmtNum(s.high.co2Kg / 1000)} t`, tone: "blue" },
            ],
          },
          tone: "green",
          link: L.alternatives,
        },
      ];
      if (w.totalKg > 0) {
        beats.push({
          id: "rep-waste",
          kicker: "End of life",
          figure: pctFigure(w.divertedKg / w.totalKg),
          unit: "of textile waste",
          headline: "was recycled or reused",
          visual: {
            kind: "stack",
            parts: [
              { label: "Recycled", value: w.recyclingKg, text: `${fmtNum(w.recyclingKg)} kg`, tone: "green" },
              { label: "Reused", value: w.reuseKg, text: `${fmtNum(w.reuseKg)} kg`, tone: "turquoise" },
              { label: "Energy recovery", value: w.energyRecoveryKg, text: `${fmtNum(w.energyRecoveryKg)} kg`, tone: "orange" },
              { label: "Incinerated", value: w.incinerationKg, text: `${fmtNum(w.incinerationKg)} kg`, tone: "red" },
            ].filter((p) => p.value > 0) as Array<{ label: string; value: number; text: string; tone: RecapTone }>,
          },
          tone: "green",
          link: L.waste,
        });
      }
      return { answer: `A ${fmtNum(fp.co2Kg / 1000, 1)} t CO₂ footprint and at least ${fmtNum(s.low.co2Kg / 1000)} t avoided - shared estimates until meter data is connected.`, beats };
    },
  },
  {
    id: "circularity",
    tags: ["circularity"],
    industries: /manufactur/i,
    topics: /repair|circular|lifetime/i,
    covers: ["repairs"],
    question: () => "How long does your workwear live?",
    build: (c) => {
      const r = c.m.repairs;
      if (!r.repairs) return null;
      const perDay = perWorkingDay(r.repairs, c.months);
      const co2 = r.avoidedKgCo2e[c.scenario];
      const car = carEquivalent(co2);
      c.factors.set("car", car.factor);
      return {
        answer: `${fmtNum(r.repairs)} repairs kept garments in use and avoided about ${fmtNum(co2 / 1000)} t of CO₂ from new garments.`,
        beats: [
          {
            id: "circ-repairs",
            kicker: "Repaired, not replaced",
            figure: figure(r.repairs),
            unit: "repairs",
            headline: `${r.byType[0] ? `most often: ${r.byType[0].type.toLowerCase()}` : "kept garments in service"}`,
            comparison: `About ${aboutCount(perDay)} garments rescued every working day.`,
            visual: { kind: "icons", icon: "garment", count: Math.max(1, Math.min(100, Math.round(perDay))), caption: "= garments repaired on an average working day" },
            tone: "purple",
            link: L.repairs,
          },
          {
            id: "circ-co2",
            kicker: "New garments not made",
            figure: figure(co2 / 1000),
            unit: "tonnes of CO₂ avoided",
            headline: "because fewer new garments had to be produced",
            comparison: car.earthLaps >= 1 ? `Like ${aboutCount(car.earthLaps)} drives around the Earth in a new car.` : `Like driving ${aboutNumber(car.km)} km in a new car.`,
            visual: { kind: "earth", laps: car.earthLaps, km: car.km },
            tone: "green",
            link: L.repairs,
          },
        ],
      };
    },
  },
  {
    id: "water-deep",
    tags: ["water"],
    industries: /food|beverage/i,
    topics: /water/i,
    covers: ["water"],
    question: () => "How water-efficient is your workwear?",
    build: (c) => {
      const i = c.m.impact.intensity.waterLPerKg;
      const b = c.m.baseline.waterLPerKg;
      if (!i || !b) return null;
      const fp = c.m.impact.footprint.waterL;
      const saved = c.m.impact.savings[c.scenario].waterL;
      const cmp = waterComparison(Math.max(0, saved), c.country);
      c.factors.set("water", cmp.factor);
      return {
        answer: `Lindström used ${fmtNum(i, 1)} litres per kilo of workwear, against ${fmtNum(b, 1)} with ${c.baseline}.`,
        beats: [
          {
            id: "water-intensity",
            kicker: "Per kilo washed",
            figure: figure(i, { decimals: 1 }),
            unit: "litres per kilo",
            headline: `against ${fmtNum(b, 1)} litres with ${c.baseline}`,
            comparison: `That is ${aboutNumber((1 - i / b) * 100)}% less water for every kilo.`,
            visual: {
              kind: "bars",
              bars: [
                { label: "Lindström", value: i, text: `${fmtNum(i, 1)} L`, tone: "blue" },
                { label: c.m.baseline.name, value: b, text: `${fmtNum(b, 1)} L`, tone: "orange" },
              ],
            },
            tone: "blue",
            link: L.intensity,
          },
          {
            id: "water-saved",
            kicker: "In a year",
            figure: figure(Math.max(0, saved)),
            unit: "litres saved",
            headline: `out of ${fmtNum(fp / 1000)} m³ used for your workwear`,
            comparison: cmp.text,
            visual: { kind: "icons", icon: "family", count: cmp.icons, caption: cmp.caption },
            note: `Comparison: ${cmp.factor.source}.`,
            tone: "blue",
            link: L.savings,
          },
        ],
      };
    },
  },
  {
    id: "climate-rules",
    tags: ["emissions", "evidence"],
    covers: ["rules"],
    question: (c) => `What do ${c.brief?.country ?? "your country"}'s climate rules mean for you?`,
    build: (c) => {
      const timeline = ruleTimeline(c.brief, c.today).slice(0, 4);
      const carbon = carbonValue(c.m, c.brief);
      if (!timeline.length && !carbon) return null;
      const beats: RecapBeat[] = [];
      if (carbon) {
        beats.push({
          id: "rules-carbon",
          kicker: "Carbon price",
          figure: figure(carbon.eur[c.scenario], { prefix: "€" }),
          unit: "value of the CO₂ avoided",
          headline: `at ${c.brief?.country}'s carbon price of €${fmtNum(carbon.price.eurPerTonne)} per tonne`,
          visual: { kind: "ring", value: Math.min(1, carbon.tonnes[c.scenario] / Math.max(1, carbon.tonnes.high)), label: `${fmtNum(carbon.tonnes[c.scenario])} t avoided`, tone: "green" },
          note: "Illustrative value, not a tax saving.",
          tone: "green",
          link: L.carbon,
        });
      }
      if (timeline.length) {
        beats.push({
          id: "rules-timeline",
          kicker: "Deadlines",
          figure: figure(timeline.length),
          unit: `rule${timeline.length === 1 ? "" : "s"} to plan for`,
          headline: "that touch the figures in this review",
          visual: { kind: "timeline", items: timeline.map((t) => ({ when: t.item.effective ?? "", title: t.item.title, status: t.monthsAway <= 0 ? "Applies now" : `In ${t.monthsAway} months`, link: ruleLink(t.item.id) })) },
          note: "Researched summaries of public sources, not legal or tax advice.",
          tone: "purple",
          link: L.deadlines,
        });
      }
      return { answer: `${timeline.length} dated rules affect your workwear figures${carbon ? `, and the CO₂ avoided is worth about ${eur(carbon.eur[c.scenario])} at the carbon price` : ""}.`, beats };
    },
  },
  {
    id: "partnership",
    tags: ["improvement", "service"],
    covers: [],
    question: () => "Is this partnership working?",
    build: (c) => {
      const sites = c.m.sites;
      if (!sites.length) return null;
      const onTrack = sites.filter((s) => s.status === "on-track").length / sites.length;
      const bars = [
        c.m.cycles.cycles ? { label: "Deliveries on time", value: c.m.cycles.onTimeShare, text: `${fmtNum(c.m.cycles.onTimeShare * 100, 1)}%`, tone: "green" as RecapTone, link: L.sitesLate as RecapLink } : null,
        { label: "Garments in use", value: c.m.activity.utilization, text: `${fmtNum(c.m.activity.utilization * 100)}%`, tone: "navy" as RecapTone, link: L.sitesUse as RecapLink },
        { label: "Site-months without requests", value: c.m.activity.requestFreeSiteMonthShare, text: `${fmtNum(c.m.activity.requestFreeSiteMonthShare * 100)}%`, tone: "blue" as RecapTone, link: L.sitesRequests as RecapLink },
        { label: "Sites on track", value: onTrack, text: `${fmtNum(onTrack * 100)}%`, tone: "turquoise" as RecapTone, link: L.sites as RecapLink },
      ].filter((b): b is { label: string; value: number; text: string; tone: RecapTone; link: RecapLink } => !!b);
      return {
        answer: `${fmtNum(onTrack * 100)}% of sites are on track${c.m.cycles.cycles ? ` and ${fmtNum(c.m.cycles.onTimeShare * 100, 1)}% of deliveries were on time` : ""}.`,
        beats: [
          {
            id: "partner-score",
            kicker: "Scorecard",
            figure: pctFigure(onTrack),
            unit: "of your sites are on track",
            headline: "and these are the numbers behind it",
            visual: { kind: "bars", bars, caption: "Share, %" },
            tone: "navy",
            link: L.health,
          },
        ],
      };
    },
  },
];

const ROLE_TOPICS: Record<ArchetypeId, string[]> = {
  procurement: ["idle-garments", "service-promise", "alternatives"],
  cfo: ["alternatives", "idle-garments", "partnership"],
  sustainability: ["report-evidence", "circularity", "climate-rules"],
  quality: ["hygiene-rhythm", "traceability", "service-promise"],
  operations: ["service-promise", "hygiene-rhythm", "idle-garments"],
  ceo: ["partnership", "climate-rules", "alternatives"],
  "kam-balanced": ["partnership", "service-promise", "idle-garments"],
};

const ROLE_LABEL: Record<ArchetypeId, string> = {
  procurement: "procurement",
  cfo: "finance",
  sustainability: "sustainability",
  quality: "quality & hygiene",
  operations: "operations",
  ceo: "management",
  "kam-balanced": "the account",
};

type Built = { answer: string; beats: RecapBeat[] };

/** Topics an AI person profile may choose for questions 4 and 5 (each answered from the data). */
export const RECAP_TOPIC_CATALOG: Array<{ id: string; question: string; about: string }> = [
  { id: "idle-garments", question: "Are you paying for garments nobody uses?", about: "Garment use, idle and missing garments, money tied up in spare workwear" },
  { id: "service-promise", question: "Is the service as reliable as promised?", about: "On-time deliveries, turnaround days and service requests per site" },
  { id: "hygiene-rhythm", question: "Are garments washed as often as hygiene requires?", about: "Wash rhythm against the hygiene plan, sites below rhythm" },
  { id: "traceability", question: "Can you trace every garment if an auditor asks?", about: "RFID-recorded garment trips and garments without recent pick-up" },
  { id: "alternatives", question: "What would washing workwear another way cost?", about: "Extra energy, water cost and CO₂ of in-house or other laundry alternatives" },
  { id: "report-evidence", question: "What can you put in your sustainability report?", about: "Scope 3 footprint, avoided CO₂ range and textile waste recycling" },
  { id: "circularity", question: "How long does your workwear live?", about: "Repairs, garments rescued and CO₂ avoided from new garments" },
  { id: "water-deep", question: "How water-efficient is your workwear?", about: "Litres per kilo washed against the alternative and water saved" },
  { id: "climate-rules", question: "What do your country's climate rules mean for you?", about: "Carbon price value of avoided CO₂ and dated rule deadlines (needs country research)" },
  { id: "partnership", question: "Is this partnership working?", about: "Scorecard: sites on track, on-time deliveries, garments in use, request-free months" },
];

function pickTopics(c: Ctx): { role: { topic: Topic; arch: ArchetypeId; built: Built } | null; company: { topic: Topic; built: Built } | null; chosen: boolean } {
  const archs = audienceArchetypes(c.avatar);
  // A person researched in the People pop-up brings the two questions the AI chose for them.
  const chosen = (c.avatar.recapTopics ?? [])
    .map((id) => TOPICS.find((t) => t.id === id))
    .filter((t): t is Topic => !!t)
    .map((topic) => ({ topic, built: topic.build(c) }))
    .filter((x): x is { topic: Topic; built: Built } => !!x.built?.beats.length);
  if (chosen.length >= 2) return { role: { ...chosen[0], arch: archs[0] ?? "kam-balanced" }, company: chosen[1], chosen: true };
  let role: { topic: Topic; arch: ArchetypeId; built: Built } | null = chosen[0] ? { ...chosen[0], arch: archs[0] ?? "kam-balanced" } : null;
  for (const arch of role ? [] : archs.length ? archs : (["kam-balanced"] as ArchetypeId[])) {
    for (const id of ROLE_TOPICS[arch] ?? []) {
      const topic = TOPICS.find((t) => t.id === id)!;
      const built = topic.build(c);
      if (built?.beats.length) {
        role = { topic, arch, built };
        break;
      }
    }
    if (role) break;
  }
  const scored = TOPICS.filter((t) => t.id !== role?.topic.id)
    .map((t) => ({
      t,
      s:
        (t.industries?.test(c.customer.industry) ? 2 : 0) +
        (t.topics ? c.customer.priorityTopics.filter((p) => t.topics!.test(p)).length * 1.5 : 0) +
        relevance(c, t.tags) * 0.05 +
        (t.id === "climate-rules" && c.brief ? 0.5 : 0),
    }))
    .sort((a, b) => b.s - a.s);
  let company: { topic: Topic; built: Built } | null = null;
  for (const { t } of scored) {
    const built = t.build(c);
    if (built?.beats.length) {
      company = { topic: t, built };
      break;
    }
  }
  return { role, company, chosen: chosen.length > 0 };
}

/** The five questions (and who they are for), for previews before the Recap is generated. */
export function recapQuestions(input: RecapInput): Array<{ label: string; question: string }> {
  return buildRecap(input).chapters.map((ch) => ({ label: ch.label, question: ch.question }));
}

export function buildRecap(input: RecapInput): Recap {
  const { model: m, dataset: ds } = input;
  const months = m.scope.months;
  const scopedCountries = [...new Set(m.sites.map((s) => s.site.country))];
  const c: Ctx = {
    m,
    ds,
    plan: input.plan,
    obs: input.observations,
    avatar: input.avatar,
    weights: input.weights,
    brief: input.brief,
    scenario: input.scenario,
    today: input.today,
    customer: m.customer,
    country: input.avatar.country ?? (scopedCountries.length === 1 ? scopedCountries[0] : null),
    months: months.length,
    period: periodLabel(months),
    baseline: m.baseline.name.toLowerCase(),
    wearers: m.activity.wearersLatest,
    factors: new Map(),
    picked: input.picked ?? null,
  };

  const { role, company, chosen } = pickTopics(c);
  const who = audienceLabel(input.avatar);
  const asked = (t: Topic, arch?: ArchetypeId) => input.avatar.recapQuestions?.[t.id]?.trim() || t.question(c, arch);
  const covered = new Set<string>([...(role?.topic.covers ?? []), ...(company?.topic.covers ?? [])]);

  // 1 - the year, money first; drop beats a role/company chapter tells in more depth.
  const yearBeats = [moneyBeat(c), covered.has("water") ? energyBeat(c) : waterBeat(c), co2Beat(c), covered.has("repairs") ? null : repairsBeat(c)].filter((b): b is RecapBeat => !!b);
  if (!yearBeats.length) yearBeats.push(washedBeat(c));
  const money = yearBeats.find((b) => b.id === "money");
  const water = c.m.impact.savings[c.scenario].waterL;
  const co2 = c.m.impact.savings[c.scenario].co2Kg;
  const saved = [water > 0 ? `${figure(water).text} litres of water` : null, co2 > 0 ? `${fmtNum(co2 / 1000)} tonnes of CO₂` : null].filter(Boolean).join(" and ");
  const yearAnswer = money?.figure
    ? `About ${money.figure.text} in value${saved ? ` - plus ${saved} saved compared with ${c.baseline}` : ""}`
    : saved
      ? `${saved[0].toUpperCase()}${saved.slice(1)} saved compared with ${c.baseline}`
      : "";

  // 2 - risks: the three most serious, weighted by what this person cares about.
  const risks = riskCandidates(c)
    .filter((r) => !covered.has(r.id))
    .map((r) => ({ ...r, score: r.severity * (1 + relevance(c, r.tags) * 0.12) }))
    .sort((a, b) => b.score - a.score);
  const strong = risks.filter((r) => r.id !== "evidence" && r.severity > 0.12).slice(0, 3);
  const riskBeats = (strong.length ? strong : risks.slice(0, 1)).map((r) => r.beat);
  if (strong.length && strong.length < 2) {
    const ev = risks.find((r) => r.id === "evidence");
    if (ev) riskBeats.push(ev.beat);
  }

  // 3 - next steps.
  const nextBeats = nextChapterBeats(c, covered);
  const firstStep = nextBeats.find((b) => b.visual.kind === "steps");

  const archLabel = role ? ROLE_LABEL[role.arch] : "the account";
  const chapters: RecapChapter[] = [
    {
      id: "year",
      number: 1,
      scope: "common",
      label: "Every customer asks",
      question: `What did ${c.period} with Lindström bring you?`,
      answer: yearAnswer ? `${yearAnswer}.` : `${fmtNum(m.impact.washedKg / 1000, 1)} tonnes of workwear washed for ${fmtNum(c.wearers)} wearers.`,
      beats: yearBeats,
    },
    {
      id: "risks",
      number: 2,
      scope: "common",
      label: "Every customer asks",
      question: "Where are the risks?",
      answer: riskBeats[0]
        ? `${riskBeats[0].figure ? `${riskBeats[0].figure.text} ${riskBeats[0].unit ?? ""}`.trim() : riskBeats[0].headline}${riskBeats.length > 1 ? `. Also watch: ${riskBeats.slice(1).map((b) => b.kicker.toLowerCase()).join(" and ")}` : ""}.`
        : "No material risks in the data.",
      beats: riskBeats,
    },
    {
      id: "next",
      number: 3,
      scope: "common",
      label: "Every customer asks",
      question: "What should we do next?",
      answer:
        firstStep && firstStep.visual.kind === "steps"
          ? `Start with this: ${firstStep.visual.steps[0].title.replace(/[.…]+$/, "")}.`
          : "Keep the current service and review the figures again next quarter.",
      beats: nextBeats.length ? nextBeats : [washedBeat(c)],
    },
  ];
  if (role) {
    chapters.push({
      id: role.topic.id,
      number: 4,
      scope: chosen ? "person" : "role",
      label: chosen ? `For ${who}` : `For ${archLabel === "the account" ? "the account" : `${archLabel}`}`,
      question: asked(role.topic, role.arch),
      answer: role.built.answer,
      beats: role.built.beats,
    });
  }
  if (company) {
    chapters.push({
      id: company.topic.id,
      number: chapters.length + 1,
      scope: chosen ? "person" : "company",
      label: chosen ? `For ${who}` : `For ${m.customer.industry ? m.customer.industry.toLowerCase() : m.customer.name}`,
      question: asked(company.topic, role?.arch),
      answer: company.built.answer,
      beats: company.built.beats,
    });
  }
  // Fill to five with the next best topic if the data could not support one of the two.
  for (const t of TOPICS) {
    if (chapters.length >= 5) break;
    if (chapters.some((ch) => ch.id === t.id)) continue;
    const built = t.build(c);
    if (built?.beats.length) chapters.push({ id: t.id, number: chapters.length + 1, scope: "company", label: `For ${m.customer.name}`, question: t.question(c, role?.arch), answer: built.answer, beats: built.beats });
  }

  const sources = [...c.factors.values()].map((f) => ({ label: f.source, url: f.url }));
  const scenarioWord = input.scenario === "base" ? "base" : input.scenario === "low" ? "low (cautious)" : "high";
  return {
    periodLabel: c.period,
    title: `${c.period} with Lindström`,
    audience: input.avatar.role,
    scopeLabel: input.locationLabel,
    sitesInScope: m.sites.length,
    wearers: c.wearers,
    stats: [
      { value: fmtNum(m.sites.length), label: m.sites.length === 1 ? "site served" : "sites served", link: L.sites },
      { value: fmtNum(c.wearers), label: "people in Lindström workwear", link: L.sitesUse },
      { value: fmtNum(m.impact.washedKg / 1000, m.impact.washedKg < 10000 ? 1 : 0), label: "tonnes of workwear washed", link: L.intensity },
      { value: fmtNum(m.cycles.cycles), label: "pick-ups and deliveries", link: L.health },
    ],
    chapters,
    closing: {
      headline: "Let's agree the next steps together",
      actions: (firstStep && firstStep.visual.kind === "steps" ? firstStep.visual.steps.map((s) => s.title) : []).slice(0, 3),
      questions: [...new Set(input.observations.map((o) => o.question))].slice(0, 3),
    },
    sources,
    disclosure: `Figures come from your uploaded data for ${c.period}, compared with ${c.baseline} (${scenarioWord} estimate). Water, energy and CO₂ are shared laundry estimates; everyday comparisons are rounded public averages.`,
  };
}
