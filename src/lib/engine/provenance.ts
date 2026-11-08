/**
 * Every customer-facing figure carries a provenance record: what kind of
 * number it is, where it comes from, how it is calculated and which
 * assumptions it depends on. Rendered as a chip with an explanation.
 */

export type ProvenanceClass = "recorded" | "calculated" | "allocated" | "estimated" | "assumption" | "public";

export const PROVENANCE_CLASS_META: Record<ProvenanceClass, { label: string; description: string }> = {
  recorded: { label: "Recorded", description: "Counted directly in an operational source (in production: measured)." },
  calculated: { label: "Calculated", description: "Deterministic arithmetic on recorded values." },
  allocated: { label: "Allocated", description: "Laundry-level value shared to the customer by washed kg." },
  estimated: { label: "Estimated", description: "Depends on a baseline or assumption; shown with a low/base/high range." },
  assumption: { label: "Assumption", description: "An editable input, not a result." },
  public: { label: "Public reference", description: "Publicly stated context; not a calculation input." },
};

export interface Provenance {
  cls: ProvenanceClass;
  /** Input origin or calculation class; uploaded source statuses remain separate. */
  status: "Uploaded input" | "Estimate" | "Public reference";
  sources: string[];
  formula: string;
  assumptions: string[];
  confidence: "High" | "Medium" | "Low-Medium" | "Low";
}

export type MetricKey =
  | "sites"
  | "wearers"
  | "garments"
  | "rfidActive"
  | "utilization"
  | "idleGarments"
  | "washedKg"
  | "washRhythm"
  | "serviceRequests"
  | "requestFree"
  | "onTime"
  | "cycleHours"
  | "repairs"
  | "repairQuotient"
  | "postponed"
  | "avoidedProductCo2"
  | "footprintWater"
  | "footprintEnergy"
  | "footprintCo2"
  | "waterSaving"
  | "energySaving"
  | "co2Saving"
  | "wasteAttributed"
  | "wasteDiverted"
  | "eurSavings"
  | "idleCapital"
  | "dormant"
  | "rebalance";

const S = "Uploaded input" as const;
const SE = "Estimate" as const;

export const PROVENANCE: Record<MetricKey, Provenance> = {
  sites: { cls: "recorded", status: S, sources: ["Sites"], formula: "Count of delivery sites under the parent customer in scope", assumptions: ["A006"], confidence: "High" },
  wearers: {
    cls: "calculated",
    status: S,
    sources: ["Service_Activity.active_wearers"],
    formula:
      "Last month in period, Σ active wearers over site × product rows (data-pack definition, counts wearer-product assignments). Lower bound on unique people: per site the largest product line, summed over sites",
    assumptions: [],
    confidence: "Medium",
  },
  garments: { cls: "recorded", status: S, sources: ["Service_Activity.allocated_pieces"], formula: "Allocated pieces in the last month of the period", assumptions: [], confidence: "High" },
  rfidActive: { cls: "recorded", status: S, sources: ["Service_Activity.active_assets_scanned"], formula: "RFID-scanned active assets, last month", assumptions: [], confidence: "Medium" },
  utilization: {
    cls: "calculated",
    status: S,
    sources: ["Service_Activity"],
    formula: "Σ active assets scanned ÷ Σ allocated pieces over the period",
    assumptions: ["P03"],
    confidence: "Medium",
  },
  idleGarments: {
    cls: "calculated",
    status: S,
    sources: ["Service_Activity"],
    formula: "Allocated pieces − RFID-active assets, last month",
    assumptions: [],
    confidence: "Medium",
  },
  washedKg: { cls: "recorded", status: S, sources: ["Service_Activity.customer_washed_kg"], formula: "Σ washed kg over the period", assumptions: [], confidence: "High" },
  washRhythm: {
    cls: "calculated",
    status: S,
    sources: ["Service_Activity.washed_pieces", "Service_Activity.allocated_pieces"],
    formula: "Σ washed pieces ÷ Σ allocated garment-months, compared with the expected rhythm",
    assumptions: ["P02"],
    confidence: "Medium",
  },
  serviceRequests: {
    cls: "recorded",
    status: S,
    sources: ["Service_Activity.service_requests"],
    formula: "Σ service requests; rate per 1,000 de-duplicated wearer-months",
    assumptions: [],
    confidence: "Medium",
  },
  requestFree: {
    cls: "calculated",
    status: S,
    sources: ["Service_Activity.service_requests"],
    formula: "Share of site-months with zero service requests",
    assumptions: [],
    confidence: "Medium",
  },
  onTime: {
    cls: "calculated",
    status: S,
    sources: ["Service_Cycles.performance_flag"],
    formula: "1 − LATE cycles ÷ all tracked cycles (RFID sample)",
    assumptions: [],
    confidence: "Medium",
  },
  cycleHours: { cls: "calculated", status: S, sources: ["Service_Cycles.cycle_hours"], formula: "Mean pickup → delivered hours across tracked cycles", assumptions: [], confidence: "Medium" },
  repairs: { cls: "recorded", status: S, sources: ["Repairs.repair_count"], formula: "Σ completed repairs over the period", assumptions: [], confidence: "Medium" },
  repairQuotient: {
    cls: "calculated",
    status: S,
    sources: ["Repairs", "Service_Activity.washed_pieces"],
    formula: "Repairs ÷ washed pieces",
    assumptions: [],
    confidence: "Medium",
  },
  postponed: {
    cls: "estimated",
    status: SE,
    sources: ["Repairs.repair_count"],
    formula: "Repairs × replacements postponed per repair (low / base / high)",
    assumptions: ["A002"],
    confidence: "Low-Medium",
  },
  avoidedProductCo2: {
    cls: "estimated",
    status: SE,
    sources: ["Repairs", "Products.product_footprint_kgco2e"],
    formula: "Σ repairs × product footprint × A002 factor",
    assumptions: ["A002", "A005"],
    confidence: "Low",
  },
  footprintWater: {
    cls: "allocated",
    status: SE,
    sources: ["Customer_Impacts.allocated_water_l", "Laundry_Resources"],
    formula: "Customer washed kg × laundry fresh-water intensity (L/kg)",
    assumptions: ["A003"],
    confidence: "Medium",
  },
  footprintEnergy: {
    cls: "allocated",
    status: SE,
    sources: ["Customer_Impacts.allocated_energy_kwh", "Laundry_Resources"],
    formula: "Customer washed kg × laundry energy intensity (kWh/kg)",
    assumptions: ["A003"],
    confidence: "Medium",
  },
  footprintCo2: {
    cls: "allocated",
    status: SE,
    sources: ["Customer_Impacts.allocated_process_kgco2e", "Customer_Impacts.allocated_delivery_kgco2e"],
    formula: "Allocated process + delivery emissions by share of washed kg",
    assumptions: ["A003"],
    confidence: "Medium",
  },
  waterSaving: {
    cls: "estimated",
    status: SE,
    sources: ["Customer_Impacts", "Baselines.water_l_per_kg"],
    formula: "Washed kg × alternative water factor × scenario − allocated water",
    assumptions: ["A001", "P01"],
    confidence: "Low-Medium",
  },
  energySaving: {
    cls: "estimated",
    status: SE,
    sources: ["Customer_Impacts", "Baselines.energy_kwh_per_kg"],
    formula: "Washed kg × alternative energy factor × scenario − allocated energy",
    assumptions: ["A001", "P01"],
    confidence: "Low-Medium",
  },
  co2Saving: {
    cls: "estimated",
    status: SE,
    sources: ["Customer_Impacts", "Baselines (process + delivery kgCO2e/kg)"],
    formula: "Washed kg × (alternative process + delivery factor) × scenario − allocated process & delivery emissions",
    assumptions: ["A001", "P01"],
    confidence: "Low-Medium",
  },
  wasteAttributed: {
    cls: "allocated",
    status: SE,
    sources: ["Waste_Circularity", "Customer_Impacts.allocated_textile_waste_kg"],
    formula: "Laundry textile waste × customer share of washed kg",
    assumptions: ["A003"],
    confidence: "Medium",
  },
  wasteDiverted: {
    cls: "estimated",
    status: SE,
    sources: ["Waste_Circularity (recycling, reuse)"],
    formula: "Allocated recycling + reuse kg, minus what the alternative would divert",
    assumptions: ["A003", "A004"],
    confidence: "Low-Medium",
  },
  eurSavings: {
    cls: "estimated",
    status: SE,
    sources: ["Energy and water savings"],
    formula: "kWh saved × electricity price + m³ saved × water price",
    assumptions: ["P04", "P05", "P01"],
    confidence: "Low",
  },
  idleCapital: {
    cls: "estimated",
    status: SE,
    sources: ["Service_Activity", "Products.purchase_cost_eur"],
    formula: "Idle garments × uploaded purchase cost",
    assumptions: ["P03", "A005"],
    confidence: "Low",
  },
  dormant: {
    cls: "calculated",
    status: S,
    sources: ["Service_Cycles (RFID sample)"],
    formula: "Tracked garments whose last pickup is older than the dormant threshold at period end",
    assumptions: ["P06"],
    confidence: "Medium",
  },
  rebalance: {
    cls: "estimated",
    status: SE,
    sources: ["Service_Activity (last 3 months)", "Sites.primary_laundry_id", "Products"],
    formula: "Surplus above target utilization moved to sites running above it within the same laundry and product",
    assumptions: ["P03", "A005"],
    confidence: "Low-Medium",
  },
};
