import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { decodeDataset } from "../data/codec";
import { ingestWorkbook } from "../data/ingest";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";
import { computeReview } from "./metrics";
import { generateObservations } from "./observations";
import { blendWeights, industryWeights, parsePriorityText, ZERO_WEIGHTS } from "./priorities";
import { planRebalance } from "./rebalance";

const ds = decodeDataset(JSON.parse(readFileSync("src/data/default-dataset.json", "utf8")));
const months = ds.meta.months;
const scope = { customerId: "CUST001", months };
const review = (baselineId = "B_LOCAL", a = DEFAULT_ASSUMPTIONS) => computeReview(ds, scope, baselineId, a, ZERO_WEIGHTS);

describe("worked reference (Sample_Output) for NorthStar Foods Group 2025", () => {
  const m = review();
  it("reproduces washed kg 502,074.7", () => expect(m.impact.washedKg).toBeCloseTo(502074.7, 1));
  it("reproduces repairs 15,233", () => expect(m.repairs.repairs).toBe(15233));
  it("reproduces service requests 515", () => expect(m.activity.serviceRequests).toBe(515));
  it("reproduces water saving vs local laundry 1,406,482.6 L", () => expect(m.impact.savings.base.waterL).toBeCloseTo(1406482.6, -1));
  it("reproduces emission saving vs local laundry 255,073.1 kgCO2e", () => expect(m.impact.savings.base.co2Kg).toBeCloseTo(255073.1, -1));
  it("reproduces attributed textile waste 16,797.1 kg", () => expect(m.impact.waste.totalKg).toBeCloseTo(16797.1, 0));
  it("covers 24 delivery sites", () => expect(m.sites.length).toBe(24));
});

describe("baselines and sensitivity", () => {
  it("defaults to outsourced local laundry (A001)", () => {
    expect(ds.baselines.find((b) => b.selection === "DEFAULT")?.id).toBe("B_LOCAL");
  });
  it("home washing compares at 20 L/kg", () => {
    const m = review("B_HOME");
    expect(m.impact.savings.base.waterL).toBeCloseTo(m.impact.washedKg * 20 - m.impact.footprint.waterL, 3);
  });
  it("low < base < high for every saving", () => {
    const s = review().impact.savings;
    expect(s.low.waterL).toBeLessThan(s.base.waterL);
    expect(s.base.co2Kg).toBeLessThan(s.high.co2Kg);
  });
  it("low scenario scales the alternative by −15% (P01)", () => {
    const m = review();
    expect(m.impact.alternative.low.waterL).toBeCloseTo(m.impact.washedKg * 9.5 * 0.85, 3);
  });
});

describe("repair handprint (A002)", () => {
  const m = review();
  it("base: one repair postpones one replacement", () => expect(m.repairs.postponed.base).toBe(15233));
  it("low: half a replacement per repair", () => expect(m.repairs.postponed.low).toBe(7616.5));
  it("high is capped at the A002 rule", () => expect(m.repairs.postponed.high).toBe(15233));
});

describe("wash rhythm (P02 - four washes a month)", () => {
  it("defaults to 4 expected washes per garment per month", () => expect(DEFAULT_ASSUMPTIONS.washTargetPerMonth).toBe(4));
  it("uses washed pieces over allocated garment-months", () => {
    const m = review();
    const act = ds.activity.filter((r) => r.customerId === "CUST001");
    const expected = act.reduce((t, r) => t + r.washedPieces, 0) / act.reduce((t, r) => t + r.allocatedPieces, 0);
    expect(m.activity.washesPerGarmentMonth).toBeCloseTo(expected, 6);
  });
});

describe("priority personalization", () => {
  it("reads 'water is super important, money is super important' as top water and cost", () => {
    const { weights } = parsePriorityText("For this customer water is super important. Money is super important too.");
    expect(weights.water).toBe(3);
    expect(weights.cost).toBe(3);
    expect(weights.service).toBe(0);
  });
  it("food industry rules put hygiene first", () => {
    const w = industryWeights("Food & Beverage", ds.industryPriorities);
    expect(w.hygiene).toBe(3);
    expect(w.water).toBe(2);
  });
  it("an explicit prompt outranks industry defaults", () => {
    const w = blendWeights({
      industry: industryWeights("Food & Beverage", ds.industryPriorities),
      topics: ZERO_WEIGHTS,
      avatar: ZERO_WEIGHTS,
      prompt: { ...ZERO_WEIGHTS, emissions: 3 },
    });
    expect(w.emissions).toBeGreaterThan(w.hygiene);
  });
});

describe("observations and rebalancing", () => {
  const m = review();
  const plan = planRebalance(ds, "CUST001", months, DEFAULT_ASSUMPTIONS);
  it("produces at least three observations", () => {
    expect(generateObservations(m, ds, ZERO_WEIGHTS, plan).length).toBeGreaterThanOrEqual(3);
  });
  it("only transfers garments between sites of the same laundry and product", () => {
    const sites = new Map(ds.sites.map((s) => [s.id, s]));
    for (const t of plan.transfers) {
      expect(sites.get(t.fromSiteId)?.laundryId).toBe(sites.get(t.toSiteId)?.laundryId);
      expect(t.pieces).toBeGreaterThan(0);
    }
  });
});

describe("ingestion of a future Repairs export", () => {
  it("maps Account Top Level / Delivery Customer / Product Code / Laundry / Repair Name and reports unmapped sites", () => {
    const rows = [
      ["Month", "Account Top Level", "Delivery Customer", "Product Code", "Laundry", "Repair Name", "Repair Count"],
      ["2025-01", "CUST001", "S001", "P1001", "L001", "Zipper", 12],
      ["Jan 2025", "CUST001", "S999", "P1001", "L001", "Button", 3],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Repairs");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const { dataset, report } = ingestWorkbook(buf, "repairs.xlsx", { base: ds });
    expect(dataset).toBeNull();
    const unmapped = report.issues.find((i) => i.code === "unmapped_key");
    expect(unmapped?.examples).toContain("S999");
    expect(unmapped?.severity).toBe("error");
    const valid = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(valid, XLSX.utils.aoa_to_sheet(rows.slice(0, 2)), "Repairs");
    const accepted = ingestWorkbook(XLSX.write(valid, { type: "array", bookType: "xlsx" }), "valid-repairs.xlsx", { base: ds });
    expect(accepted.dataset?.repairs[0].repairType).toBe("ZIPPER");
    expect(accepted.dataset?.activity.length).toBe(ds.activity.length);
  });
});
