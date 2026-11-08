/**
 * Source-to-prototype field mapping. Each table lists the canonical field and
 * the header aliases we accept, so approved exports with different column
 * names (e.g. the Lindström Repairs report: "Account Top Level",
 * "Delivery Customer", "Product Code", "Laundry", "Repair Name") can replace
 * the synthetic sheets without changing the dashboard.
 */

export type FieldType = "string" | "number" | "month" | "datetime" | "list";

export interface FieldSpec {
  key: string;
  type: FieldType;
  required: boolean;
  aliases?: string[];
  /** Join key that must resolve against master data. */
  ref?: "customer" | "site" | "product" | "laundry";
  description?: string;
  /** Future Lindström source type this field is expected to come from. */
  futureSource?: string;
}

export interface TableSpec {
  key: TableKey;
  label: string;
  sheetAliases: string[];
  required: boolean;
  fields: FieldSpec[];
  /** Plain-language role in the review. */
  role: string;
  futureSource: string;
}

export type TableKey =
  | "customers"
  | "laundries"
  | "products"
  | "sites"
  | "industryPriorities"
  | "activity"
  | "repairs"
  | "cycles"
  | "laundryMonths"
  | "waste"
  | "baselines"
  | "impacts"
  | "assumptions"
  | "dataQuality"
  | "suggestedPrompts"
  | "sampleOutput"
  | "dictionary"
  | "quickStart";

const status: FieldSpec = { key: "data_status", type: "string", required: false, aliases: ["status", "data_status_label"] };

export const TABLES: TableSpec[] = [
  {
    key: "customers",
    label: "Customers",
    sheetAliases: ["customers", "customer", "accounts", "account_top_level"],
    required: true,
    role: "Parent customer hierarchy and industry context",
    futureSource: "CRM / customer master data (account top level)",
    fields: [
      { key: "customer_id", type: "string", required: true, aliases: ["account_id", "account_top_level_id", "parent_customer_id"] },
      { key: "customer_name", type: "string", required: true, aliases: ["account_top_level", "account_name", "name"] },
      { key: "website", type: "string", required: false, aliases: ["company_domain", "domain", "company_website", "website_url"] },
      { key: "industry", type: "string", required: true, aliases: ["industry_segment", "sector"] },
      { key: "segment", type: "string", required: false, aliases: ["customer_segment", "kam_segment"] },
      { key: "hq_country", type: "string", required: false, aliases: ["country", "hq"] },
      { key: "priority_topics", type: "list", required: false, aliases: ["priorities", "topics"] },
      status,
    ],
  },
  {
    key: "laundries",
    label: "Laundries",
    sheetAliases: ["laundries", "laundry", "wws_laundries"],
    required: true,
    role: "Lindström laundry units serving the sites",
    futureSource: "Laundry master data (WWS)",
    fields: [
      { key: "laundry_id", type: "string", required: true, aliases: ["laundry", "laundry_code"] },
      { key: "laundry_name", type: "string", required: true, aliases: ["name"] },
      { key: "country", type: "string", required: false },
      { key: "country_code", type: "string", required: false },
      { key: "note", type: "string", required: false },
    ],
  },
  {
    key: "products",
    label: "Products",
    sheetAliases: ["products", "product", "articles"],
    required: true,
    role: "Garment catalogue with weight, footprint and cost factors",
    futureSource: "Product master (PIM) + approved product footprints (LCA)",
    fields: [
      { key: "product_id", type: "string", required: true, aliases: ["product_code", "article_code", "sku"] },
      { key: "product_name", type: "string", required: true, aliases: ["product", "article_name"] },
      { key: "product_group", type: "string", required: false, aliases: ["group", "category"] },
      { key: "avg_weight_kg", type: "number", required: true, aliases: ["weight_kg", "avg_weight"] },
      { key: "synthetic_product_footprint_kgco2e", type: "number", required: true, aliases: ["product_footprint_kgco2e", "footprint_kgco2e"] },
      { key: "synthetic_purchase_cost_eur", type: "number", required: false, aliases: ["purchase_cost_eur", "cost_eur"] },
      { key: "material_note", type: "string", required: false, aliases: ["material"] },
    ],
  },
  {
    key: "sites",
    label: "Sites",
    sheetAliases: ["sites", "site", "delivery_customers", "delivery_sites"],
    required: true,
    role: "Delivery sites under each parent customer (site drill-down)",
    futureSource: "eLindström delivery customer list mapped to account top level",
    fields: [
      { key: "site_id", type: "string", required: true, aliases: ["delivery_customer_id", "delivery_customer", "site_code"] },
      { key: "customer_id", type: "string", required: true, ref: "customer", aliases: ["account_top_level", "account_id"] },
      { key: "site_name", type: "string", required: true, aliases: ["delivery_customer_name", "name"] },
      { key: "country", type: "string", required: false },
      { key: "city", type: "string", required: false },
      { key: "site_type", type: "string", required: false, aliases: ["type"] },
      { key: "primary_laundry_id", type: "string", required: false, ref: "laundry", aliases: ["laundry_id", "laundry"] },
      status,
    ],
  },
  {
    key: "industryPriorities",
    label: "Industry priorities",
    sheetAliases: ["industry_priorities", "industry_rules"],
    required: false,
    role: "Industry-aware emphasis rules",
    futureSource: "Curated by Lindström sustainability / KAM teams",
    fields: [
      { key: "industry", type: "string", required: true },
      { key: "priority_rank", type: "number", required: true, aliases: ["rank"] },
      { key: "priority_theme", type: "string", required: true, aliases: ["theme"] },
      { key: "dashboard_emphasis", type: "string", required: false, aliases: ["emphasis"] },
    ],
  },
  {
    key: "activity",
    label: "Service activity",
    sheetAliases: ["service_activity", "allocated_pieces", "activity", "washing_pct"],
    required: true,
    role: "Wearers, allocated garments, RFID-active assets, washes and service requests",
    futureSource: "Tableau: Allocated pieces + Washing % reports",
    fields: [
      { key: "month", type: "month", required: true, aliases: ["period", "date", "reporting_month"] },
      { key: "customer_id", type: "string", required: true, ref: "customer", aliases: ["account_top_level"] },
      { key: "site_id", type: "string", required: true, ref: "site", aliases: ["delivery_customer"] },
      { key: "laundry_id", type: "string", required: false, ref: "laundry", aliases: ["laundry"] },
      { key: "product_id", type: "string", required: true, ref: "product", aliases: ["product_code"] },
      { key: "active_wearers", type: "number", required: true, aliases: ["wearers", "users"] },
      { key: "allocated_pieces", type: "number", required: true, aliases: ["allocated", "pieces_allocated"] },
      { key: "active_assets_scanned", type: "number", required: false, aliases: ["active_assets", "rfid_active_assets"] },
      { key: "washed_pieces", type: "number", required: true, aliases: ["washed"] },
      { key: "packed_pieces", type: "number", required: false, aliases: ["packed"] },
      { key: "washing_pct", type: "number", required: false, aliases: ["washing_percentage", "washing_%"] },
      { key: "customer_washed_kg", type: "number", required: true, aliases: ["washed_kg"] },
      { key: "service_requests", type: "number", required: false, aliases: ["requests"] },
      status,
    ],
  },
  {
    key: "repairs",
    label: "Repairs",
    sheetAliases: ["repairs", "repair", "repairs_table"],
    required: true,
    role: "Monthly repair counts by site, product and repair type",
    futureSource: "Tableau Repairs report (Account Top Level, Delivery Customer, Product Code, Laundry, Repair Name)",
    fields: [
      { key: "month", type: "month", required: true, aliases: ["period", "date"] },
      { key: "customer_id", type: "string", required: true, ref: "customer", aliases: ["account_top_level"] },
      { key: "site_id", type: "string", required: true, ref: "site", aliases: ["delivery_customer"] },
      { key: "product_id", type: "string", required: true, ref: "product", aliases: ["product_code"] },
      { key: "laundry_id", type: "string", required: false, ref: "laundry", aliases: ["laundry"] },
      { key: "repair_type", type: "string", required: true, aliases: ["repair_name", "repair"] },
      { key: "repair_count", type: "number", required: true, aliases: ["repairs", "count"] },
      { key: "repair_quotient_pct", type: "number", required: false, aliases: ["repair_quotient"] },
      { key: "estimated_replacements_postponed", type: "number", required: false },
      { key: "product_footprint_kgco2e", type: "number", required: false },
      { key: "estimated_avoided_product_kgco2e", type: "number", required: false },
      status,
    ],
  },
  {
    key: "cycles",
    label: "Service cycles (RFID)",
    sheetAliases: ["service_cycles", "end_to_end_delivery", "cycles"],
    required: false,
    role: "RFID scan timestamps per garment cycle: turnaround and timeliness",
    futureSource: "Tableau: End to end delivery report (RFID scans)",
    fields: [
      { key: "asset_id", type: "string", required: true, aliases: ["rfid", "tag_id"] },
      { key: "cycle_number", type: "number", required: false },
      { key: "customer_id", type: "string", required: true, ref: "customer", aliases: ["account_top_level"] },
      { key: "site_id", type: "string", required: true, ref: "site", aliases: ["delivery_customer"] },
      { key: "laundry_id", type: "string", required: false, ref: "laundry", aliases: ["laundry"] },
      { key: "product_id", type: "string", required: true, ref: "product", aliases: ["product_code"] },
      { key: "pickup_timestamp", type: "datetime", required: true, aliases: ["pickup"] },
      { key: "in_laundry_timestamp", type: "datetime", required: false, aliases: ["in_laundry"] },
      { key: "out_laundry_timestamp", type: "datetime", required: false, aliases: ["out_laundry"] },
      { key: "delivered_timestamp", type: "datetime", required: false, aliases: ["delivered"] },
      { key: "cycle_hours", type: "number", required: false },
      { key: "performance_flag", type: "string", required: false, aliases: ["flag"] },
      status,
    ],
  },
  {
    key: "laundryMonths",
    label: "Laundry resources",
    sheetAliases: ["laundry_resources", "washed_kg", "laundry_environment"],
    required: true,
    role: "Laundry-level washed kg, water, energy and emissions",
    futureSource: "WWS Washed Kg + laundry utility metering + emission factors",
    fields: [
      { key: "month", type: "month", required: true },
      { key: "laundry_id", type: "string", required: true, ref: "laundry", aliases: ["laundry"] },
      { key: "laundry_name", type: "string", required: false },
      { key: "country", type: "string", required: false },
      { key: "washed_kg", type: "number", required: true },
      { key: "energy_kwh_per_kg", type: "number", required: true },
      { key: "fresh_water_l_per_kg", type: "number", required: true, aliases: ["water_l_per_kg"] },
      { key: "process_energy_kwh", type: "number", required: false },
      { key: "fresh_water_l", type: "number", required: false },
      { key: "process_emissions_kgco2e", type: "number", required: true },
      { key: "delivery_emissions_kgco2e", type: "number", required: true },
      status,
    ],
  },
  {
    key: "waste",
    label: "Waste & circularity",
    sheetAliases: ["waste_circularity", "textile_waste", "textile_waste_kg"],
    required: true,
    role: "Laundry-level textile waste by treatment route",
    futureSource: "Textile Waste kg report (treatment routes)",
    fields: [
      { key: "month", type: "month", required: true },
      { key: "laundry_id", type: "string", required: true, ref: "laundry", aliases: ["laundry"] },
      { key: "recycling_kg", type: "number", required: true },
      { key: "reuse_kg", type: "number", required: true },
      { key: "energy_recovery_kg", type: "number", required: true },
      { key: "incineration_kg", type: "number", required: true },
      { key: "textile_waste_total_kg", type: "number", required: true, aliases: ["total_kg"] },
      { key: "waste_kg_per_washed_kg", type: "number", required: false },
      status,
    ],
  },
  {
    key: "baselines",
    label: "Comparison baselines",
    sheetAliases: ["baselines", "baseline", "comparison"],
    required: true,
    role: "Alternative washing models used for the handprint comparison",
    futureSource: "Workwear laundry Environmental Impact Comparison (approved factors)",
    fields: [
      { key: "baseline_id", type: "string", required: true },
      { key: "baseline_name", type: "string", required: true },
      { key: "selection_status", type: "string", required: false },
      { key: "water_l_per_kg", type: "number", required: true },
      { key: "energy_kwh_per_kg", type: "number", required: true },
      { key: "process_kgco2e_per_kg", type: "number", required: true },
      { key: "delivery_kgco2e_per_kg", type: "number", required: true },
      { key: "mixed_waste_share", type: "number", required: false },
      { key: "assumption_note", type: "string", required: false },
    ],
  },
  {
    key: "impacts",
    label: "Customer impacts",
    sheetAliases: ["customer_impacts", "impacts", "allocated_impacts"],
    required: true,
    role: "Footprint allocated to customer/site/product by share of washed kg",
    futureSource: "Calculated in the module from washed kg × laundry factors",
    fields: [
      { key: "month", type: "month", required: true },
      { key: "customer_id", type: "string", required: true, ref: "customer" },
      { key: "site_id", type: "string", required: true, ref: "site" },
      { key: "laundry_id", type: "string", required: false, ref: "laundry" },
      { key: "product_id", type: "string", required: true, ref: "product" },
      { key: "customer_washed_kg", type: "number", required: true },
      { key: "share_of_laundry_washed_kg", type: "number", required: false },
      { key: "allocated_water_l", type: "number", required: true },
      { key: "allocated_energy_kwh", type: "number", required: true },
      { key: "allocated_process_kgco2e", type: "number", required: true },
      { key: "allocated_delivery_kgco2e", type: "number", required: true },
      { key: "allocated_textile_waste_kg", type: "number", required: false },
      { key: "water_saving_vs_local_l", type: "number", required: false },
      { key: "energy_saving_vs_local_kwh", type: "number", required: false },
      { key: "emissions_saving_vs_local_kgco2e", type: "number", required: false },
      status,
    ],
  },
  {
    key: "assumptions",
    label: "Assumption registry",
    sheetAliases: ["assumptions"],
    required: false,
    role: "Registered assumptions with confidence and treatment",
    futureSource: "Owned by Lindström sustainability team",
    fields: [
      { key: "assumption_id", type: "string", required: true },
      { key: "assumption", type: "string", required: true },
      { key: "value_or_rule", type: "string", required: false },
      { key: "rationale", type: "string", required: false },
      { key: "category", type: "string", required: false },
      { key: "confidence", type: "string", required: false },
      { key: "treatment", type: "string", required: false },
    ],
  },
  {
    key: "dataQuality",
    label: "Data quality flags",
    sheetAliases: ["data_quality"],
    required: false,
    role: "Dataset-level status and confidence",
    futureSource: "Data owner sign-off per source",
    fields: [
      { key: "dataset", type: "string", required: true },
      { key: "fields", type: "string", required: false },
      { key: "status", type: "string", required: false },
      { key: "confidence", type: "string", required: false },
      { key: "note", type: "string", required: false },
    ],
  },
  {
    key: "suggestedPrompts",
    label: "Suggested prompts",
    sheetAliases: ["suggested_prompts"],
    required: false,
    role: "Example KAM and customer questions",
    futureSource: "KAM playbook",
    fields: [
      { key: "user_type", type: "string", required: true },
      { key: "prompt", type: "string", required: true },
      { key: "expected_output", type: "string", required: false },
    ],
  },
  {
    key: "sampleOutput",
    label: "Worked reference output",
    sheetAliases: ["sample_output"],
    required: false,
    role: "Reference totals used to reconcile the calculation engine",
    futureSource: "Reference calculation",
    fields: [
      { key: "metric", type: "string", required: true },
      { key: "value", type: "string", required: false },
      { key: "unit", type: "string", required: false },
      { key: "status/interpretation", type: "string", required: false, aliases: ["status_interpretation", "interpretation"] },
    ],
  },
  {
    key: "dictionary",
    label: "Data dictionary",
    sheetAliases: ["data_dictionary"],
    required: false,
    role: "Field definitions",
    futureSource: "Data catalogue",
    fields: [
      { key: "sheet", type: "string", required: true },
      { key: "field", type: "string", required: true },
      { key: "definition", type: "string", required: false },
      { key: "join_role", type: "string", required: false },
      { key: "default_status", type: "string", required: false },
    ],
  },
  {
    key: "quickStart",
    label: "Quick start",
    sheetAliases: ["quick_start"],
    required: false,
    role: "Builder steps",
    futureSource: "-",
    fields: [
      { key: "step", type: "number", required: true },
      { key: "builder_action", type: "string", required: false },
      { key: "key_sheets", type: "string", required: false },
      { key: "output", type: "string", required: false },
    ],
  },
];

export function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%]/g, "_pct")
    .replace(/[^a-z0-9/]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function tableSpec(key: TableKey): TableSpec {
  const spec = TABLES.find((t) => t.key === key);
  if (!spec) throw new Error(`Unknown table ${key}`);
  return spec;
}
