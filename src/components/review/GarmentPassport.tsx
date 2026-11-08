import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ScanLine, Shirt, Truck, WashingMachine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/design-system/ventura-6bef42/components/ui/scroll-area";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { AssetCycle, AssetSummary, Dataset } from "@/lib/data/types";
import { fmtNum } from "@/lib/engine/format";
import { Segmented } from "./Segmented";

const DAY = 86_400_000;

/** Cycle history comes exclusively from the uploaded dataset. */
function useAssetCycles(ds: Dataset, assetId: string | null) {
  const local = useMemo(
    () => (assetId ? ds.assetCycles.filter((c) => c.assetId === assetId).sort((a, b) => a.cycleNumber - b.cycleNumber) : []),
    [ds.assetCycles, assetId],
  );
  return { cycles: local, loading: false };
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Garment passport: the RFID life of one tracked garment - every pickup,
 * laundry and delivery - so hygiene, traceability and "where are our
 * garments?" questions can be answered garment by garment.
 */
export function GarmentPassportList({ ds, assets, periodEnd, dormantDays }: { ds: Dataset; assets: AssetSummary[]; periodEnd: string; dormantDays: number }) {
  const [filter, setFilter] = useState<"dormant" | "late" | "all">("dormant");
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  const products = useMemo(() => new Map(ds.products.map((p) => [p.id, p])), [ds.products]);

  const enriched = useMemo(
    () =>
      assets.map((x) => {
        const idle = daysBetween(x.lastPickup, periodEnd);
        return { ...x, idle, dormant: idle > dormantDays };
      }),
    [assets, periodEnd, dormantDays],
  );
  const list = useMemo(() => {
    const f = enriched.filter((x) => (filter === "all" ? true : filter === "dormant" ? x.dormant : x.late > 0));
    return f.sort((a, b) => (filter === "late" ? b.late - a.late || b.avgHours - a.avgHours : b.idle - a.idle));
  }, [enriched, filter]);
  const dormantCount = enriched.filter((x) => x.dormant).length;
  const lateCount = enriched.filter((x) => x.late > 0).length;
  const current = enriched.find((x) => x.assetId === openId) ?? null;

  if (!assets.length) {
    return <p className="text-sm text-muted-foreground">No RFID-tracked garments from this site are in the cycle sample.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Filter garments"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setLimit(8);
          }}
          options={[
            { value: "dormant", label: "Unseen", count: dormantCount },
            { value: "late", label: "Late cycles", count: lateCount },
            { value: "all", label: "All tracked", count: enriched.length },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No garments in this group.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.slice(0, limit).map((x) => (
            <li key={x.assetId}>
              <button
                type="button"
                onClick={() => setOpenId(x.assetId)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                    x.dormant ? "bg-lind-orange/10 text-lind-orange ring-lind-orange/25" : "bg-lind-green/10 text-lind-green ring-lind-green/25",
                  )}
                >
                  <Shirt className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs font-semibold">{x.assetId}</span>
                  <span className="block truncate text-xs text-muted-foreground">{products.get(x.productId)?.name ?? x.productId}</span>
                </span>
                <span className="text-right text-xs">
                  <span className={cn("block font-semibold tabular-nums", x.dormant && "text-lind-orange")}>{x.idle} d</span>
                  <span className="block text-muted-foreground">since pickup</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 12)}>
            Show more ({list.length - limit} left)
          </Button>
        </div>
      )}
      <PassportDialog ds={ds} asset={current} productName={current ? (products.get(current.productId)?.name ?? current.productId) : ""} onClose={() => setOpenId(null)} periodEnd={periodEnd} dormantDays={dormantDays} />
    </div>
  );
}

function PassportDialog({
  ds,
  asset,
  productName,
  onClose,
  periodEnd,
  dormantDays,
}: {
  ds: Dataset;
  asset: (AssetSummary & { idle: number; dormant: boolean }) | null;
  productName: string;
  onClose: () => void;
  periodEnd: string;
  dormantDays: number;
}) {
  const { cycles, loading } = useAssetCycles(ds, asset?.assetId ?? null);
  return (
    <Dialog open={!!asset} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        {asset && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" /> Garment passport
              </DialogTitle>
              <DialogDescription>
                <span className="font-mono">{asset.assetId}</span> · {productName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Cycles in sample" value={fmtNum(asset.cycles)} />
              <Stat label="Avg turnaround" value={`${fmtNum(asset.avgHours, 0)} h`} />
              <Stat label="Since last pickup" value={`${asset.idle} d`} tone={asset.dormant ? "warn" : "ok"} />
            </div>
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl p-3 text-xs",
                asset.dormant ? "bg-lind-orange/10 text-lind-orange dark:text-lind-orange" : "bg-lind-green/10 text-lind-green dark:text-lind-green",
              )}
            >
              {asset.dormant ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>
                {asset.dormant
                  ? `Not collected for ${asset.idle} days (threshold ${dormantDays}). Check whether the wearer still needs it, it is stored in a locker, or it left with an employee.`
                  : "Collected recently - the garment is in normal circulation."}{" "}
                Based on the RFID cycle sample up to {fmtDate(periodEnd)}.
              </span>
            </div>
            <ScrollArea className="max-h-[44vh] pr-3">
              {loading && (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading cycle history…
                </p>
              )}
              {!loading && cycles.length === 0 && (
                <p className="py-6 text-sm text-muted-foreground">The cycle history for this garment is not available in the current dataset.</p>
              )}
              <ol className={cn("relative ml-3 space-y-4 border-l border-border py-1 pl-5", (loading || cycles.length === 0) && "hidden")}>
                {cycles.map((c) => (
                  <li key={c.cycleNumber} className="relative">
                    <span
                      className={cn(
                        "absolute -left-7.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card",
                        c.late ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
                      )}
                    >
                      <WashingMachine className="h-3 w-3" />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">Cycle {c.cycleNumber}</p>
                      <p className={cn("text-xs tabular-nums", c.late ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        {fmtNum(c.hours, 0)} h{c.late ? " · late" : ""}
                      </p>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" /> Picked up {fmtDate(c.pickup)}
                      </span>
                      <span className="flex items-center gap-1">
                        <WashingMachine className="h-3 w-3" /> Washed {fmtDate(c.outLaundry)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3 w-3" /> Delivered {fmtDate(c.delivered)}
                      </span>
                    </div>
                  </li>
                ))}
                {asset.dormant && (
                  <li className="relative">
                    <span className="absolute -left-7.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-lind-orange text-primary-foreground ring-2 ring-card">
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-semibold text-lind-orange">No pickup since {fmtDate(asset.lastPickup)}</p>
                  </li>
                )}
              </ol>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", tone === "warn" && "text-lind-orange")}>{value}</p>
    </div>
  );
}
