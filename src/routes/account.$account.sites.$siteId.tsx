import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Building2, Flag, Lightbulb, LineChart, Package, ScanLine, Signal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { SectionCard } from "@/components/review/SectionCard";
import { StatusPill } from "@/components/review/StatusPill";
import { siteAttentionTag } from "@/lib/ui/contextual-tags";
import { KpiTile } from "@/components/review/KpiTile";
import { MonthlyChart } from "@/components/review/charts";
import { GarmentPassportList } from "@/components/review/GarmentPassport";
import { ObservationCard } from "@/components/review/ObservationCard";
import { useTokenColors } from "@/lib/ui/use-token-colors";
import { co2Display, waterDisplay } from "@/lib/ui/kpis";
import { shortSiteName } from "@/lib/ui/names";
import { computeReview, endOfMonth, SIGNAL_META } from "@/lib/engine/metrics";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/engine/format";

export const Route = createFileRoute("/account/$account/sites/$siteId")({
  head: () => ({
    meta: [
      { title: "Site detail - Lindström customer value review" },
      { name: "description", content: "One delivery site: service signals against sister sites, monthly trend, products and garment passports." },
      { property: "og:title", content: "Site detail - Lindström customer value review" },
      { property: "og:description", content: "Service signals, monthly trend, products and garment passports for one site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitePage,
});

function quantile(values: number[], q: number) {
  const v = [...values].sort((x, y) => x - y);
  if (!v.length) return 0;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

function SitePage() {
  const { siteId } = Route.useParams();
  const a = useAccount();
  const { model, dataset, months, slug, avatar } = a;
  const colors = useTokenColors();
  const summary = model.sites.find((s) => s.site.id === siteId);
  const site = summary?.site ?? a.customerSites.find((s) => s.id === siteId);

  const detail = useMemo(
    () =>
      site
        ? computeReview(dataset, { customerId: a.customer.id, months, siteIds: [site.id] }, a.baseline.id, a.assumptions, a.weights)
        : null,
    [dataset, a.customer.id, months, site, a.baseline.id, a.assumptions, a.weights],
  );

  if (!site) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Site not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>This site is not part of {a.customer.name}.</p>
          <Button variant="outline" asChild>
            <Link to="/account/$account/sites" params={{ account: slug }}>
              Back to sites
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary || !detail) {
    return (
      <div className="space-y-4">
        <BackLink slug={slug} />
        <Card>
          <CardHeader>
            <CardTitle>{site.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This site is outside the current country filter. Clear the filter in the bar above to include it.
          </CardContent>
        </Card>
      </div>
    );
  }

  const siteObs = a.observations.filter((o) => o.siteIds.includes(site.id));
  const products = new Map(dataset.products.map((p) => [p.id, p]));
  const assets = dataset.assets.filter((x) => x.siteId === site.id && x.customerId === a.customer.id);
  const periodEnd = endOfMonth(months[months.length - 1]);
  const co2 = co2Display(detail.impact.savings[a.settings.scenario].co2Kg, avatar);
  const water = waterDisplay(detail.impact.savings[a.settings.scenario].waterL, avatar);

  const chartData = detail.monthly.map((m) => ({
    month: m.month,
    washedKg: Math.round(m.washedKg),
    utilization: Number((m.utilization * 100).toFixed(1)),
    washes: Number(m.washesPerGarment.toFixed(2)),
    requests: m.serviceRequests,
  }));

  return (
    <div className="space-y-6">
      <BackLink slug={slug} />

      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-lind-orange/10 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lind-orange/10 text-lind-orange ring-1 ring-lind-orange/20">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{shortSiteName(site)}</h1>
              
            </div>
          </div>
          <StatusPill status={summary.status} label={siteAttentionTag(summary)} className="text-xs" />
        </div>
        {summary.dataFlags.length > 0 && (
          <p className="relative mt-4 flex items-start gap-2 rounded-xl bg-lind-orange/10 p-3 text-xs text-lind-orange dark:text-lind-orange">
            <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {summary.laundryName} reported less washed kg than the volumes assigned to its customers. This site's figures are still reliable -
            double-check the laundry's totals before sharing them externally.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile index={0} label="Active wearers" value={fmtNum(detail.activity.wearerAssignmentsLatest)} unit="assigned" metric="wearers" />
        <KpiTile index={1} label="Garments" value={fmtNum(detail.activity.garmentsLatest)} metric="garments" sub={`${fmtPct(detail.activity.utilization, 1)} in active use`} />
        <KpiTile index={2} label="CO₂e saved" value={co2.value} unit={co2.unit} metric="co2Saving" sub={`vs ${a.baseline.name.toLowerCase()}`} />
        <KpiTile index={3} label="Water saved" value={water.value} unit={water.unit} metric="waterSaving" sub={`${fmtNum(detail.repairs.repairs)} repairs in period`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <SectionCard icon={Signal} title="Signals vs sister sites" tone="blue" subtitle={`Ranked among ${model.sites.length} sites of ${a.customer.name}`}>
          <ul className="space-y-4">
            {summary.signals.map((sg) => {
              const meta = SIGNAL_META[sg.key];
              const all = model.sites.map((s) => s.signals.find((x) => x.key === sg.key)!.value);
              const median = quantile(all, 0.5);
              const best = quantile(all, meta.higherIsBetter ? 0.75 : 0.25);
              const fmt = (v: number) => (meta.unit === "pct" ? fmtPct(v, 1) : fmtNum(v, 2));
              const tone = sg.percentile >= 0.5 ? "bg-lind-green" : sg.percentile >= 0.25 ? "bg-lind-orange" : "bg-destructive";
              return (
                <li key={sg.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{meta.label}</span>
                    <span className="font-semibold tabular-nums">{fmt(sg.value)}</span>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                    <div className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(4, sg.percentile * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Better than {fmtPct(sg.percentile)} of sites · median {fmt(median)} · best quartile {fmt(best)}
                  </p>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard icon={LineChart} title="Monthly trend" tone="sky" subtitle="Washed volume and share of garments in active use">
          <MonthlyChart
            data={chartData}
            colors={colors}
            series={[
              { key: "washedKg", label: "Washed kg", color: colors.water, kind: "bar", format: (v) => `${fmtCompact(v)} kg` },
              { key: "utilization", label: "In active use", color: colors.cost, kind: "line", axis: "right", format: (v) => `${v}%` },
            ]}
            rightFormat={(v) => `${v}%`}
          />
        </SectionCard>
      </div>

      <SectionCard icon={Package} title="Products at this site" tone="violet">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Product</th>
                <th className="px-3 py-2 text-right font-semibold">Garments</th>
                <th className="px-3 py-2 text-right font-semibold">In use</th>
                <th className="px-3 py-2 text-right font-semibold">Washes / mo</th>
                <th className="px-3 py-2 text-right font-semibold">Repairs</th>
                <th className="px-3 py-2 text-right font-semibold">Repair rate</th>
              </tr>
            </thead>
            <tbody>
              {detail.products.map((p) => (
                <tr key={p.product.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">{p.product.name}</p>
                    <p className="text-xs text-muted-foreground">{products.get(p.product.id)?.group}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(p.garmentsLatest)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(p.utilization, 1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(p.washesPerGarmentMonth, 2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(p.repairs)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtPct(p.repairQuotient, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={ScanLine}
          title="Garment passports"
          tone="rose"
          subtitle={`${fmtNum(assets.length)} RFID-tracked garments in the cycle sample`}
        >
          <GarmentPassportList ds={dataset} assets={assets} periodEnd={periodEnd} dormantDays={a.assumptions.dormantDays} />
        </SectionCard>

        <SectionCard icon={Lightbulb} title="Insights for this site" tone="amber" count={siteObs.length}>
          {siteObs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No site-specific observations - this site is in line with its sister sites for the current emphasis.</p>
          ) : (
            <div className="space-y-3">
              {siteObs.map((o) => (
                <ObservationCard key={o.id} observation={o} compact />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function BackLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/account/$account/sites"
      params={{ account: slug }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> All sites
    </Link>
  );
}
