import {
  Activity,
  Building2,
  CircleDollarSign,
  Clock3,
  Droplets,
  Factory,
  Gauge,
  Leaf,
  type LucideIcon,
  PackageOpen,
  Recycle,
  Scissors,
  Shirt,
  Timer,
  Users,
  WashingMachine,
  Wrench,
  Zap,
} from "lucide-react";
import type { AccountContextValue } from "@/lib/state/account-context";
import type { Avatar } from "@/lib/engine/avatars";
import type { MetricKey } from "@/lib/engine/provenance";
import { relevance, type PriorityKey } from "@/lib/engine/priorities";
import { fmtCompact, fmtEur, fmtNum, fmtPct } from "@/lib/engine/format";

export interface KpiValue {
  value: string;
  unit?: string;
  sub?: string;
  range?: { low: string; high: string };
}

export interface KpiDef {
  id: string;
  label: string;
  metric: MetricKey;
  tags: PriorityKey[];
  icon: LucideIcon;
  iconClass: string;
  /** Always-on brief requirements get a small boost so they stay visible. */
  core?: boolean;
  money?: boolean;
  compute: (a: AccountContextValue) => KpiValue;
}

export function co2Display(kg: number, avatar: Pick<Avatar, "units">): { value: string; unit: string } {
  if (avatar.units.co2 === "kg") return { value: fmtCompact(kg), unit: "kg CO₂e" };
  const t = kg / 1000;
  return { value: fmtNum(t, t < 10 ? 1 : 0), unit: "t CO₂e" };
}

export function waterDisplay(l: number, avatar: Pick<Avatar, "units">): { value: string; unit: string } {
  if (avatar.units.water === "L") return { value: fmtCompact(l), unit: "L" };
  return { value: fmtNum(l / 1000, l / 1000 < 100 ? 1 : 0), unit: "m³" };
}

const co2Str = (kg: number, av: Pick<Avatar, "units">) => {
  const d = co2Display(kg, av);
  return `${d.value} ${d.unit.split(" ")[0]}`;
};
const waterStr = (l: number, av: Pick<Avatar, "units">) => {
  const d = waterDisplay(l, av);
  return `${d.value} ${d.unit}`;
};

export const KPI_DEFS: KpiDef[] = [
  {
    id: "sites",
    label: "Delivery sites",
    metric: "sites",
    tags: ["service", "improvement"],
    icon: Building2,
    iconClass: "text-lind-orange",
    core: true,
    compute: (a) => ({ value: fmtNum(a.model.sites.length), sub: `${a.model.countries.length} countries · ${a.model.laundries.length} laundries` }),
  },
  {
    id: "wearers",
    label: "Active wearers",
    metric: "wearers",
    tags: ["service", "hygiene"],
    icon: Users,
    iconClass: "text-lind-blue",
    core: true,
    compute: (a) => ({
      value: fmtNum(a.model.activity.wearerAssignmentsLatest),
      unit: "assigned",
      sub: `${a.model.activity.lastMonth ? "Last month in period" : ""} · ≥ ${fmtCompact(a.model.activity.wearersLatest)} unique people`,
    }),
  },
  {
    id: "garments",
    label: "Garments in circulation",
    metric: "garments",
    tags: ["cost", "circularity"],
    icon: Shirt,
    iconClass: "text-lind-purple",
    core: true,
    compute: (a) => ({ value: fmtNum(a.model.activity.garmentsLatest), sub: `${fmtNum(a.model.activity.garmentsPerWearer, 1)} per unique wearer (upper bound)` }),
  },
  {
    id: "washedKg",
    label: "Washed volume",
    metric: "washedKg",
    tags: ["water", "emissions", "service"],
    icon: WashingMachine,
    iconClass: "text-lind-blue",
    core: true,
    compute: (a) => ({ value: fmtCompact(a.model.activity.washedKg), unit: "kg", sub: `${fmtCompact(a.model.activity.washedPieces)} pieces washed` }),
  },
  {
    id: "repairs",
    label: "Repairs completed",
    metric: "repairs",
    tags: ["circularity", "cost"],
    icon: Wrench,
    iconClass: "text-lind-purple",
    core: true,
    compute: (a) => ({
      value: fmtNum(a.model.repairs.repairs),
      sub: `${fmtNum(a.model.repairs.postponed.low)}–${fmtNum(a.model.repairs.postponed.high)} replacements postponed`,
    }),
  },
  {
    id: "requests",
    label: "Service requests",
    metric: "serviceRequests",
    tags: ["service"],
    icon: Activity,
    iconClass: "text-lind-blue",
    core: true,
    compute: (a) => ({
      value: fmtNum(a.model.activity.serviceRequests),
      sub: `${fmtNum(a.model.activity.requestsPer1000WearerMonths, 1)} per 1,000 wearer-months · ${fmtPct(a.model.activity.requestFreeSiteMonthShare)} site-months request-free`,
    }),
  },
  {
    id: "co2Saving",
    label: "CO₂e saved vs alternative",
    metric: "co2Saving",
    tags: ["emissions", "evidence"],
    icon: Leaf,
    iconClass: "text-lind-green",
    core: true,
    compute: (a) => {
      const s = a.model.impact.savings;
      const d = co2Display(s[a.settings.scenario].co2Kg, a.avatar);
      return { ...d, range: { low: co2Str(s.low.co2Kg, a.avatar), high: co2Str(s.high.co2Kg, a.avatar) } };
    },
  },
  {
    id: "waterSaving",
    label: "Water saved vs alternative",
    metric: "waterSaving",
    tags: ["water", "evidence"],
    icon: Droplets,
    iconClass: "text-lind-blue",
    core: true,
    compute: (a) => {
      const s = a.model.impact.savings;
      const d = waterDisplay(s[a.settings.scenario].waterL, a.avatar);
      return { ...d, range: { low: waterStr(s.low.waterL, a.avatar), high: waterStr(s.high.waterL, a.avatar) } };
    },
  },
  {
    id: "energySaving",
    label: "Energy saved vs alternative",
    metric: "energySaving",
    tags: ["emissions", "cost"],
    icon: Zap,
    iconClass: "text-lind-orange",
    compute: (a) => {
      const s = a.model.impact.savings;
      return {
        value: fmtCompact(s[a.settings.scenario].energyKwh),
        unit: "kWh",
        range: { low: `${fmtCompact(s.low.energyKwh)}`, high: `${fmtCompact(s.high.energyKwh)}` },
      };
    },
  },
  {
    id: "footprintCo2",
    label: "Allocated service footprint",
    metric: "footprintCo2",
    tags: ["emissions", "evidence"],
    icon: Factory,
    iconClass: "text-lind-grey",
    compute: (a) => {
      const d = co2Display(a.model.impact.footprint.co2Kg, a.avatar);
      return { ...d, sub: `${fmtNum(a.model.impact.intensity.co2KgPerKg, 3)} kg CO₂e per washed kg` };
    },
  },
  {
    id: "utilization",
    label: "Garments in active use",
    metric: "utilization",
    tags: ["cost", "circularity"],
    icon: Gauge,
    iconClass: "text-lind-orange",
    compute: (a) => ({ value: fmtPct(a.model.activity.utilization, 1), sub: `Healthy level ${fmtPct(a.assumptions.targetUtilization)} (P03)` }),
  },
  {
    id: "idle",
    label: "Idle garments",
    metric: "idleGarments",
    tags: ["cost", "circularity"],
    icon: PackageOpen,
    iconClass: "text-lind-orange",
    compute: (a) => ({ value: fmtNum(a.model.activity.idleLatest), sub: `${fmtNum(a.plan.transferredPieces + a.plan.returnedPieces)} could be moved or released` }),
  },
  {
    id: "washRhythm",
    label: "Wash rhythm",
    metric: "washRhythm",
    tags: ["hygiene"],
    icon: Timer,
    iconClass: "text-lind-red",
    compute: (a) => ({
      value: fmtNum(a.model.activity.washesPerGarmentMonth, 2),
      unit: "/ garment / month",
      sub: `${fmtPct(a.model.activity.washesPerGarmentMonth / a.assumptions.washTargetPerMonth)} of expected ${a.assumptions.washTargetPerMonth}/month (P02)`,
    }),
  },
  {
    id: "onTime",
    label: "On-time service cycles",
    metric: "onTime",
    tags: ["service"],
    icon: Clock3,
    iconClass: "text-lind-blue",
    compute: (a) => a.model.cycles.cycles ? ({ value: fmtPct(a.model.cycles.onTimeShare, 1), sub: `${fmtNum(a.model.cycles.avgHours, 0)} h average turnaround · uploaded RFID history` }) : ({ value: "-", sub: "No service cycles in the uploaded scope" }),
  },
  {
    id: "wasteDiverted",
    label: "Textile waste recycled / reused",
    metric: "wasteDiverted",
    tags: ["circularity", "evidence"],
    icon: Recycle,
    iconClass: "text-lind-green",
    compute: (a) => ({
      value: fmtCompact(a.model.impact.waste.divertedKg),
      unit: "kg",
      sub: `of ${fmtCompact(a.model.impact.waste.totalKg)} kg attributed textile waste`,
    }),
  },
  {
    id: "avoidedProduct",
    label: "Avoided via repairs",
    metric: "avoidedProductCo2",
    tags: ["circularity", "emissions"],
    icon: Scissors,
    iconClass: "text-lind-purple",
    compute: (a) => {
      const r = a.model.repairs.avoidedKgCo2e;
      const d = co2Display(r[a.settings.scenario], a.avatar);
      return { ...d, range: { low: co2Str(r.low, a.avatar), high: co2Str(r.high, a.avatar) } };
    },
  },
  {
    id: "eur",
    label: "Resource savings in money",
    metric: "eurSavings",
    tags: ["cost"],
    icon: CircleDollarSign,
    iconClass: "text-lind-orange",
    money: true,
    compute: (a) => {
      const e = a.model.impact.savingsEur;
      const v = (s: "low" | "base" | "high") => e[s].energy + e[s].water;
      return { value: fmtEur(v(a.settings.scenario)), sub: "Illustrative prices P04/P05", range: { low: fmtEur(v("low")), high: fmtEur(v("high")) } };
    },
  },
];

/** KPIs ordered for the current stakeholder lens (brief: personalise first-screen indicators). */
export function orderedKpis(a: AccountContextValue): KpiDef[] {
  return KPI_DEFS.filter((k) => !k.money || a.avatar.showMoney)
    .map((k, i) => ({ k, score: relevance(k.tags, a.weights) + (k.core ? 0.6 : 0) - i * 0.001 }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.k);
}
