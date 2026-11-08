import * as XLSX from "xlsx";
import { TABLES, normalizeHeader, type FieldSpec, type TableKey, type TableSpec } from "./schema";
import type {
  AssetCycle,
  AssetSummary,
  CycleAgg,
  Dataset,
  IngestIssue,
  IngestReport,
  TableReport,
} from "./types";
import { reconcile } from "./reconcile";

type Row = Record<string, unknown>;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const pad = (n: number) => String(n).padStart(2, "0");

function dateParts(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    d: d.getDate(),
    h: d.getHours(),
    min: d.getMinutes(),
  };
}

/** Accepts 2025-01, 2025/1, Jan 2025, 01.2025, Excel serials and Date objects. */
export function toMonth(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = dateParts(v);
    return `${p.y}-${pad(p.m)}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${pad(d.m)}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (m) return Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${pad(Number(m[2]))}` : null;
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${m[2]}-${pad(Number(m[1]))}` : null;
  m = s.match(/^([A-Za-z]{3})[a-z]*[\s-]+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${MONTHS[m[1].toLowerCase()]}`;
  return null;
}

export function toDateTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = dateParts(v);
    return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(d.H)}:${pad(d.M)}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2})?:?(\d{2})?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}`;
  return null;
}

export function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replaceAll(".", "").replace(",", ".") : s.replaceAll(",", "");
  } else if (/^[+-]?\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replaceAll(",", "");
  } else {
    s = s.replace(",", ".");
  }
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function coerce(field: FieldSpec, v: unknown): unknown {
  switch (field.type) {
    case "number":
      return toNumber(v);
    case "month":
      return toMonth(v);
    case "datetime":
      return toDateTime(v);
    case "list":
      return v == null || v === ""
        ? []
        : String(v)
            .split(/[|;,]/)
            .map((s) => s.trim())
            .filter(Boolean);
    default:
      return v == null || v === "" ? null : String(v).trim();
  }
}

/** One table as read from a workbook sheet or reconstructed from a PDF page. */
export interface RawSheet {
  name: string;
  headers: string[];
  rows: unknown[][];
}

function readSheets(wb: XLSX.WorkBook): RawSheet[] {
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
    return { name, headers, rows: aoa.slice(1) };
  });
}

/** Raw sheets of an Excel workbook, for combining several uploaded files before validation. */
export function readWorkbookSheets(data: ArrayBuffer | Uint8Array): RawSheet[] {
  return readSheets(XLSX.read(data, { type: "array", cellDates: true }));
}

export function matchField(spec: TableSpec, header: string): FieldSpec | null {
  const n = normalizeHeader(header);
  if (!n) return null;
  for (const f of spec.fields) {
    if (normalizeHeader(f.key) === n) return f;
  }
  for (const f of spec.fields) {
    if ((f.aliases ?? []).some((a) => normalizeHeader(a) === n)) return f;
  }
  return null;
}

function headerCoverage(spec: TableSpec, headers: string[]) {
  const required = spec.fields.filter((f) => f.required);
  const hits = required.filter((f) => headers.some((h) => matchField(spec, h)?.key === f.key)).length;
  return required.length ? hits / required.length : 0;
}

export function findSheet(spec: TableSpec, sheets: RawSheet[]): RawSheet | null {
  const byName = sheets.find((s) => spec.sheetAliases.includes(normalizeHeader(s.name)));
  if (byName) return byName;
  // Single-table uploads (CSV / renamed sheets): match by header coverage.
  let best: RawSheet | null = null;
  let bestScore = 0;
  for (const s of sheets) {
    const score = headerCoverage(spec, s.headers);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return bestScore >= 0.99 ? best : null;
}

interface ParsedTable {
  rows: Row[];
  report: TableReport;
}

function parseTable(spec: TableSpec, sheet: RawSheet, issues: IngestIssue[]): ParsedTable {
  const mapping: Array<{ idx: number; field: FieldSpec; header: string; viaAlias: boolean }> = [];
  const unused: string[] = [];
  sheet.headers.forEach((h, idx) => {
    const f = matchField(spec, h);
    if (f && !mapping.some((m) => m.field.key === f.key)) {
      mapping.push({ idx, field: f, header: h, viaAlias: normalizeHeader(h) !== normalizeHeader(f.key) });
    } else if (h.trim()) {
      unused.push(h);
    }
  });
  const missing = spec.fields.filter((f) => !mapping.some((m) => m.field.key === f.key)).map((f) => f.key);
  const missingRequired = spec.fields.filter((f) => f.required && missing.includes(f.key));
  if (missingRequired.length) {
    issues.push({
      severity: "error",
      table: spec.label,
      code: "missing_required_columns",
      message: `Required column(s) not found: ${missingRequired.map((f) => f.key).join(", ")}`,
      count: missingRequired.length,
    });
  }

  const rows: Row[] = [];
  let dropped = 0;
  const nullExamples: Record<string, number> = {};
  for (const raw of sheet.rows) {
    if (!raw || raw.every((c) => c == null || c === "")) continue;
    const row: Row = {};
    let bad = false;
    for (const m of mapping) {
      const val = coerce(m.field, raw[m.idx]);
      row[m.field.key] = val;
      if (m.field.required && (val == null || (Array.isArray(val) && !val.length))) {
        bad = true;
        nullExamples[m.field.key] = (nullExamples[m.field.key] ?? 0) + 1;
      }
    }
    if (bad || missingRequired.length) {
      dropped++;
      continue;
    }
    rows.push(row);
  }
  for (const [field, count] of Object.entries(nullExamples)) {
    issues.push({
      severity: "warning",
      table: spec.label,
      code: "missing_values",
      message: `${count} row(s) have an empty or unreadable “${field}” and were excluded`,
      count,
    });
  }

  return {
    rows,
    report: {
      table: spec.key,
      label: spec.label,
      required: spec.required,
      sourceSheet: sheet.name,
      rowsRead: sheet.rows.length,
      rowsKept: rows.length,
      rowsDropped: dropped,
      mappedColumns: mapping.map((m) => ({ field: m.field.key, sourceHeader: m.header, viaAlias: m.viaAlias })),
      missingColumns: missing,
      unusedHeaders: unused,
    },
  };
}

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export interface IngestOptions {
  /** Tables not present in the upload are taken from this dataset (partial refresh). */
  base?: Dataset;
  datasetId?: string;
  datasetName?: string;
  /** Assets per site kept with full cycle history for the garment passport. */
  passportAssetsPerSite?: number;
}

export interface IngestResult {
  dataset: Dataset | null;
  report: IngestReport;
}

export function ingestWorkbook(data: ArrayBuffer | Uint8Array, sourceName: string, opts: IngestOptions = {}): IngestResult {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  return ingestSheets(readSheets(wb), sourceName, opts);
}

/** Same validation and mapping as a workbook, for tables read from another format (PDF). */
export function ingestRawSheets(sheets: RawSheet[], sourceName: string, opts: IngestOptions = {}): IngestResult {
  return ingestSheets(sheets, sourceName, opts);
}

function ingestSheets(sheets: RawSheet[], sourceName: string, opts: IngestOptions): IngestResult {
  const issues: IngestIssue[] = [];
  const reports: TableReport[] = [];
  const parsed: Partial<Record<TableKey, Row[]>> = {};

  for (const spec of TABLES) {
    const sheet = findSheet(spec, sheets);
    if (!sheet) {
      const fromBase = opts.base != null;
      reports.push({
        table: spec.key,
        label: spec.label,
        required: spec.required,
        sourceSheet: null,
        rowsRead: 0,
        rowsKept: 0,
        rowsDropped: 0,
        mappedColumns: [],
        missingColumns: spec.fields.map((f) => f.key),
        unusedHeaders: [],
      });
      if (!fromBase && spec.required) {
        issues.push({ severity: "error", table: spec.label, code: "missing_table", message: `No sheet matched “${spec.label}”` });
      } else if (fromBase) {
        issues.push({
          severity: "info",
          table: spec.label,
          code: "kept_from_current",
          message: `Not in upload - current ${spec.label.toLowerCase()} data is kept`,
        });
      }
      continue;
    }
    const t = parseTable(spec, sheet, issues);
    parsed[spec.key] = t.rows;
    reports.push(t.report);
  }

  const base = opts.base;
  const pick = <K extends TableKey>(k: K) => parsed[k];

  const customers = pick("customers")?.map((r) => ({
    id: s(r.customer_id),
    name: s(r.customer_name),
    website: s(r.website),
    industry: s(r.industry),
    segment: s(r.segment),
    hqCountry: s(r.hq_country),
    priorityTopics: (r.priority_topics as string[]) ?? [],
    status: s(r.data_status) || "UNVERIFIED",
  })) ?? base?.customers ?? [];

  const laundries = pick("laundries")?.map((r) => ({
    id: s(r.laundry_id),
    name: s(r.laundry_name),
    country: s(r.country),
    countryCode: s(r.country_code),
    note: s(r.note),
  })) ?? base?.laundries ?? [];

  const products = pick("products")?.map((r) => ({
    id: s(r.product_id),
    name: s(r.product_name),
    group: s(r.product_group),
    weightKg: n(r.avg_weight_kg),
    footprintKgCo2e: n(r.synthetic_product_footprint_kgco2e),
    purchaseCostEur: n(r.synthetic_purchase_cost_eur),
    material: s(r.material_note),
  })) ?? base?.products ?? [];

  const sites = pick("sites")?.map((r) => ({
    id: s(r.site_id),
    customerId: s(r.customer_id),
    name: s(r.site_name),
    country: s(r.country),
    city: s(r.city),
    siteType: s(r.site_type),
    laundryId: s(r.primary_laundry_id),
    status: s(r.data_status) || "UNVERIFIED",
  })) ?? base?.sites ?? [];

  const customerIds = new Set(customers.map((c) => c.id));
  const siteIds = new Map(sites.map((x) => [x.id, x]));
  const productIds = new Set(products.map((p) => p.id));
  const laundryIds = new Set(laundries.map((l) => l.id));

  // Retained facts must never be attached to a changed master hierarchy.
  if (base && reports.some(r => r.sourceSheet === null)) {
    const changed = (
      parsed.customers && JSON.stringify(customers.map(c => c.id).sort()) !== JSON.stringify(base.customers.map(c => c.id).sort())
    ) || (
      parsed.products && JSON.stringify(products.map(p => p.id).sort()) !== JSON.stringify(base.products.map(p => p.id).sort())
    ) || (
      parsed.laundries && JSON.stringify(laundries.map(l => l.id).sort()) !== JSON.stringify(base.laundries.map(l => l.id).sort())
    ) || (
      parsed.sites && JSON.stringify(sites.map(s => [s.id, s.customerId, s.laundryId]).sort()) !== JSON.stringify(base.sites.map(s => [s.id, s.customerId, s.laundryId]).sort())
    );
    if (changed) issues.push({ severity: "error", table: "Workbook", code: "incompatible_partial_refresh", message: "Customer, site, product or laundry identifiers changed while old tables would be retained. Upload a complete compatible workbook; the current dataset is unchanged." });
  }

  // Unmapped-key handling: rows whose keys do not resolve to master data are
  // excluded from customer totals and reported with examples.
  function resolveKeys<T extends Row>(table: string, rows: T[] | undefined, keys: Array<"customer_id" | "site_id" | "product_id" | "laundry_id">): T[] | undefined {
    if (!rows) return rows;
    const bad: Record<string, Set<string>> = {};
    const badCount: Record<string, number> = {};
    const kept = rows.filter((r) => {
      let ok = true;
      for (const k of keys) {
        const v = s(r[k]);
        if (!v) continue;
        const valid =
          k === "customer_id" ? customerIds.has(v) : k === "site_id" ? siteIds.has(v) : k === "product_id" ? productIds.has(v) : laundryIds.has(v);
        if (!valid) {
          ok = false;
          (bad[k] ??= new Set()).add(v);
          badCount[k] = (badCount[k] ?? 0) + 1;
        }
      }
      if (ok && keys.includes("site_id") && keys.includes("customer_id")) {
        const site = siteIds.get(s(r.site_id));
        if (site && site.customerId !== s(r.customer_id)) {
          (bad.hierarchy ??= new Set()).add(`${s(r.site_id)}→${s(r.customer_id)}`);
          badCount.hierarchy = (badCount.hierarchy ?? 0) + 1;
          return false;
        }
      }
      return ok;
    });
    for (const [k, set] of Object.entries(bad)) {
      issues.push({
        severity: "error",
        table,
        code: k === "hierarchy" ? "site_customer_mismatch" : "unmapped_key",
        message:
          k === "hierarchy"
            ? `${badCount[k]} row(s) point a site to a different parent customer than the site master - excluded`
            : `${badCount[k]} row(s) reference ${k.replace("_id", "")} keys missing from master data - excluded from totals`,
        count: badCount[k],
        examples: [...set].slice(0, 5),
      });
    }
    return kept;
  }

  const activityRows = resolveKeys("Service activity", pick("activity"), ["customer_id", "site_id", "product_id", "laundry_id"]);
  const activity = activityRows?.map((r) => ({
    month: s(r.month),
    customerId: s(r.customer_id),
    siteId: s(r.site_id),
    laundryId: s(r.laundry_id) || siteIds.get(s(r.site_id))?.laundryId || "",
    productId: s(r.product_id),
    activeWearers: n(r.active_wearers),
    allocatedPieces: n(r.allocated_pieces),
    activeAssetsScanned: r.active_assets_scanned == null ? n(r.allocated_pieces) : n(r.active_assets_scanned),
    washedPieces: n(r.washed_pieces),
    packedPieces: n(r.packed_pieces),
    washingPct: r.washing_pct == null ? (n(r.allocated_pieces) ? (n(r.washed_pieces) / n(r.allocated_pieces)) * 100 : 0) : n(r.washing_pct),
    washedKg: n(r.customer_washed_kg),
    serviceRequests: n(r.service_requests),
    status: s(r.data_status) || "UNVERIFIED",
  })) ?? base?.activity ?? [];

  const productById = new Map(products.map((p) => [p.id, p]));
  const repairRows = resolveKeys("Repairs", pick("repairs"), ["customer_id", "site_id", "product_id", "laundry_id"]);
  const repairs = repairRows?.map((r) => {
    const footprint = r.product_footprint_kgco2e == null ? productById.get(s(r.product_id))?.footprintKgCo2e ?? 0 : n(r.product_footprint_kgco2e);
    const count = n(r.repair_count);
    const postponed = r.estimated_replacements_postponed == null ? count : n(r.estimated_replacements_postponed);
    return {
      month: s(r.month),
      customerId: s(r.customer_id),
      siteId: s(r.site_id),
      productId: s(r.product_id),
      laundryId: s(r.laundry_id) || siteIds.get(s(r.site_id))?.laundryId || "",
      repairType: s(r.repair_type).toUpperCase(),
      repairCount: count,
      repairQuotientPct: n(r.repair_quotient_pct),
      replacementsPostponed: postponed,
      productFootprintKgCo2e: footprint,
      avoidedProductKgCo2e: r.estimated_avoided_product_kgco2e == null ? postponed * footprint : n(r.estimated_avoided_product_kgco2e),
      status: s(r.data_status) || "UNVERIFIED_ESTIMATE",
    };
  }) ?? base?.repairs ?? [];

  // Service cycles → monthly aggregates + asset summaries + passport sample.
  let cycles: CycleAgg[] = base?.cycles ?? [];
  let assets: AssetSummary[] = base?.assets ?? [];
  let assetCycles: AssetCycle[] = base?.assetCycles ?? [];
  const cycleRows = resolveKeys("Service cycles (RFID)", pick("cycles"), ["customer_id", "site_id", "product_id", "laundry_id"]);
  if (cycleRows) {
    const agg = new Map<string, CycleAgg>();
    const perAsset = new Map<string, { rows: Row[] }>();
    for (const r of cycleRows) {
      const pickup = s(r.pickup_timestamp);
      const month = pickup.slice(0, 7);
      const hours =
        r.cycle_hours != null
          ? n(r.cycle_hours)
          : r.delivered_timestamp
            ? (Date.parse(s(r.delivered_timestamp)) - Date.parse(pickup)) / 3_600_000
            : 0;
      const late = s(r.performance_flag).toUpperCase() === "LATE";
      const key = `${month}|${s(r.site_id)}|${s(r.product_id)}`;
      const a =
        agg.get(key) ??
        ({
          month,
          customerId: s(r.customer_id),
          siteId: s(r.site_id),
          laundryId: s(r.laundry_id),
          productId: s(r.product_id),
          cycles: 0,
          late: 0,
          totalHours: 0,
          maxHours: 0,
        } satisfies CycleAgg);
      a.cycles += 1;
      a.late += late ? 1 : 0;
      a.totalHours += hours;
      a.maxHours = Math.max(a.maxHours, hours);
      agg.set(key, a);
      const asset = perAsset.get(s(r.asset_id)) ?? { rows: [] };
      asset.rows.push({ ...r, _hours: hours, _late: late });
      perAsset.set(s(r.asset_id), asset);
    }
    cycles = [...agg.values()].sort((x, y) => (x.month + x.siteId).localeCompare(y.month + y.siteId));

    assets = [];
    const bySite = new Map<string, AssetSummary[]>();
    for (const [assetId, { rows }] of perAsset) {
      rows.sort((x, y) => s(x.pickup_timestamp).localeCompare(s(y.pickup_timestamp)));
      const first = rows[0];
      const sum: AssetSummary = {
        assetId,
        customerId: s(first.customer_id),
        siteId: s(first.site_id),
        productId: s(first.product_id),
        cycles: rows.length,
        firstPickup: s(first.pickup_timestamp).slice(0, 10),
        lastPickup: s(rows[rows.length - 1].pickup_timestamp).slice(0, 10),
        late: rows.filter((x) => x._late).length,
        avgHours: rows.reduce((t, x) => t + n(x._hours), 0) / rows.length,
      };
      assets.push(sum);
      const list = bySite.get(sum.siteId) ?? [];
      list.push(sum);
      bySite.set(sum.siteId, list);
    }
    const perSite = opts.passportAssetsPerSite ?? 3;
    const sample = new Set<string>();
    if (perSite === Infinity) for (const a of assets) sample.add(a.assetId);
    else for (const list of bySite.values()) {
      const sorted = [...list].sort((a, b) => b.cycles - a.cycles || a.assetId.localeCompare(b.assetId));
      // Keep the most-travelled, one with a late cycle if any, and the quietest.
      const picks = [sorted[0], sorted.find((x) => x.late > 0), sorted[sorted.length - 1]].filter(Boolean) as AssetSummary[];
      for (const p of picks.slice(0, perSite)) sample.add(p.assetId);
    }
    assetCycles = [];
    for (const id of sample) {
      for (const r of perAsset.get(id)?.rows ?? []) {
        assetCycles.push({
          assetId: id,
          cycleNumber: n(r.cycle_number),
          pickup: s(r.pickup_timestamp),
          inLaundry: s(r.in_laundry_timestamp),
          outLaundry: s(r.out_laundry_timestamp),
          delivered: s(r.delivered_timestamp),
          hours: n(r._hours),
          late: Boolean(r._late),
        });
      }
    }
  }

  const laundryRows = resolveKeys("Laundry resources", pick("laundryMonths"), ["laundry_id"]);
  const laundryMonths = laundryRows?.map((r) => ({
    month: s(r.month),
    laundryId: s(r.laundry_id),
    washedKg: n(r.washed_kg),
    energyKwhPerKg: n(r.energy_kwh_per_kg),
    waterLPerKg: n(r.fresh_water_l_per_kg),
    energyKwh: r.process_energy_kwh == null ? n(r.washed_kg) * n(r.energy_kwh_per_kg) : n(r.process_energy_kwh),
    waterL: r.fresh_water_l == null ? n(r.washed_kg) * n(r.fresh_water_l_per_kg) : n(r.fresh_water_l),
    processKgCo2e: n(r.process_emissions_kgco2e),
    deliveryKgCo2e: n(r.delivery_emissions_kgco2e),
    status: s(r.data_status) || "UNVERIFIED",
  })) ?? base?.laundryMonths ?? [];

  const wasteRows = resolveKeys("Waste & circularity", pick("waste"), ["laundry_id"]);
  const waste = wasteRows?.map((r) => ({
    month: s(r.month),
    laundryId: s(r.laundry_id),
    recyclingKg: n(r.recycling_kg),
    reuseKg: n(r.reuse_kg),
    energyRecoveryKg: n(r.energy_recovery_kg),
    incinerationKg: n(r.incineration_kg),
    totalKg: n(r.textile_waste_total_kg),
    perWashedKg: n(r.waste_kg_per_washed_kg),
    status: s(r.data_status) || "UNVERIFIED",
  })) ?? base?.waste ?? [];

  const baselines = pick("baselines")?.map((r) => ({
    id: s(r.baseline_id),
    name: s(r.baseline_name),
    selection: s(r.selection_status),
    waterLPerKg: n(r.water_l_per_kg),
    energyKwhPerKg: n(r.energy_kwh_per_kg),
    processKgCo2ePerKg: n(r.process_kgco2e_per_kg),
    deliveryKgCo2ePerKg: n(r.delivery_kgco2e_per_kg),
    mixedWasteShare: r.mixed_waste_share == null ? 1 : n(r.mixed_waste_share),
    note: s(r.assumption_note),
  })) ?? base?.baselines ?? [];

  const impactRows = resolveKeys("Customer impacts", pick("impacts"), ["customer_id", "site_id", "product_id", "laundry_id"]);
  const impacts = impactRows?.map((r) => ({
    month: s(r.month),
    customerId: s(r.customer_id),
    siteId: s(r.site_id),
    laundryId: s(r.laundry_id) || siteIds.get(s(r.site_id))?.laundryId || "",
    productId: s(r.product_id),
    washedKg: n(r.customer_washed_kg),
    share: n(r.share_of_laundry_washed_kg),
    waterL: n(r.allocated_water_l),
    energyKwh: n(r.allocated_energy_kwh),
    processKgCo2e: n(r.allocated_process_kgco2e),
    deliveryKgCo2e: n(r.allocated_delivery_kgco2e),
    wasteKg: n(r.allocated_textile_waste_kg),
    waterSavingLocalL: n(r.water_saving_vs_local_l),
    energySavingLocalKwh: n(r.energy_saving_vs_local_kwh),
    co2SavingLocalKg: n(r.emissions_saving_vs_local_kgco2e),
    status: s(r.data_status) || "ALLOCATED_ESTIMATE",
  })) ?? base?.impacts ?? [];

  const dataset: Dataset = {
    meta: {
      id: opts.datasetId ?? `upload-${Date.now()}`,
      name: opts.datasetName ?? sourceName.replace(/\.[a-z0-9]+$/i, ""),
      sourceName,
      importedAt: new Date().toISOString(),
      months: [...new Set(activity.map((a) => a.month))].sort(),
    },
    customers,
    laundries,
    products,
    sites,
    industryPriorities:
      pick("industryPriorities")?.map((r) => ({
        industry: s(r.industry),
        rank: n(r.priority_rank),
        theme: s(r.priority_theme),
        emphasis: s(r.dashboard_emphasis),
      })) ?? base?.industryPriorities ?? [],
    activity,
    repairs,
    cycles,
    assets,
    assetCycles,
    laundryMonths,
    waste,
    baselines,
    impacts,
    assumptions:
      pick("assumptions")?.map((r) => ({
        id: s(r.assumption_id),
        assumption: s(r.assumption),
        value: s(r.value_or_rule),
        rationale: s(r.rationale),
        category: s(r.category),
        confidence: s(r.confidence),
        treatment: s(r.treatment),
      })) ?? base?.assumptions ?? [],
    dataQuality:
      pick("dataQuality")?.map((r) => ({
        dataset: s(r.dataset),
        fields: s(r.fields),
        status: s(r.status),
        confidence: s(r.confidence),
        note: s(r.note),
      })) ?? base?.dataQuality ?? [],
    suggestedPrompts:
      pick("suggestedPrompts")?.map((r) => ({ userType: s(r.user_type), prompt: s(r.prompt), expected: s(r.expected_output) })) ??
      base?.suggestedPrompts ??
      [],
    sampleOutput:
      pick("sampleOutput")?.map((r) => ({
        metric: s(r.metric),
        value: s(r.value),
        unit: s(r.unit),
        interpretation: s(r["status/interpretation"]),
      })) ?? base?.sampleOutput ?? [],
    dictionary:
      pick("dictionary")?.map((r) => ({
        sheet: s(r.sheet),
        field: s(r.field),
        definition: s(r.definition),
        joinRole: s(r.join_role),
        defaultStatus: s(r.default_status),
      })) ?? base?.dictionary ?? [],
    quickStart:
      pick("quickStart")?.map((r) => ({ step: n(r.step), action: s(r.builder_action), sheets: s(r.key_sheets), output: s(r.output) })) ??
      base?.quickStart ??
      [],
    readme: readReadme(sheets) ?? base?.readme ?? [],
  };

  const fatal = issues.some((i) => i.severity === "error");
  const report: IngestReport = {
    sourceName,
    generatedAt: new Date().toISOString(),
    tables: reports,
    issues,
    reconciliation: fatal ? [] : reconcile(dataset),
  };
  return { dataset: fatal ? null : dataset, report };
}

function readReadme(sheets: RawSheet[]): Array<{ key: string; value: string }> | null {
  const sheet = sheets.find((x) => normalizeHeader(x.name) === "readme");
  if (!sheet) return null;
  const all = [sheet.headers, ...sheet.rows] as unknown[][];
  return all
    .filter((r) => r && r[0] != null && String(r[0]).trim())
    .map((r) => ({ key: String(r[0]).trim(), value: r[1] == null ? "" : String(r[1]).trim() }));
}
