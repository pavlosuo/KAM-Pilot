import type { PriorityKey } from "@/lib/engine/priorities";

/**
 * Country & regulatory context researched on the web for one avatar.
 * Shared by the server research step, the deterministic linking engine,
 * the dashboard and the exported deck. Browser-safe (types + constants only).
 */

export type ResearchTopic = "climate" | "incentives" | "circularity" | "company";

export const RESEARCH_TOPICS: ResearchTopic[] = ["climate", "incentives", "circularity", "company"];

export const TOPIC_META: Record<ResearchTopic, { label: string; looksFor: string; priority: PriorityKey }> = {
  climate: {
    label: "Climate reporting & CO₂ pricing",
    looksFor: "CSRD/ESRS scope after the EU Omnibus, national carbon tax, EU ETS / ETS2, climate targets, green-claims rules",
    priority: "emissions",
  },
  incentives: {
    label: "Tax benefits & funding",
    looksFor: "Energy and climate investment deductions, grants, green procurement preferences, energy-tax refunds",
    priority: "cost",
  },
  circularity: {
    label: "Textiles, waste, water & hygiene",
    looksFor: "Separate textile collection, textile EPR, ESPR destruction ban, wastewater rules, sector hygiene and PPE rules",
    priority: "circularity",
  },
  company: {
    label: "Company public commitments",
    looksFor: "Published climate targets, SBTi status, sustainability reports and supplier requirements",
    priority: "evidence",
  },
};

export type RuleCategory =
  | "reporting"
  | "carbon_pricing"
  | "tax_incentive"
  | "funding"
  | "textile_waste"
  | "water"
  | "hygiene"
  | "energy"
  | "procurement"
  | "claims"
  | "company_target";

export const CATEGORY_LABEL: Record<RuleCategory, string> = {
  reporting: "Sustainability reporting",
  carbon_pricing: "Carbon pricing",
  tax_incentive: "Tax benefit",
  funding: "Grant / funding",
  textile_waste: "Textiles & waste",
  water: "Water",
  hygiene: "Hygiene & safety",
  energy: "Energy",
  procurement: "Procurement",
  claims: "Green claims",
  company_target: "Company target",
};

export type RuleStatus = "in_force" | "phasing_in" | "upcoming" | "proposed" | "uncertain";

export const STATUS_LABEL: Record<RuleStatus, string> = {
  in_force: "In force",
  phasing_in: "Phasing in",
  upcoming: "Upcoming",
  proposed: "Proposed",
  uncertain: "Status unclear",
};

/** Dashboard figure a rule makes more relevant (resolved deterministically from the review model). */
export type RuleMetric =
  | "co2Saving"
  | "footprintCo2"
  | "waterSaving"
  | "energySaving"
  | "textileWaste"
  | "wasteDiverted"
  | "repairs"
  | "postponed"
  | "onTime"
  | "idleGarments"
  | "none";

export const RULE_METRICS: RuleMetric[] = [
  "co2Saving",
  "footprintCo2",
  "waterSaving",
  "energySaving",
  "textileWaste",
  "wasteDiverted",
  "repairs",
  "postponed",
  "onTime",
  "idleGarments",
  "none",
];

export interface Source {
  title: string;
  url: string;
  /** True when the URL was returned by the live web search in this run. */
  verified: boolean;
}

export interface RuleItem {
  id: string;
  topic: ResearchTopic;
  category: RuleCategory;
  title: string;
  jurisdiction: string;
  status: RuleStatus;
  /** ISO date (YYYY-MM-DD), YYYY-MM or YYYY; null when not dated. */
  effective: string | null;
  summary: string;
  /** Why it matters for this person, in their language. */
  relevance: string;
  /** What to say or do in the review. */
  action: string;
  metric: RuleMetric;
  priority: PriorityKey;
  sources: Source[];
  confidence: "high" | "medium" | "low";
}

export interface CarbonPrice {
  eurPerTonne: number;
  instrument: string;
  appliesTo: string;
  year: string;
  source: Source;
}

export interface CompanyFacts {
  found: boolean;
  summary: string;
  targets: string[];
  sources: Source[];
}

export interface TopicResult {
  topic: ResearchTopic;
  status: "ok" | "failed";
  items: RuleItem[];
  notes: string;
  queries: string[];
  searchedSources: number;
  error?: string;
  carbonPrice?: CarbonPrice | null;
  companyFacts?: CompanyFacts | null;
}

export interface RegulatoryBrief {
  version: 1;
  country: string;
  countryCode: string;
  industry: string;
  role: string;
  generatedAt: string;
  topics: TopicResult[];
}

/** Request for one research topic (validated on the server). */
export interface ResearchRequest {
  topic: ResearchTopic;
  country: string;
  countryCode: string;
  company: {
    name: string;
    industry: string;
    segment: string;
    hqCountry: string;
    siteTypes: string[];
    sitesInScope: number;
    synthetic: boolean;
  };
  person: {
    role: string;
    decisions: string[];
    goals: string[];
    reporting: string[];
    moments: string[];
  };
  today: string;
}

const COUNTRY_CODES: Record<string, string> = {
  finland: "FI",
  sweden: "SE",
  poland: "PL",
  norway: "NO",
  denmark: "DK",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  germany: "DE",
  netherlands: "NL",
  belgium: "BE",
  france: "FR",
  austria: "AT",
  czechia: "CZ",
  "czech republic": "CZ",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  croatia: "HR",
  slovenia: "SI",
  italy: "IT",
  spain: "ES",
  portugal: "PT",
  ireland: "IE",
  "united kingdom": "GB",
  uk: "GB",
  switzerland: "CH",
  china: "CN",
  russia: "RU",
  ukraine: "UA",
};

export function countryCode(country: string): string {
  return COUNTRY_CODES[country.trim().toLowerCase()] ?? "";
}

export const EU_MEMBERS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function briefItems(brief: RegulatoryBrief | null | undefined): RuleItem[] {
  return brief ? brief.topics.flatMap((t) => t.items) : [];
}

export function briefCarbonPrice(brief: RegulatoryBrief | null | undefined): CarbonPrice | null {
  return brief?.topics.find((t) => t.carbonPrice)?.carbonPrice ?? null;
}

export function briefCompanyFacts(brief: RegulatoryBrief | null | undefined): CompanyFacts | null {
  return brief?.topics.find((t) => t.companyFacts)?.companyFacts ?? null;
}

export function briefSources(brief: RegulatoryBrief | null | undefined): Source[] {
  const seen = new Map<string, Source>();
  for (const item of briefItems(brief)) for (const s of item.sources) if (!seen.has(s.url)) seen.set(s.url, s);
  const cp = briefCarbonPrice(brief);
  if (cp && !seen.has(cp.source.url)) seen.set(cp.source.url, cp.source);
  for (const s of briefCompanyFacts(brief)?.sources ?? []) if (!seen.has(s.url)) seen.set(s.url, s);
  return [...seen.values()];
}
