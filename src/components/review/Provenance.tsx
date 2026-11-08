import { Info } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/design-system/ventura-6bef42/components/ui/hover-card";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { PROVENANCE, PROVENANCE_CLASS_META, type MetricKey, type ProvenanceClass } from "@/lib/engine/provenance";
import { PROTOTYPE_ASSUMPTIONS } from "@/lib/engine/assumptions";

const CLASS_STYLE: Record<ProvenanceClass, string> = {
  recorded: "bg-muted text-muted-foreground ring-border",
  calculated: "bg-lind-blue/10 text-lind-blue ring-lind-blue/25",
  allocated: "bg-lind-purple/10 text-lind-purple ring-lind-purple/25",
  estimated: "bg-lind-orange/10 text-lind-orange ring-lind-orange/25",
  assumption: "bg-lind-orange/10 text-lind-orange ring-lind-orange/25",
  public: "bg-lind-green/10 text-lind-green ring-lind-green/25",
};

export function ProvenanceBadge({ cls, className }: { cls: ProvenanceClass; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
        CLASS_STYLE[cls],
        className,
      )}
    >
      {PROVENANCE_CLASS_META[cls].label}
    </span>
  );
}

/** Hover chip that explains where a number comes from. */
export function Provenance({ metric, className, compact = false }: { metric: MetricKey; className?: string; compact?: boolean }) {
  const p = PROVENANCE[metric];
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn("inline-flex cursor-help items-center gap-1 align-middle", className)}
          aria-label={`How this figure is derived: ${PROVENANCE_CLASS_META[p.cls].label}`}
          data-no-ripple="true"
        >
          {compact ? (
            <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full ring-1", CLASS_STYLE[p.cls])}>
              <Info className="h-2.5 w-2.5" />
            </span>
          ) : (
            <ProvenanceBadge cls={p.cls} />
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-left" side="top" align="start">
        <div className="flex items-center justify-between gap-2">
          <ProvenanceBadge cls={p.cls} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{p.status}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{PROVENANCE_CLASS_META[p.cls].description}</p>
        <dl className="mt-3 space-y-2 text-xs">
          <div>
            <dt className="font-semibold text-foreground">How</dt>
            <dd className="text-muted-foreground">{p.formula}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Sources</dt>
            <dd className="text-muted-foreground">{p.sources.join(" · ")}</dd>
          </div>
          {p.assumptions.length > 0 && (
            <div>
              <dt className="font-semibold text-foreground">Assumptions</dt>
              <dd className="space-y-0.5 text-muted-foreground">
                {p.assumptions.map((id) => (
                  <div key={id}>
                    <span className="font-mono text-[11px] text-foreground">{id}</span>{" "}
                    {PROTOTYPE_ASSUMPTIONS.find((x) => x.id === id)?.label ?? ASSUMPTION_LABELS[id] ?? ""}
                  </div>
                ))}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <dt className="font-semibold text-foreground">Confidence</dt>
            <dd className="text-muted-foreground">{p.confidence}</dd>
          </div>
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

const ASSUMPTION_LABELS: Record<string, string> = {
  A001: "Selected comparison baseline",
  A003: "Waste & resources allocated by share of washed kg",
  A005: "Synthetic product footprints",
  A006: "Synthetic customer/site hierarchy",
  A007: "Industry emphasis rules",
  A008: "Every output keeps its status label",
};
