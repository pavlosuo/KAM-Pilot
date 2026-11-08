import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Flag, Map as MapIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/export/colors";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { SectionCard } from "@/components/review/SectionCard";
import { Segmented } from "@/components/review/Segmented";
import { SiteMap, type MapColorBy } from "@/components/review/SiteMap";
import { StatusPill } from "@/components/review/StatusPill";
import { siteAttentionTag } from "@/lib/ui/contextual-tags";
import { Provenance } from "@/components/review/Provenance";
import { useTokenColors } from "@/lib/ui/use-token-colors";
import { shortSiteName } from "@/lib/ui/names";
import type { HealthStatus, SiteSummary } from "@/lib/engine/metrics";
import type { MetricKey } from "@/lib/engine/provenance";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/engine/format";

type SortKey = "health" | "name" | "wearers" | "garments" | "utilization" | "wash" | "requests" | "late" | "dormant" | "co2";

const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined => (options.includes(v as T) ? (v as T) : undefined);
const SORTS_FROM_LINK = ["requests", "late", "dormant", "wash", "utilization", "co2"] as const;

/** Map colouring, status filter and sort can be preset by links (for example from the Recap). */
export interface SitesSearch {
  color?: MapColorBy;
  status?: HealthStatus;
  sort?: (typeof SORTS_FROM_LINK)[number];
}

export const Route = createFileRoute("/account/$account/sites/")({
  validateSearch: (s: Record<string, unknown>): SitesSearch => ({
    color: oneOf(s.color, ["status", "utilization", "washRhythm", "co2"] as const),
    status: oneOf(s.status, ["act", "watch", "on-track"] as const),
    sort: oneOf(s.sort, SORTS_FROM_LINK),
  }),
  head: () => ({
    meta: [
      { title: "Sites - Lindström customer value review" },
      { name: "description", content: "Map and side-by-side comparison of every delivery site in the account." },
      { property: "og:title", content: "Sites - Lindström customer value review" },
      { property: "og:description", content: "Map and side-by-side comparison of every delivery site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitesPage,
});

const COLUMNS: Array<{ key: SortKey; label: string; metric?: MetricKey; align?: "right"; get: (s: SiteSummary) => number | string }> = [
  { key: "name", label: "Site", get: (s) => s.site.name },
  { key: "wearers", label: "Wearer assignments", metric: "wearers", align: "right", get: (s) => s.activity.wearerAssignmentsLatest },
  { key: "garments", label: "Garments", metric: "garments", align: "right", get: (s) => s.activity.garmentsLatest },
  { key: "utilization", label: "In use", metric: "utilization", align: "right", get: (s) => s.activity.utilization },
  { key: "wash", label: "Washes / mo", metric: "washRhythm", align: "right", get: (s) => s.activity.washesPerGarmentMonth },
  { key: "requests", label: "Req. / 1k", metric: "serviceRequests", align: "right", get: (s) => s.activity.requestsPer1000WearerMonths },
  { key: "late", label: "Late", metric: "onTime", align: "right", get: (s) => (s.cycles.cycles ? s.cycles.late / s.cycles.cycles : 0) },
  { key: "dormant", label: "Dormant", metric: "dormant", align: "right", get: (s) => s.dormancy.dormantShare },
  { key: "co2", label: "CO₂e saved", metric: "co2Saving", align: "right", get: (s) => s.impact.co2SavingKg },
  { key: "health", label: "Status", get: (s) => s.health },
];

function SitesPage() {
  const a = useAccount();
  const { model, slug } = a;
  const colors = useTokenColors();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [colorBy, setColorBy] = useState<MapColorBy>(search.color ?? "status");
  const [status, setStatus] = useState<"all" | HealthStatus>(search.status ?? "all");
  const [query, setQuery] = useState("");
  // Problem-first: lowest use and wash rhythm, most requests, late, missing garments and CO₂ first.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(() =>
    search.sort ? { key: search.sort, dir: search.sort === "wash" || search.sort === "utilization" ? 1 : -1 } : { key: "health", dir: 1 },
  );

  const counts = useMemo(() => {
    const c = { act: 0, watch: 0, "on-track": 0 } as Record<HealthStatus, number>;
    for (const s of model.sites) c[s.status]++;
    return c;
  }, [model.sites]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0];
    return model.sites
      .filter((s) => status === "all" || s.status === status)
      .filter((s) => !q || `${s.site.name} ${s.site.city} ${s.site.country} ${s.site.siteType}`.toLowerCase().includes(q))
      .sort((x, y) => {
        const vx = col.get(x);
        const vy = col.get(y);
        const d = typeof vx === "string" ? vx.localeCompare(String(vy)) : vx - (vy as number);
        return d * sort.dir;
      });
  }, [model.sites, status, query, sort]);

  const open = (id: string) => void navigate({ to: "/account/$account/sites/$siteId", params: { account: slug, siteId: id } });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <SectionCard
          id="map"
          icon={MapIcon}
          title="Delivery sites"
          tone="orange"
          subtitle="Bubble size: wearers (or CO₂e saved). Click a site to open it."
          action={
            <Segmented
              label="Colour sites by"
              value={colorBy}
              onChange={setColorBy}
              options={[
                { value: "status", label: "Status" },
                { value: "utilization", label: "Use" },
                { value: "washRhythm", label: "Wash" },
                { value: "co2", label: "CO₂e" },
              ]}
            />
          }
        >
          <SiteMap sites={model.sites} colors={colors} colorBy={colorBy} onSelect={open} washTarget={a.assumptions.washTargetPerMonth} />
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {colorBy === "co2" ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-lind-green" /> Larger bubble = more CO₂e saved vs {model.baseline.name.toLowerCase()}
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-lind-green" /> {colorBy === "status" ? "On track" : "At or near target"}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-lind-orange" /> Watch closely
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> {colorBy === "status" ? "Act now" : "Well below target"}
                </span>
              </>
            )}
            <span className="ml-auto">Locations approximate (city centre)</span>
          </div>
        </SectionCard>

        <section id="compare" data-deep-link="" className="rounded-2xl border border-border/60 bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <h2 className="text-base font-semibold">Compare sites</h2>
          <Button variant="outline" size="sm" onClick={() => {
            const quote = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
            const csv = [
              ["Uploaded customer data; calculated savings are estimates", a.baseline.name, a.settings.scenario],
              ["Site", "Country", "Wearer-product assignments", "Garments", "Utilization", "Washes per month", "Service requests per 1000 wearer-months", "CO2e savings kg", "Status"],
              ...rows.map(s => [s.site.name, s.site.country, s.activity.wearerAssignmentsLatest, s.activity.garmentsLatest, s.activity.utilization, s.activity.washesPerGarmentMonth, s.activity.requestsPer1000WearerMonths, s.impact.co2SavingKg, s.status]),
            ].map(row => row.map(quote).join(",")).join("\r\n");
            downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), `${slug}-sites.csv`);
          }}><Download /> Export sites</Button>
          <Segmented
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: model.sites.length },
              { value: "act", label: "Act now", count: counts.act },
              { value: "watch", label: "Watch closely", count: counts.watch },
              { value: "on-track", label: "On track", count: counts["on-track"] },
            ]}
          />
          <div className="relative ml-auto w-full sm:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sites, cities, types" className="pl-8" aria-label="Search sites" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={cn("px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", c.align === "right" && "text-right")}>
                    <span className={cn("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}>
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                        onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.key === "name" || c.key === "health" ? 1 : -1 }))}
                      >
                        {c.label}
                        {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                      {c.metric && <Provenance metric={c.metric} compact />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.site.id} onClick={() => open(s.site.id)} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <Link
                      to="/account/$account/sites/$siteId"
                      params={{ account: slug, siteId: s.site.id }}
                      className="font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {shortSiteName(s.site)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.site.siteType} · {s.site.country}
                      {s.dataFlags.length > 0 && <Flag className="ml-1 inline h-3 w-3 text-lind-orange" aria-label="Laundry data flagged" />}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(s.activity.wearerAssignmentsLatest)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(s.activity.garmentsLatest)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <Bar value={s.activity.utilization} target={a.assumptions.targetUtilization} label={fmtPct(s.activity.utilization, 1)} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <Bar value={s.activity.washesPerGarmentMonth / a.assumptions.washTargetPerMonth} target={0.75} label={fmtNum(s.activity.washesPerGarmentMonth, 2)} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(s.activity.requestsPer1000WearerMonths, 1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.cycles.cycles ? fmtPct(s.cycles.late / s.cycles.cycles, 1) : "-"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.dormancy.trackedAssets ? fmtPct(s.dormancy.dormantShare) : "-"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtCompact(s.impact.co2SavingKg)} kg</td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={s.status} label={siteAttentionTag(s)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No sites match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Status blends each site's rank among the customer's own sites on five signals, weighted by the current emphasis. Late and dormant come from
          the RFID cycle sample.
        </p>
      </section>
      </div>
    </div>
  );
}

function Bar({ value, target, label }: { value: number; target: number; label: string }) {
  const tone = value >= target ? "bg-lind-green" : value >= target * 0.85 ? "bg-lind-orange" : "bg-destructive";
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:inline-block">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.min(100, value * 100)}%` }} />
      </span>
      {label}
    </span>
  );
}
