import { ArrowRight, CheckCircle2, FileSpreadsheet, FileText, Loader2, ShieldAlert, TriangleAlert, UploadCloud, X } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { ACCEPTED_UPLOAD, useWorkbookUpload } from "@/components/data/useWorkbookUpload";
import { MAX_UPLOAD_FILES, tablesInFile } from "@/lib/data/merge-files";
import { fmtNum, fmtPeriod } from "@/lib/engine/format";
import { useDataset } from "@/lib/state/dataset-store";

const fmtSize = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);

/** Step 1 - data: up to three Excel/PDF files, combined and checked in the browser. */
export function DataStep({ onContinue }: { onContinue: () => void }) {
  const { dataset, report } = useDataset();
  const { files, addFiles, removeFile, busy, progress, lastReport } = useWorkbookUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const shown = lastReport ?? report;
  const errors = shown?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = shown?.issues.filter((i) => i.severity === "warning") ?? [];
  const checks = shown?.reconciliation ?? [];
  const incomplete = files.length > 0 && !dataset;
  const full = files.length >= MAX_UPLOAD_FILES;
  const perFile = useMemo(() => new Map(files.map((f) => [f.id, tablesInFile(f)])), [files]);

  const countries = dataset ? new Set(dataset.sites.map((s) => s.country)).size : 0;
  const months = dataset?.meta.months ?? [];
  const busyLabel =
    progress?.stage === "pages"
      ? `Reading page ${progress.done} of ${progress.total} of ${progress.file}…`
      : progress?.stage === "mapping"
        ? "Combining the files and checking the numbers…"
        : progress?.file
          ? `Opening ${progress.file}…`
          : "Working…";

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy || full) return;
    const list = [...e.dataTransfer.files];
    if (list.length) void addFiles(list);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card className="space-y-5 p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy && !full) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-lind-blue bg-lind-blue/5" : "border-lind-line bg-lind-mist/60",
            full && "opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-10 w-10 animate-spin text-lind-blue" /> : <UploadCloud className="h-10 w-10 text-lind-navy" />}
          <p className="text-lg font-bold text-lind-navy">{busy ? busyLabel : full ? "Three files added" : "Drag your data files here"}</p>
          <p className="max-w-md text-base text-lind-grey">
            Excel is the main file. You can add PDF tables too - up to {MAX_UPLOAD_FILES} files, 25 MB each.
          </p>
          <Button size="lg" variant={files.length ? "outline" : "default"} disabled={busy || full} onClick={() => inputRef.current?.click()}>
            {files.length ? "Add another file" : "Choose files"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_UPLOAD}
            className="hidden"
            aria-label="Choose data files"
            onChange={(e) => {
              const list = [...(e.target.files ?? [])];
              e.target.value = "";
              if (list.length) void addFiles(list);
            }}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-lind-grey">
              {files.length} of {MAX_UPLOAD_FILES} files
            </p>
            <ul className="space-y-2">
              {files.map((f) => {
                const tables = perFile.get(f.id) ?? [];
                const Icon = f.kind === "pdf" ? FileText : FileSpreadsheet;
                return (
                  <li key={f.id} className="flex items-center gap-3 rounded-lg border border-lind-line bg-card p-3">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", f.kind === "pdf" ? "bg-lind-red/10 text-lind-red" : "bg-lind-green/10 text-lind-green")}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-lind-ink">{f.name}</span>
                      <span className="block truncate text-sm text-lind-grey">
                        {fmtSize(f.size)} · {tables.length} table{tables.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <Button variant="ghost" size="icon" disabled={busy} onClick={() => void removeFile(f.id)} aria-label={`Remove ${f.name}`}>
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card className={cn("p-6", incomplete && "ring-2 ring-lind-red/40")}>
          <p className="eyebrow text-lind-grey">What we found</p>
          {dataset ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                {[
                  ["Companies", fmtNum(dataset.customers.length)],
                  ["Sites", fmtNum(dataset.sites.length)],
                  ["Countries", fmtNum(countries)],
                  ["Period", months.length ? fmtPeriod(months[0], months[months.length - 1]) : "-"],
                ].map(([k, v]) => (
                  <div key={k} className="border-t-4 border-lind-navy pt-2">
                    <dd className="truncate text-2xl font-bold text-lind-navy">{v}</dd>
                    <dt className="text-sm text-lind-grey">{k}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-5 space-y-2 text-base">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-lind-green" />
                  {shown?.tables.filter((t) => t.sourceSheet).length ?? 0} tables read
                </p>
                <p className="flex items-center gap-2">
                  {checks.some((c) => c.status === "fail") ? (
                    <TriangleAlert className="h-5 w-5 text-lind-red" />
                  ) : checks.some((c) => c.status === "warn") ? (
                    <TriangleAlert className="h-5 w-5 text-lind-orange" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-lind-green" />
                  )}
                  {checks.filter((c) => c.status === "pass").length} of {checks.length} checks pass
                  {warnings.length ? ` · ${warnings.length} to review` : ""}
                </p>
              </div>
            </>
          ) : incomplete ? (
            <div role="alert" className="mt-3 flex gap-2 text-base text-lind-red">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Some required tables are still missing</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {errors.slice(0, 6).map((e, i) => (
                    <li key={i}>
                      {e.table}: {e.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-lind-grey">Add the file that contains them, or remove the file that does not fit.</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-base text-lind-grey">Upload a file to see the companies, sites and period it covers.</p>
          )}
        </Card>
        <div className="flex justify-end">
          <Button size="lg" onClick={onContinue} disabled={busy || !dataset}>
            Continue <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
