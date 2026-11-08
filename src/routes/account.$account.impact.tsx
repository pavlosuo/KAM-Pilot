import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Droplets, Factory, Footprints, Hand, Leaf, LineChart, Recycle, Scale, Wrench, Zap } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { SectionCard } from "@/components/review/SectionCard";
import { Provenance } from "@/components/review/Provenance";
import { MonthlyChart } from "@/components/review/charts";
import { useTokenColors } from "@/lib/ui/use-token-colors";
import { co2Display, waterDisplay } from "@/lib/ui/kpis";
import { impactTotals, inScope } from "@/lib/engine/metrics";
import { SCENARIOS, type Scenario } from "@/lib/engine/assumptions";
import type { MetricKey } from "@/lib/engine/provenance";
import { fmtCompact, fmtEur, fmtNum, fmtPct } from "@/lib/engine/format";

export const Route = createFileRoute("/account/$account/impact")({
  head: () => ({
    meta: [
      { title: "Footprint & handprint - Lindström customer value review" },
      { name: "description", content: "Allocated service footprint, savings versus a selectable alternative with low–base–high ranges, waste routes and repairs." },
      { property: "og:title", content: "Footprint & handprint - Lindström customer value review" },
      { property: "og:description", content: "Allocated footprint, savings versus a selectable alternative, waste routes and repairs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImpactPage,
});

const SCEN_LABEL: Record<Scenario, string> = { low: "Low", base: "Base", high: "High" };

function ImpactPage() {
  const a = useAccount();
  const { model, dataset, avatar, settings } = a;
  const colors = useTokenColors();
  const imp = model.impact;
  const s = settings.scenario;

  const rows: Array<{ key: "waterL" | "energyKwh" | "co2Kg"; label: string; icon: typeof Droplets; tone: string; fmt: (v: number) => string; fp: MetricKey; sv: MetricKey }> = [
    {
      key: "waterL",
      label: "Water",
      icon: Droplets,
      tone: "text-lind-blue",
      fmt: (v) => {
        const d = waterDisplay(v, avatar);
        return `${d.value} ${d.unit}`;
      },
      fp: "footprintWater",
      sv: "waterSaving",
    },
    { key: "energyKwh", label: "Energy", icon: Zap, tone: "text-lind-orange", fmt: (v) => `${fmtCompact(v)} kWh`, fp: "footprintEnergy", sv: "energySaving" },
    {
      key: "co2Kg",
      label: "Emissions",
      icon: Leaf,
      tone: "text-lind-green",
      fmt: (v) => {
        const d = co2Display(v, avatar);
        return `${d.value} ${d.unit}`;
      },
      fp: "footprintCo2",
      sv: "co2Saving",
    },
  ];

  const baselineCompare = useMemo(() => {
    const scoped = inScope(dataset.impacts, model.scope);
    return dataset.baselines.map((b) => ({ b, t: impactTotals(scoped, dataset, b, a.assumptions) }));
  }, [dataset, model.scope, a.assumptions]);
  const maxCo2 = Math.max(1, ...baselineCompare.map((x) => x.t.savings.high.co2Kg));

  const chartData = model.monthly.map((m) => ({
    month: m.month,
    footprint: Math.round(m.footprintCo2Kg),
    saving: Math.round(m.co2SavingKg),
  }));

  const w = imp.waste;
  const routes = [
    { label: "Recycling", kg: w.recyclingKg, cls: "bg-lind-green" },
    { label: "Reuse", kg: w.reuseKg, cls: "bg-lind-blue" },
    { label: "Energy recovery", kg: w.energyRecoveryKg, cls: "bg-lind-orange" },
    { label: "Incineration", kg: w.incinerationKg, cls: "bg-lind-grey" },
  ];
  const eur = imp.savingsEur;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Footprint & handprint</h1>
        
      </div>

      <div id="savings" data-deep-link="" className="grid gap-4 lg:grid-cols-3">
        {rows.map((r, i) => {
          const Icon = r.icon;
          const fp = imp.footprint[r.key];
          const alt = imp.alternative[s][r.key];
          const sv = imp.savings;
          const share = alt ? fp / alt : 0;
          return (
            <section key={r.key} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-5 w-5", r.tone)} />
                <h2 className="text-sm font-semibold uppercase tracking-wider">{r.label}</h2>
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Saved vs alternative · {SCEN_LABEL[s].toLowerCase()} <Provenance metric={r.sv} compact className="ml-1" />
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{r.fmt(sv[s][r.key])}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                {SCENARIOS.map((sc) => (
                  <span key={sc} className={cn("rounded-md px-1.5 py-0.5 tabular-nums", sc === s ? "bg-primary/10 font-semibold text-primary" : "bg-muted")}>
                    {SCEN_LABEL[sc]} {r.fmt(sv[sc][r.key])}
                  </span>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Footprints className="h-3 w-3" /> Lindström footprint <Provenance metric={r.fp} compact />
                    </span>
                    <span className="font-semibold tabular-nums">{r.fmt(fp)}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", i === 0 ? "bg-lind-blue" : i === 1 ? "bg-lind-orange" : "bg-lind-green")} style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Hand className="h-3 w-3" /> {model.baseline.name}
                    </span>
                    <span className="font-semibold tabular-nums">{r.fmt(alt)}</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-muted-foreground/30" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                The service uses {fmtPct(share)} of what the alternative would - {fmtPct(1 - share)} less.
              </p>
            </section>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard id="emissions" icon={LineChart} title="Emissions by month" tone="emerald" subtitle="Allocated footprint and base-case saving">
          <MonthlyChart
            data={chartData}
            colors={colors}
            series={[
              { key: "footprint", label: "Allocated footprint", color: colors.evidence, kind: "bar", format: (v) => `${fmtCompact(v)} kg` },
              { key: "saving", label: "Saving vs alternative", color: colors.emissions, kind: "line", format: (v) => `${fmtCompact(v)} kg` },
            ]}
          />
        </SectionCard>

        <SectionCard id="alternatives" icon={Scale} title="Compared with each alternative" tone="blue" subtitle="Emission saving range per baseline">
          <ul className="space-y-4">
            {baselineCompare.map(({ b, t }) => {
              const lo = t.savings.low.co2Kg;
              const hi = t.savings.high.co2Kg;
              const base = t.savings.base.co2Kg;
              const active = b.id === model.baseline.id;
              return (
                <li key={b.id}>
                  <button type="button" className="w-full cursor-pointer text-left" onClick={() => a.update({ baselineId: b.id })}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className={cn("font-medium", active && "text-primary")}>
                        {b.name}
                        {active ? " · selected" : ""}
                      </span>
                      <span className="font-semibold tabular-nums">{co2Display(base, avatar).value} {co2Display(base, avatar).unit}</span>
                    </div>
                    <div className="relative mt-2 h-3 rounded-full bg-muted">
                      <div
                        className={cn("absolute inset-y-0 rounded-full", active ? "bg-primary/40" : "bg-muted-foreground/25")}
                        style={{ left: `${(Math.max(0, lo) / maxCo2) * 100}%`, width: `${(Math.max(0, hi - Math.max(0, lo)) / maxCo2) * 100}%` }}
                      />
                      <div
                        className={cn("absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full", active ? "bg-primary" : "bg-muted-foreground")}
                        style={{ left: `${(Math.max(0, base) / maxCo2) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{b.note}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard id="repairs" icon={Wrench} title="Repairs & product life" tone="violet" subtitle="Assumption A002: one repair postpones up to one replacement">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Repairs" value={fmtNum(model.repairs.repairs)} metric="repairs" />
            <Stat label="Replacements postponed" value={`${fmtNum(model.repairs.postponed.low)}–${fmtNum(model.repairs.postponed.high)}`} metric="postponed" />
            <Stat
              label="Product CO₂e avoided"
              value={`${co2Display(model.repairs.avoidedKgCo2e.low, avatar).value}–${co2Display(model.repairs.avoidedKgCo2e.high, avatar).value}`}
              unit={co2Display(model.repairs.avoidedKgCo2e.high, avatar).unit}
              metric="avoidedProductCo2"
            />
          </div>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repair types</h3>
          <ul className="mt-2 space-y-2">
            {model.repairs.byType.slice(0, 6).map((t) => (
              <li key={t.type} className="text-sm">
                <div className="flex justify-between">
                  <span>{t.type}</span>
                  <span className="tabular-nums text-muted-foreground">{fmtNum(t.count)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-lind-purple" style={{ width: `${(t.count / Math.max(1, model.repairs.byType[0].count)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard id="waste" icon={Recycle} title="Textile waste routes" tone="emerald" subtitle="Laundry waste allocated by washed kg (A003)">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{fmtCompact(w.totalKg)}</span>
            <span className="text-sm text-muted-foreground">kg attributed</span>
            <Provenance metric="wasteAttributed" compact />
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-muted">
            {routes.map((r) => (
              <div key={r.label} className={r.cls} style={{ width: `${w.totalKg ? (r.kg / w.totalKg) * 100 : 0}%` }} title={`${r.label}: ${fmtCompact(r.kg)} kg`} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {routes.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-sm">
                <span className={cn("h-2.5 w-2.5 rounded-full", r.cls)} />
                <span className="flex-1">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{w.totalKg ? fmtPct(r.kg / w.totalKg) : "-"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-lind-green/10 p-3 text-xs text-lind-green dark:text-lind-green">
            {fmtCompact(w.divertedKg)} kg went to recycling or reuse. In the alternative scenario (A004), textile waste goes to mixed waste - a
            handprint of {fmtCompact(w.handprintDivertedKg)} kg diverted from mixed waste.
          </p>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard id="intensity" icon={Factory} title="Intensity per washed kg" tone="sky" subtitle="Customer-allocated averages vs selected alternative">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-semibold">Per kg</th>
                <th className="py-2 text-right font-semibold">Lindström</th>
                <th className="py-2 text-right font-semibold">{model.baseline.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="py-2.5">Water (L)</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(imp.intensity.waterLPerKg, 2)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(model.baseline.waterLPerKg, 2)}</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2.5">Energy (kWh)</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(imp.intensity.energyKwhPerKg, 3)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(model.baseline.energyKwhPerKg, 3)}</td>
              </tr>
              <tr>
                <td className="py-2.5">CO₂e (kg)</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(imp.intensity.co2KgPerKg, 3)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(model.baseline.processKgCo2ePerKg + model.baseline.deliveryKgCo2ePerKg, 3)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Footprint split: process {co2Display(imp.footprint.processCo2Kg, avatar).value} and delivery {co2Display(imp.footprint.deliveryCo2Kg, avatar).value}{" "}
            {co2Display(imp.footprint.deliveryCo2Kg, avatar).unit}.
          </p>
        </SectionCard>

        {avatar.showMoney ? (
          <SectionCard id="money" icon={Scale} title="In money (illustrative)" tone="amber" subtitle="Resource savings valued at assumptions P04 and P05" action={<Provenance metric="eurSavings" compact />}>
            <div className="grid grid-cols-3 gap-3">
              {SCENARIOS.map((sc) => (
                <div key={sc} className={cn("rounded-xl border p-3", sc === s ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background")}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{SCEN_LABEL[sc]}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{fmtEur(eur[sc].energy + eur[sc].water)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    energy {fmtEur(eur[sc].energy)} · water {fmtEur(eur[sc].water)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Avoided garment purchases through repairs: {fmtEur(model.repairs.avoidedPurchaseEur.low)}–{fmtEur(model.repairs.avoidedPurchaseEur.high)} at
              uploaded purchase costs. Confirm tariffs and prices with the customer before quoting.
            </p>
          </SectionCard>
        ) : (
          <SectionCard icon={Scale} title="How to read the range" tone="amber">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Low</span> - alternative factors {fmtPct(a.assumptions.baselineBand)} lower, half the repair effect. The
                conservative number to quote.
              </li>
              <li>
                <span className="font-medium text-foreground">Base</span> - the data pack's factors for {model.baseline.name.toLowerCase()}.
              </li>
              <li>
                <span className="font-medium text-foreground">High</span> - alternative factors {fmtPct(a.assumptions.baselineBand)} higher.
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Edit the band and every other assumption in the Trust center.</p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, metric }: { label: string; value: string; unit?: string; metric: MetricKey }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} <Provenance metric={metric} compact />
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {unit && <p className="text-[11px] text-muted-foreground">{unit}</p>}
    </div>
  );
}
