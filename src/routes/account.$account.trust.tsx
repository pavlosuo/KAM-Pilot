import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Database,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  RotateCcw,
  ScrollText,
  SlidersHorizontal,
  Tags,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { useDataset } from "@/lib/state/dataset-store";
import { usePreferences } from "@/lib/state/preferences-store";
import { SectionCard } from "@/components/review/SectionCard";
import { ProvenanceBadge } from "@/components/review/Provenance";
import { ACCEPTED_UPLOAD, useWorkbookUpload } from "@/components/data/useWorkbookUpload";
import { TABLES } from "@/lib/data/schema";
import { DEFAULT_ASSUMPTIONS, PROTOTYPE_ASSUMPTIONS, SCENARIOS, type AssumptionValues } from "@/lib/engine/assumptions";
import { PROVENANCE_CLASS_META, type ProvenanceClass } from "@/lib/engine/provenance";
import { fmtNum } from "@/lib/engine/format";
import { downloadBlob } from "@/lib/export/colors";

export const Route = createFileRoute("/account/$account/trust")({
  head: () => ({
    meta: [
      { title: "Trust center - Lindström customer value review" },
      { name: "description", content: "Data source, import report, reconciliation against the worked reference, editable assumptions and data readiness." },
      { property: "og:title", content: "Trust center - Lindström customer value review" },
      { property: "og:description", content: "Import report, reconciliation, editable assumptions and data readiness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  const a = useAccount();
  const { report: activeReport, dataset } = useDataset();
  const prefs = usePreferences();
  const { upload, busy, lastReport } = useWorkbookUpload();
  const report = lastReport ?? activeReport;
  const fileRef = useRef<HTMLInputElement>(null);
  const as = prefs.assumptions;
  const changed = JSON.stringify(as) !== JSON.stringify(DEFAULT_ASSUMPTIONS);

  const setA = (patch: Partial<AssumptionValues>) => prefs.setAssumptions({ ...as, ...patch });
  const checks = report?.reconciliation ?? [];
  const issues = report?.issues ?? [];
  const READINESS = [
    { item: "Customer & site hierarchy", now: `${a.dataset.customers.length} customers · ${a.dataset.sites.length} sites`, needed: "Confirm hierarchy and delivery addresses", state: "partial" },
    { item: "Service activity", now: `${a.dataset.activity.length} uploaded rows`, needed: "Confirm reporting coverage", state: "partial" },
    { item: "RFID garment cycles", now: `${a.dataset.assets.length} tracked garments · ${a.dataset.cycles.length} aggregate rows`, needed: "Confirm scan coverage before inferring wash rhythm or dormancy", state: a.dataset.cycles.length ? "partial" : "missing" },
    { item: "Laundry water & energy", now: `${a.dataset.laundryMonths.length} uploaded laundry-months`, needed: "Validate metered resource values", state: a.dataset.laundryMonths.length ? "partial" : "missing" },
    { item: "Emission factors", now: `${a.dataset.baselines.length} uploaded baselines`, needed: "Approved factors and method owner", state: "partial" },
    { item: "Product footprints", now: `${a.dataset.products.length} uploaded products`, needed: "Validate product LCA and footprint sources", state: "partial" },
    { item: "Wash-rhythm targets", now: "Editable assumption P02", needed: "Confirm product and contract targets", state: "partial" },
    { item: "Prices for money values", now: "Illustrative tariffs P04 and P05", needed: "Replace with customer tariffs and contract prices", state: "partial" },
  ];
  const passCount = checks.filter((c) => c.status === "pass").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trust center</h1>
        
        <Button variant="outline" onClick={() => downloadBlob(new Blob([
          `Lindström customer value review - methodology and readiness\n${a.customer.name}\n\nFigures come from the uploaded file. Estimates, allocations and assumptions are labelled; verify source quality before external use.\n\nService footprint: washed kg × laundry process factors, plus allocated delivery emissions.\nHandprint: alternative footprint minus allocated service footprint. Repair avoidance is separate and assumption-dependent.\nRFID history is a sparse sample and does not establish definitive wash frequency or dormancy.\n\nBaseline: ${a.baseline.name}\nMonths: ${a.months.join(", ")}\n\nAssumptions:\n${JSON.stringify(as, null, 2)}\n\nReporting readiness (source review, not audit certification):\n${READINESS.map(r => `${r.item}: ${r.state}. Needed: ${r.needed}`).join("\n")}\n\nImport issues:\n${issues.map(i => `${i.severity}: ${i.message}`).join("\n")}\n\nSource: ${dataset?.meta.sourceName}`,
        ], { type: "text/plain;charset=utf-8" }), `${a.slug}-methodology-and-readiness.txt`)}>
          <ScrollText /> Download methodology
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard icon={Database} title="Data source" tone="sky" subtitle="Uploaded file (stored in this browser)">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-lind-green" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{dataset?.meta.sourceName}</p>
              <p className="text-xs text-muted-foreground">
                {dataset?.customers.length} customers · {fmtNum(dataset?.sites.length ?? 0)} sites · {fmtNum(dataset?.activity.length ?? 0)} activity rows ·{" "}
                {fmtNum(dataset?.assets.length ?? 0)} tracked garments
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_UPLOAD}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Excel or PDF
            </Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Files are read in this browser and never sent to a server. Column names are matched with aliases (for example “Delivery Customer” →
            site, “Kg” → washed kg). Each upload stands alone; omitted sheets are not filled from previous data. Unknown keys block activation; rejected uploads leave the current data unchanged.
          </p>
        </SectionCard>

        <SectionCard
          icon={ListChecks}
          title="Reconciliation"
          tone="emerald"
          subtitle={`${passCount} of ${checks.length} checks pass · uploaded-source checks`}
        >
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 scrollbar-stylish">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2.5 rounded-lg border border-border/60 bg-background p-2.5 text-sm">
                {c.status === "pass" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lind-green" />
                ) : c.status === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-lind-orange" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    expected {c.expected} · observed {c.observed}
                  </p>
                  {c.note && <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard icon={SlidersHorizontal} title="Assumptions" tone="orange" subtitle="Every estimate cites the assumption it depends on. Changes apply everywhere instantly." action={changed ? (
        <Button size="sm" variant="ghost" onClick={prefs.resetAssumptions} className="gap-1">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      ) : undefined}>
        <div className="grid gap-3 md:grid-cols-2">
          {PROTOTYPE_ASSUMPTIONS.map((p) => (
            <div key={p.id} className="rounded-xl border border-border/60 bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">{p.id}</span>
                    {p.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.unit} · {p.confidence} confidence · {p.source}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {p.key === "repairFactor" ? (
                  SCENARIOS.map((s) => (
                    <label key={s} className="flex items-center gap-1 text-xs">
                      <span className="w-8 capitalize text-muted-foreground">{s}</span>
                      <Input
                        type="number"
                        step={0.05}
                        min={0}
                        max={2}
                        value={as.repairFactor[s]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v >= 0 && v <= 2) setA({ repairFactor: { ...as.repairFactor, [s]: v } });
                        }}
                        className="h-8 w-20"
                        aria-label={`${p.label} ${s}`}
                      />
                    </label>
                  ))
                ) : (
                  <NumberField
                    value={as[p.key] as number}
                    onChange={(v) => setA({ [p.key]: v } as Partial<AssumptionValues>)}
                    label={p.label}
                    {...RANGES[p.key as Exclude<keyof AssumptionValues, "repairFactor">]}
                  />
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.rationale}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={ScrollText} title="Uploaded assumption registry" tone="primary" subtitle="A001–A008 as supplied">
          <ul className="space-y-2.5 text-sm">
            {a.dataset.assumptions.map((x) => (
              <li key={x.id} className="border-b border-border/60 pb-2.5 last:border-0">
                <p className="font-medium">
                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">{x.id}</span>
                  {x.assumption}: <span className="font-normal">{x.value}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {x.rationale} · {x.confidence} · {x.treatment}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard icon={Tags} title="How figures are labelled" tone="violet">
          <ul className="space-y-2.5">
            {(Object.keys(PROVENANCE_CLASS_META) as ProvenanceClass[]).map((k) => (
              <li key={k} className="flex items-start gap-3 text-sm">
                <ProvenanceBadge cls={k} className="mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{PROVENANCE_CLASS_META[k].description}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data quality by source</h3>
          <ul className="mt-2 space-y-1.5 text-xs">
            {a.dataset.dataQuality.map((d) => (
              <li key={d.dataset} className="flex gap-2">
                <span className="w-32 shrink-0 font-medium">{d.dataset}</span>
                <span className="text-muted-foreground">
                  {d.status.toLowerCase().replace(/_/g, " ")} · {d.confidence} · {d.note}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard id="readiness" icon={CircleDashed} title="Ready for external reporting?" tone="amber" subtitle="Source validation before external reporting">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Input</th>
                <th className="px-3 py-2 font-semibold">Now</th>
                <th className="px-3 py-2 font-semibold">Needed</th>
                <th className="px-3 py-2 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {READINESS.map((r) => (
                <tr key={r.item} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{r.item}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.now}</td>
                  <td className="px-3 py-2.5 text-xs">{r.needed}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        r.state === "ready" ? "bg-lind-green/10 text-lind-green" : r.state === "partial" ? "bg-lind-orange/10 text-lind-orange" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {r.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={FileSpreadsheet} title="Import report" tone="blue" subtitle={`${report?.tables.filter((t) => t.sourceSheet).length ?? 0} of ${TABLES.length} sheets recognised · ${issues.length} notes`}>
        {issues.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {issues.map((i, k) => (
              <li key={`${i.code}-${k}`} className={cn("rounded-lg px-3 py-2 text-xs", i.severity === "error" ? "bg-destructive/10 text-destructive" : i.severity === "warning" ? "bg-lind-orange/10 text-lind-orange dark:text-lind-orange" : "bg-muted text-muted-foreground")}>
                <span className="font-semibold">{i.table}:</span> {i.message}
                {i.examples?.length ? <span className="opacity-80"> (e.g. {i.examples.slice(0, 3).join(", ")})</span> : null}
              </li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Table</th>
                <th className="px-3 py-2 font-semibold">Sheet</th>
                <th className="px-3 py-2 text-right font-semibold">Rows</th>
                <th className="px-3 py-2 font-semibold">Columns</th>
                <th className="px-3 py-2 font-semibold">Expected source in production</th>
              </tr>
            </thead>
            <tbody>
              {(report?.tables ?? []).map((t) => {
                const spec = TABLES.find((s) => s.key === t.table);
                const alias = t.mappedColumns.filter((c) => c.viaAlias).length;
                return (
                  <tr key={t.table} className="border-b border-border/60 align-top last:border-0">
                    <td className="py-2 pr-3 font-medium">
                      {t.label}
                      {t.required && <span className="ml-1 text-destructive">*</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.sourceSheet ?? "- kept from previous data"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(t.rowsKept)}</td>
                    <td className="px-3 py-2">
                      {t.mappedColumns.length} mapped{alias ? ` (${alias} via alias)` : ""}
                      {t.missingColumns.length > 0 && <span className="text-lind-orange"> · missing {t.missingColumns.join(", ")}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{spec?.futureSource ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

const RANGES: Record<Exclude<keyof AssumptionValues, "repairFactor">, { min: number; max: number; step: number; pct?: boolean }> = {
  baselineBand: { min: 0, max: 0.5, step: 0.01, pct: true },
  mixedWasteShare: { min: 0, max: 1, step: 0.05, pct: true },
  washTargetPerMonth: { min: 1, max: 12, step: 0.5 },
  targetUtilization: { min: 0.5, max: 1, step: 0.01, pct: true },
  electricityEurPerKwh: { min: 0, max: 1, step: 0.01 },
  waterEurPerM3: { min: 0, max: 20, step: 0.1 },
  dormantDays: { min: 14, max: 365, step: 1 },
};

function NumberField({ value, onChange, label, min, max, step, pct }: { value: number; onChange: (v: number) => void; label: string; min: number; max: number; step: number; pct?: boolean }) {
  const shown = pct ? Math.round(value * 1000) / 10 : value;
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={shown}
        min={pct ? min * 100 : min}
        max={pct ? max * 100 : max}
        step={pct ? step * 100 : step}
        onChange={(e) => {
          const raw = Number(e.target.value);
          if (!Number.isFinite(raw)) return;
          const v = pct ? raw / 100 : raw;
          if (v >= min && v <= max) onChange(v);
        }}
        className="h-8 w-28"
        aria-label={label}
      />
      {pct && <span className="text-xs text-muted-foreground">%</span>}
    </div>
  );
}
