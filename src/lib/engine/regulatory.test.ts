import { describe, expect, it } from "vitest";
import { sanitizeDraft } from "@/lib/avatar/sanitize";
import { EMPTY_DRAFT, missingParams, type InterviewCompany } from "@/lib/avatar/interview-types";
import type { RegulatoryBrief, RuleItem } from "@/lib/regulation/types";
import type { ReviewModel } from "./metrics";
import { carbonValue, regulationWeights, regulatoryObservations, ruleTimeline } from "./regulatory";

const rule = (p: Partial<RuleItem>): RuleItem => ({
  id: "climate-1",
  topic: "climate",
  category: "reporting",
  title: "Rule",
  jurisdiction: "Sweden",
  status: "in_force",
  effective: null,
  summary: "",
  relevance: "",
  action: "",
  metric: "none",
  priority: "evidence",
  sources: [{ title: "Gov", url: "https://gov.example/rule", verified: true }],
  confidence: "high",
  ...p,
});

const brief = (items: RuleItem[], eurPerTonne: number | null = null): RegulatoryBrief => ({
  version: 1,
  country: "Sweden",
  countryCode: "SE",
  industry: "Food & Beverage",
  role: "CFO",
  generatedAt: "2026-11-07T10:00:00Z",
  topics: [
    {
      topic: "climate",
      status: "ok",
      items,
      notes: "",
      queries: [],
      searchedSources: 3,
      carbonPrice: eurPerTonne
        ? { eurPerTonne, instrument: "Carbon tax", appliesTo: "fossil fuels", year: "2026", source: { title: "Gov", url: "https://gov.example/tax", verified: true } }
        : null,
    },
  ],
});

const model = {
  impact: {
    savings: { low: { co2Kg: 100_000, waterL: 0, energyKwh: 0 }, base: { co2Kg: 200_000, waterL: 0, energyKwh: 0 }, high: { co2Kg: 300_000, waterL: 0, energyKwh: 0 } },
    footprint: { co2Kg: 50_000 },
    waste: { totalKg: 0, divertedKg: 0 },
  },
  repairs: { repairs: 0, postponed: { low: 0, base: 0, high: 0 } },
  cycles: { onTimeShare: 0.95 },
  activity: { idleLatest: 0 },
} as unknown as ReviewModel;

describe("country rules linked to the review", () => {
  it("values avoided CO₂e at the researched carbon price (200 t × €138 = €27,600 base)", () => {
    const cv = carbonValue(model, brief([], 138));
    expect(cv?.eur.base).toBe(27_600);
    expect(cv?.eur.low).toBe(13_800);
    expect(cv?.eur.high).toBe(41_400);
  });

  it("shows no carbon value when research found no carbon price", () => {
    expect(carbonValue(model, brief([]))).toBeNull();
  });

  it("raises emphasis for the priority a rule touches", () => {
    const w = regulationWeights(brief([rule({ priority: "circularity", category: "textile_waste" })]));
    expect(w?.circularity).toBe(1);
    expect(w?.water).toBe(0);
  });

  it("counts a proposal less than a rule in force", () => {
    const inForce = regulationWeights(brief([rule({ priority: "water", status: "in_force" })]))!.water;
    const proposed = regulationWeights(brief([rule({ priority: "water", status: "proposed" })]))!.water;
    expect(proposed).toBeLessThan(inForce);
  });

  it("orders dated rules and counts months until they apply", () => {
    const tl = ruleTimeline(brief([rule({ id: "b", effective: "2028" }), rule({ id: "a", effective: "2027-03-19" })]), new Date(Date.UTC(2026, 10, 7)));
    expect(tl.map((t) => t.item.id)).toEqual(["a", "b"]);
    expect(tl[0].monthsAway).toBe(4);
  });

  it("turns the carbon price into a country-rule observation", () => {
    const obs = regulatoryObservations(model, brief([], 138), regulationWeights(brief([rule({})]))!, "base", new Date());
    expect(obs[0].id).toBe("rule-carbon-value");
    expect(obs[0].kind).toBe("rule");
  });
});

const companies: InterviewCompany[] = [
  { id: "CUST001", name: "NorthStar Foods Group", industry: "Food", segment: "", hqCountry: "Finland", topics: [], countries: [{ name: "Finland", sites: 12 }, { name: "Sweden", sites: 8 }], synthetic: true },
];

describe("avatar interview safeguards", () => {
  it("rejects a company that is not in the uploaded data", () => {
    expect(sanitizeDraft({ customerId: "ACME" }, companies, EMPTY_DRAFT).customerId).toBeNull();
  });

  it("accepts the company by name and a site country with a count label", () => {
    const d = sanitizeDraft({ customerId: "northstar foods group", country: "Sweden (8 sites)" }, companies, EMPTY_DRAFT);
    expect(d.customerId).toBe("CUST001");
    expect(d.country).toBe("Sweden");
  });

  it("rejects a country where the company has no sites", () => {
    expect(sanitizeDraft({ customerId: "CUST001", country: "Germany" }, companies, EMPTY_DRAFT).country).toBeNull();
  });

  it("requires company, role, location, decisions and goals before research", () => {
    expect(missingParams({ ...EMPTY_DRAFT, customerId: "CUST001", role: "CFO", country: "ALL", decisions: ["Budget"] })).toEqual(["goals"]);
  });

  it("clamps AI weights to 0–3", () => {
    const d = sanitizeDraft({ weights: { water: 7, emissions: -2, cost: 2, circularity: 0, service: 0, hygiene: 0, evidence: 0, improvement: 0 } }, companies, EMPTY_DRAFT);
    expect(d.weights?.water).toBe(3);
    expect(d.weights?.emissions).toBe(0);
  });
});
