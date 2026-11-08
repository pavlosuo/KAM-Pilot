/**
 * Prototype assumptions layered on top of the supplied registry (A001–A008).
 * Every value is editable in the Trust center and every figure that uses one
 * cites its id, so the steering-committee audience can see what drives it.
 */

export type Scenario = "low" | "base" | "high";
export const SCENARIOS: Scenario[] = ["low", "base", "high"];

export interface AssumptionValues {
  /** A002 - postponed replacements per completed repair. */
  repairFactor: Record<Scenario, number>;
  /** P01 - ± band applied to the alternative's per-kg factors for low/high. */
  baselineBand: number;
  /** A004 - share of textile waste going to mixed waste in the alternative. */
  mixedWasteShare: number;
  /** P02 - expected washes per garment per month (wash rhythm). */
  washTargetPerMonth: number;
  /** P03 - RFID-active share of allocated garments considered healthy. */
  targetUtilization: number;
  /** P04 - electricity price used to value energy differences. */
  electricityEurPerKwh: number;
  /** P05 - water + wastewater price used to value water differences. */
  waterEurPerM3: number;
  /** P06 - an RFID-tracked garment unseen for this many days counts as dormant. */
  dormantDays: number;
}

export const DEFAULT_ASSUMPTIONS: AssumptionValues = {
  repairFactor: { low: 0.5, base: 1, high: 1 },
  baselineBand: 0.15,
  mixedWasteShare: 1,
  washTargetPerMonth: 4,
  targetUtilization: 0.9,
  electricityEurPerKwh: 0.12,
  waterEurPerM3: 4,
  dormantDays: 180,
};

export interface PrototypeAssumption {
  id: string;
  label: string;
  key: keyof AssumptionValues;
  unit: string;
  rationale: string;
  confidence: "Low" | "Low-Medium" | "Medium" | "High";
  source: string;
}

export const PROTOTYPE_ASSUMPTIONS: PrototypeAssumption[] = [
  {
    id: "A002",
    label: "Replacements postponed per repair",
    key: "repairFactor",
    unit: "low / base / high",
    rationale:
      "Pack rule A002 (1 repair = 1 postponed replacement) is used as Base and capped as High; Low halves it to reflect repairs on garments that would not have been replaced.",
    confidence: "Low-Medium",
    source: "Data pack A002 + prototype sensitivity",
  },
  {
    id: "P01",
    label: "Baseline sensitivity band",
    key: "baselineBand",
    unit: "± share of alternative factors",
    rationale:
      "The pack gives one value per alternative. Low/high scenarios scale the alternative's water, energy and emission factors down/up by this share. Low is the conservative headline.",
    confidence: "Medium",
    source: "Prototype assumption",
  },
  {
    id: "A004",
    label: "Alternative sends textile waste to mixed waste",
    key: "mixedWasteShare",
    unit: "share",
    rationale: "Illustrative linear scenario from the pack; lower it where the customer already sorts textiles.",
    confidence: "Low-Medium",
    source: "Data pack A004",
  },
  {
    id: "P02",
    label: "Expected wash rhythm",
    key: "washTargetPerMonth",
    unit: "washes / garment / month",
    rationale:
      "Organizer example: a work jacket should be washed about four times a month; one wash means 25% of the expected rhythm. Set per contract and product.",
    confidence: "Low",
    source: "Lindström challenge briefing (6 Nov)",
  },
  {
    id: "P03",
    label: "Healthy garment utilization",
    key: "targetUtilization",
    unit: "RFID-active / allocated",
    rationale: "Allocated garments not seen in circulation are idle stock; a buffer of ~10% covers sizes, absences and rotation.",
    confidence: "Medium",
    source: "Prototype assumption",
  },
  {
    id: "P04",
    label: "Electricity price",
    key: "electricityEurPerKwh",
    unit: "€ / kWh",
    rationale: "Used only to express energy differences in money. Replace with the customer's tariff.",
    confidence: "Low",
    source: "Illustrative",
  },
  {
    id: "P05",
    label: "Water + wastewater price",
    key: "waterEurPerM3",
    unit: "€ / m³",
    rationale: "Used only to express water differences in money. Replace with the local utility rate.",
    confidence: "Low",
    source: "Illustrative",
  },
  {
    id: "P06",
    label: "Dormant garment threshold",
    key: "dormantDays",
    unit: "days without an RFID pickup",
    rationale:
      "Tracked garments not collected for this long are likely unused, lost or kept by leavers. Half a year is used because the synthetic cycle file is a sparse sample; with a full RFID scan export a 90-day threshold is more useful.",
    confidence: "Medium",
    source: "Prototype assumption",
  },
];
