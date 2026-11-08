import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeDataset } from "../data/codec";
import { buildAudience, audienceSiteScope } from "../avatar/audience";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import { carEquivalent, waterEquivalent } from "./equivalents";
import { computeReview } from "./metrics";
import { generateObservations } from "./observations";
import { personalizedAvatarWeights } from "./avatar-personalization";
import { blendWeights, customerTopicWeights, industryWeights } from "./priorities";
import { planRebalance } from "./rebalance";
import { buildRecap } from "./recap";

const ds = decodeDataset(JSON.parse(readFileSync("src/data/default-dataset.json", "utf8")));
const months = ds.meta.months;

function recapFor(customerId: string, roles: string[], locations: string[]) {
  const customer = ds.customers.find((c) => c.id === customerId)!;
  const avatar = buildAudience({ customer, roles, locations }, ds);
  const sites = ds.sites.filter((s) => s.customerId === customerId);
  const siteIds = audienceSiteScope(avatar, sites);
  const weights = blendWeights({ industry: industryWeights(customer.industry, ds.industryPriorities), topics: customerTopicWeights(customer), avatar: personalizedAvatarWeights(avatar) });
  const model = computeReview(ds, { customerId, months, siteIds }, "B_LOCAL", DEFAULT_ASSUMPTIONS, weights);
  const plan = planRebalance(ds, customerId, months, DEFAULT_ASSUMPTIONS, siteIds);
  const observations = generateObservations(model, ds, weights, plan, avatar);
  return { model, recap: buildRecap({ model, dataset: ds, plan, observations, avatar, weights, brief: null, scenario: "base", today: new Date("2026-01-15"), locationLabel: locations.join(", ") || "All locations" }) };
}

describe("Recap - five questions from the uploaded data", () => {
  const { model, recap } = recapFor("CUST001", ["Procurement manager"], ["Finland"]);

  it("asks five questions: three for every customer first, then role and company", () => {
    expect(recap.chapters).toHaveLength(5);
    expect(recap.chapters.slice(0, 3).map((c) => c.id)).toEqual(["year", "risks", "next"]);
    expect(recap.chapters[0].question).toBe("What did 2025 with Lindström bring you?");
    expect(recap.chapters[3].scope).toBe("role");
    expect(recap.chapters[4].scope).toBe("company");
  });

  it("asks a procurement manager about unused garments and a food company about hygiene", () => {
    expect(recap.chapters[3].question).toBe("Are you paying for garments nobody uses?");
    expect(recap.chapters[4].question).toBe("Are garments washed as often as hygiene requires?");
  });

  it("opens with money: the total is the sum of its parts", () => {
    const money = recap.chapters[0].beats[0];
    expect(money.id).toBe("money");
    expect(money.visual.kind).toBe("stack");
    if (money.visual.kind !== "stack") return;
    const sum = money.visual.parts.reduce((t, p) => t + p.value, 0);
    expect(sum).toBeCloseTo(model.repairs.avoidedPurchaseEur.base + model.impact.savingsEur.base.energy + model.impact.savingsEur.base.water, 3);
  });

  it("compares water with Finnish families of four at 130 litres per person a day", () => {
    const water = recap.chapters[0].beats.find((b) => b.id === "water")!;
    const families = model.impact.savings.base.waterL / (130 * 365 * 4);
    expect(waterEquivalent(model.impact.savings.base.waterL, "Finland").families).toBeCloseTo(families, 6);
    expect(water.comparison).toContain("Finnish families of four");
  });

  it("compares CO₂ with a new car at 106.6 g/km around the 40,075 km Earth", () => {
    const eq = carEquivalent(255_073.8);
    expect(eq.km).toBeCloseTo(255_073.8 / 0.1066, 3);
    expect(eq.earthLaps).toBeCloseTo(eq.km / 40_075, 6);
  });

  it("never repeats a risk that a role or company question tells in depth", () => {
    const riskIds = recap.chapters[1].beats.map((b) => b.id);
    expect(riskIds).not.toContain("risk-idle");
    expect(riskIds).not.toContain("risk-rhythm");
    expect(riskIds.length).toBeGreaterThanOrEqual(1);
    expect(riskIds.length).toBeLessThanOrEqual(3);
  });

  it("scopes every figure to the chosen locations", () => {
    expect(recap.sitesInScope).toBe(12);
    expect(model.sites.every((s) => s.site.country === "Finland")).toBe(true);
  });

  it("gives a sustainability manager reporting questions and a manufacturer a circularity or cost question", () => {
    const r = recapFor("CUST002", ["Sustainability manager"], []).recap;
    expect(r.chapters[3].question).toBe("What can you put in your sustainability report?");
    expect(["How long does your workwear live?", "Are you paying for garments nobody uses?"]).toContain(r.chapters[4].question);
  });
});
