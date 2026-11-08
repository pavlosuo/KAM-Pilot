/**
 * Normalized, source-agnostic dataset used by every screen.
 * Any approved export (Tableau, Power BI, eLindström, Excel) is mapped into
 * this shape by the ingestion layer, so the customer experience never depends
 * on a specific source file layout.
 */

export type Month = string; // YYYY-MM

export interface Customer {
  id: string;
  name: string;
  industry: string;
  segment: string;
  hqCountry: string;
  priorityTopics: string[];
  status: string;
  website?: string;
}

export interface Laundry {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  note: string;
}

export interface Product {
  id: string;
  name: string;
  group: string;
  weightKg: number;
  footprintKgCo2e: number;
  purchaseCostEur: number;
  material: string;
}

export interface Site {
  id: string;
  customerId: string;
  name: string;
  country: string;
  city: string;
  siteType: string;
  laundryId: string;
  status: string;
}

export interface IndustryPriority {
  industry: string;
  rank: number;
  theme: string;
  emphasis: string;
}

export interface ActivityRow {
  month: Month;
  customerId: string;
  siteId: string;
  laundryId: string;
  productId: string;
  activeWearers: number;
  allocatedPieces: number;
  activeAssetsScanned: number;
  washedPieces: number;
  packedPieces: number;
  washingPct: number;
  washedKg: number;
  serviceRequests: number;
  status: string;
}

export interface RepairRow {
  month: Month;
  customerId: string;
  siteId: string;
  productId: string;
  laundryId: string;
  repairType: string;
  repairCount: number;
  repairQuotientPct: number;
  replacementsPostponed: number;
  productFootprintKgCo2e: number;
  avoidedProductKgCo2e: number;
  status: string;
}

/** Service_Cycles aggregated to customer/site/product/month (RFID-tracked sample). */
export interface CycleAgg {
  month: Month;
  customerId: string;
  siteId: string;
  laundryId: string;
  productId: string;
  cycles: number;
  late: number;
  totalHours: number;
  maxHours: number;
}

/** One RFID-tracked asset, summarised for dormancy and passport views. */
export interface AssetSummary {
  assetId: string;
  customerId: string;
  siteId: string;
  productId: string;
  cycles: number;
  firstPickup: string; // ISO date
  lastPickup: string; // ISO date
  late: number;
  avgHours: number;
}

/** Full cycle history for a small sample of assets (garment passport). */
export interface AssetCycle {
  assetId: string;
  cycleNumber: number;
  pickup: string;
  inLaundry: string;
  outLaundry: string;
  delivered: string;
  hours: number;
  late: boolean;
}

export interface LaundryMonth {
  month: Month;
  laundryId: string;
  washedKg: number;
  energyKwhPerKg: number;
  waterLPerKg: number;
  energyKwh: number;
  waterL: number;
  processKgCo2e: number;
  deliveryKgCo2e: number;
  status: string;
}

export interface WasteMonth {
  month: Month;
  laundryId: string;
  recyclingKg: number;
  reuseKg: number;
  energyRecoveryKg: number;
  incinerationKg: number;
  totalKg: number;
  perWashedKg: number;
  status: string;
}

export interface Baseline {
  id: string;
  name: string;
  selection: string;
  waterLPerKg: number;
  energyKwhPerKg: number;
  processKgCo2ePerKg: number;
  deliveryKgCo2ePerKg: number;
  mixedWasteShare: number;
  note: string;
}

export interface ImpactRow {
  month: Month;
  customerId: string;
  siteId: string;
  laundryId: string;
  productId: string;
  washedKg: number;
  share: number;
  waterL: number;
  energyKwh: number;
  processKgCo2e: number;
  deliveryKgCo2e: number;
  wasteKg: number;
  waterSavingLocalL: number;
  energySavingLocalKwh: number;
  co2SavingLocalKg: number;
  status: string;
}

export interface Assumption {
  id: string;
  assumption: string;
  value: string;
  rationale: string;
  category: string;
  confidence: string;
  treatment: string;
}

export interface DataQualityRow {
  dataset: string;
  fields: string;
  status: string;
  confidence: string;
  note: string;
}

export interface SuggestedPrompt {
  userType: string;
  prompt: string;
  expected: string;
}

export interface SampleOutputRow {
  metric: string;
  value: string;
  unit: string;
  interpretation: string;
}

export interface DictionaryRow {
  sheet: string;
  field: string;
  definition: string;
  joinRole: string;
  defaultStatus: string;
}

export interface QuickStartRow {
  step: number;
  action: string;
  sheets: string;
  output: string;
}

export interface Dataset {
  meta: {
    id: string;
    name: string;
    sourceName: string;
    importedAt: string;
    months: Month[];
  };
  customers: Customer[];
  laundries: Laundry[];
  products: Product[];
  sites: Site[];
  industryPriorities: IndustryPriority[];
  activity: ActivityRow[];
  repairs: RepairRow[];
  cycles: CycleAgg[];
  assets: AssetSummary[];
  assetCycles: AssetCycle[];
  laundryMonths: LaundryMonth[];
  waste: WasteMonth[];
  baselines: Baseline[];
  impacts: ImpactRow[];
  assumptions: Assumption[];
  dataQuality: DataQualityRow[];
  suggestedPrompts: SuggestedPrompt[];
  sampleOutput: SampleOutputRow[];
  dictionary: DictionaryRow[];
  quickStart: QuickStartRow[];
  readme: Array<{ key: string; value: string }>;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface IngestIssue {
  severity: IssueSeverity;
  table: string;
  code: string;
  message: string;
  count?: number;
  examples?: string[];
}

export interface TableReport {
  table: string;
  label: string;
  required: boolean;
  sourceSheet: string | null;
  rowsRead: number;
  rowsKept: number;
  rowsDropped: number;
  mappedColumns: Array<{ field: string; sourceHeader: string; viaAlias: boolean }>;
  missingColumns: string[];
  unusedHeaders: string[];
}

export interface ReconciliationCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  expected: string;
  observed: string;
  note: string;
}

export interface IngestReport {
  sourceName: string;
  generatedAt: string;
  tables: TableReport[];
  issues: IngestIssue[];
  reconciliation: ReconciliationCheck[];
}
