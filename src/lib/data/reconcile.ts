import type { Dataset, ReconciliationCheck } from "./types";

const fmt = (v: number, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const relDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 1) : Math.abs(a - b) / Math.abs(b));

function sampleValue(ds: Dataset, metric: string): number | null {
  const row = ds.sampleOutput.find((r) => r.metric.toLowerCase() === metric.toLowerCase());
  if (!row) return null;
  const v = Number(row.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * Reproducibility and consistency checks run on every ingest. They make data
 * problems visible instead of silently flowing into customer-facing figures.
 */
export function reconcile(ds: Dataset): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = [];
  const lastMonth = ds.meta.months[ds.meta.months.length - 1];

  // 1. Worked reference (Sample_Output) reproduction.
  const sampleCustomerName = ds.sampleOutput.find((r) => r.metric.toLowerCase() === "customer")?.value;
  const sampleCustomer = ds.customers.find((c) => c.name === sampleCustomerName);
  if (sampleCustomer) {
    const cid = sampleCustomer.id;
    const act = ds.activity.filter((a) => a.customerId === cid);
    const imp = ds.impacts.filter((a) => a.customerId === cid);
    const rep = ds.repairs.filter((a) => a.customerId === cid);
    const items: Array<[string, string, number, number | null, number]> = [
      ["ref-wearers", "Active wearers (last month, summed product rows)", act.filter((a) => a.month === lastMonth).reduce((t, a) => t + a.activeWearers, 0), sampleValue(ds, "Active wearers (Dec)"), 0],
      ["ref-allocated", "Garments allocated (last month)", act.filter((a) => a.month === lastMonth).reduce((t, a) => t + a.allocatedPieces, 0), sampleValue(ds, "Garments allocated (Dec)"), 0],
      ["ref-kg", "Washed kg (year)", act.reduce((t, a) => t + a.washedKg, 0), sampleValue(ds, "Washed kg 2025"), 1],
      ["ref-repairs", "Repairs (year)", rep.reduce((t, a) => t + a.repairCount, 0), sampleValue(ds, "Repairs 2025"), 0],
      ["ref-water", "Water saving vs local laundry (L)", imp.reduce((t, a) => t + a.waterSavingLocalL, 0), sampleValue(ds, "Water saving vs local"), 1],
      ["ref-co2", "Emission saving vs local laundry (kgCO2e)", imp.reduce((t, a) => t + a.co2SavingLocalKg, 0), sampleValue(ds, "Emission saving vs local"), 1],
      ["ref-waste", "Textile waste attributed (kg)", imp.reduce((t, a) => t + a.wasteKg, 0), sampleValue(ds, "Textile waste attributed"), 1],
      ["ref-requests", "Service requests (year)", act.reduce((t, a) => t + a.serviceRequests, 0), sampleValue(ds, "Service requests"), 0],
    ];
    for (const [id, label, observed, expected, d] of items) {
      if (expected == null) continue;
      const diff = relDiff(observed, expected);
      checks.push({
        id,
        label: `Reference: ${label}`,
        status: diff < 0.001 ? "pass" : diff < 0.02 ? "warn" : "fail",
        expected: fmt(expected, d),
        observed: fmt(observed, d),
        note: `${sampleCustomer.name}: engine total vs Sample_Output worked reference`,
      });
    }
  }

  // 2. Allocation share sanity: a customer cannot wash more than the laundry.
  const custKg = new Map<string, number>();
  for (const r of ds.impacts) custKg.set(`${r.laundryId}|${r.month}`, (custKg.get(`${r.laundryId}|${r.month}`) ?? 0) + r.washedKg);
  const over: Array<{ laundry: string; share: number }> = [];
  for (const lm of ds.laundryMonths) {
    const kg = custKg.get(`${lm.laundryId}|${lm.month}`) ?? 0;
    if (lm.washedKg > 0 && kg / lm.washedKg > 1.0001) over.push({ laundry: lm.laundryId, share: kg / lm.washedKg });
  }
  const overLaundries = [...new Set(over.map((o) => o.laundry))];
  checks.push({
    id: "alloc-share",
    label: "Customer washed kg ≤ laundry washed kg",
    status: over.length ? "warn" : "pass",
    expected: "Share of laundry ≤ 100% in every laundry-month",
    observed: over.length
      ? `${over.length} laundry-months above 100% (${overLaundries
          .map((l) => `${ds.laundries.find((x) => x.id === l)?.name ?? l}: up to ${fmt(Math.max(...over.filter((o) => o.laundry === l).map((o) => o.share)) * 100)}%`)
          .join("; ")})`
      : "All shares within 100%",
    note: over.length
      ? "Laundry totals are inconsistent with customer volumes. The engine allocates with per-kg intensities, which stay valid, but absolute laundry totals for these units should not be quoted."
      : "Allocation keys are internally consistent.",
  });

  // 3. Reproduce the supplied local-laundry saving from baseline factors.
  const local = ds.baselines.find((b) => b.selection.toUpperCase() === "DEFAULT") ?? ds.baselines[0];
  if (local && ds.impacts.length) {
    let maxDiff = 0;
    let totalSupplied = 0;
    let totalRecalc = 0;
    for (const r of ds.impacts) {
      const recalc = r.washedKg * local.waterLPerKg - r.waterL;
      totalSupplied += r.waterSavingLocalL;
      totalRecalc += recalc;
      maxDiff = Math.max(maxDiff, Math.abs(recalc - r.waterSavingLocalL));
    }
    checks.push({
      id: "recalc-water",
      label: `Water saving recomputed from ${local.name} factor`,
      status: relDiff(totalRecalc, totalSupplied) < 0.001 ? "pass" : "warn",
      expected: `${fmt(totalSupplied)} L (supplied column)`,
      observed: `${fmt(totalRecalc)} L (kg × ${local.waterLPerKg} L/kg − allocated water)`,
      note: `Largest single-row difference ${fmt(maxDiff, 1)} L (rounding). Confirms the saving logic is traceable.`,
    });
  }

  // 4. Waste allocation = washed kg × laundry waste intensity.
  const wasteBy = new Map(ds.waste.map((w) => [`${w.laundryId}|${w.month}`, w]));
  const lmBy = new Map(ds.laundryMonths.map((w) => [`${w.laundryId}|${w.month}`, w]));
  let wSupplied = 0;
  let wRecalc = 0;
  for (const r of ds.impacts) {
    const w = wasteBy.get(`${r.laundryId}|${r.month}`);
    const lm = lmBy.get(`${r.laundryId}|${r.month}`);
    if (!w || !lm || !lm.washedKg) continue;
    wSupplied += r.wasteKg;
    wRecalc += (r.washedKg / lm.washedKg) * w.totalKg;
  }
  if (wSupplied) {
    checks.push({
      id: "recalc-waste",
      label: "Textile waste allocated by share of washed kg (A003)",
      status: relDiff(wRecalc, wSupplied) < 0.005 ? "pass" : "warn",
      expected: `${fmt(wSupplied)} kg (supplied)`,
      observed: `${fmt(wRecalc)} kg (recomputed)`,
      note: "Waste is laundry-level; customer figures are allocated estimates.",
    });
  }

  // 5. Repair handprint rule.
  const mismatched = ds.repairs.filter((r) => r.replacementsPostponed !== r.repairCount).length;
  checks.push({
    id: "repair-rule",
    label: "Repair rule A002 applied in source (1 repair → 1 postponed replacement)",
    status: mismatched ? "warn" : "pass",
    expected: "postponed = repair_count",
    observed: mismatched ? `${mismatched} rows differ` : `All ${ds.repairs.length.toLocaleString("en-US")} rows`,
    note: "The dashboard applies its own sensitivity factor (low/base/high) on top of the raw count.",
  });

  // 6. Coverage: every site × product should report every month.
  const combos = new Map<string, Set<string>>();
  for (const a of ds.activity) {
    const k = `${a.siteId}|${a.productId}`;
    const set = combos.get(k) ?? new Set();
    set.add(a.month);
    combos.set(k, set);
  }
  const gaps = [...combos.entries()].filter(([, set]) => set.size < ds.meta.months.length);
  const silentSites = ds.sites.filter((x) => !ds.activity.some((a) => a.siteId === x.id));
  checks.push({
    id: "coverage",
    label: "Monthly coverage per site and product",
    status: gaps.length || silentSites.length ? "warn" : "pass",
    expected: `${ds.meta.months.length} months for each of ${combos.size} site-product combinations`,
    observed:
      gaps.length || silentSites.length
        ? `${gaps.length} combinations with gaps; ${silentSites.length} sites without activity`
        : "Complete",
    note: gaps.length ? `Examples: ${gaps.slice(0, 3).map(([k]) => k.replace("|", " / ")).join(", ")}` : "No missing months.",
  });

  // 7. RFID cycles vs washing volume coherence.
  if (ds.assets.length) {
    const months = ds.meta.months.length || 12;
    const cyclesPerAssetYear = (ds.assets.reduce((t, a) => t + a.cycles, 0) / ds.assets.length) * (12 / months);
    const washed = ds.activity.reduce((t, a) => t + a.washedPieces, 0);
    const allocated = ds.activity.reduce((t, a) => t + a.allocatedPieces, 0) / months;
    const washesPerPieceYear = allocated ? washed / allocated : 0;
    const ratio = washesPerPieceYear ? cyclesPerAssetYear / washesPerPieceYear : 1;
    checks.push({
      id: "rfid-coherence",
      label: "RFID cycle sample vs washing volume",
      status: ratio > 0.7 && ratio < 1.3 ? "pass" : "warn",
      expected: `≈ ${fmt(washesPerPieceYear, 1)} washes per allocated garment per year (Service_Activity)`,
      observed: `${fmt(cyclesPerAssetYear, 1)} tracked cycles per RFID asset per year (${ds.assets.length.toLocaleString("en-US")} assets)`,
      note:
        ratio > 0.7 && ratio < 1.3
          ? "Cycle sample is consistent with washing volumes."
          : "The cycle file is a sample: use it for turnaround and timeliness, not for wash frequency.",
    });
  }

  // 8. Laundries without any customer volume.
  const used = new Set(ds.impacts.map((i) => i.laundryId));
  const idle = ds.laundries.filter((l) => !used.has(l.id));
  if (idle.length) {
    checks.push({
      id: "idle-laundries",
      label: "Laundries in master data without customer volume",
      status: "pass",
      expected: "Informational",
      observed: idle.map((l) => l.name).join(", "),
      note: "Present in resource data but not serving the uploaded customers - excluded from allocation.",
    });
  }

  return checks;
}
