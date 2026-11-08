import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Database, Landmark, Sparkles, Target } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { Observation, ObservationKind } from "@/lib/engine/observations";
import { PRIORITY_META } from "@/lib/engine/priorities";
import { PRIORITY_BG_SOFT, PRIORITY_TEXT } from "@/lib/ui/palette";
import { Provenance } from "./Provenance";
import { observationTag } from "@/lib/ui/contextual-tags";
import { Button } from "@/components/ui/button";

export const KIND_META: Record<ObservationKind, { label: string; icon: typeof Sparkles; chip: string; bar: string }> = {
  value: { label: "Value delivered", icon: CheckCircle2, chip: "bg-lind-green/10 text-lind-green ring-lind-green/25", bar: "bg-lind-green" },
  risk: { label: "Risk", icon: AlertTriangle, chip: "bg-destructive/10 text-destructive ring-destructive/25", bar: "bg-destructive" },
  opportunity: { label: "Savings opportunity", icon: Sparkles, chip: "bg-lind-orange/10 text-lind-orange ring-lind-orange/25", bar: "bg-lind-orange" },
  rule: { label: "Country rule", icon: Landmark, chip: "bg-lind-blue/10 text-lind-blue ring-lind-blue/25", bar: "bg-lind-blue" },
  data: { label: "Evidence gap", icon: Database, chip: "bg-lind-grey/10 text-lind-grey ring-lind-grey/25", bar: "bg-lind-grey" },
};

export function ObservationCard({
  observation: o,
  compact = false,
  picked,
  onTogglePick,
  index = 0,
}: {
  observation: Observation;
  compact?: boolean;
  picked?: boolean;
  onTogglePick?: () => void;
  index?: number;
}) {
  const k = KIND_META[o.kind];
  const Icon = k.icon;
  return (
    <motion.article
      id={`obs-${o.id}`}
      data-deep-link=""
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-background p-4 transition-colors",
        picked ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", k.bar)} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-widest ring-1", k.chip)}>
          <Icon className="h-3 w-3" /> {observationTag(o)}
        </span>
        {!compact &&
          o.tags.slice(0, 3).map((t) => (
            <span key={t} className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY_BG_SOFT[t], PRIORITY_TEXT[t])}>
              {PRIORITY_META[t].short}
            </span>
          ))}
      </div>
      <h3 className={cn("mt-2 font-semibold leading-snug", compact ? "text-sm" : "text-base")}>{o.title}</h3>
      {!compact && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{o.detail}</p>}

      {o.evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {o.evidence.map((e) => (
            <span key={e.label} className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1 text-xs">
              <span className="text-muted-foreground">{e.label}</span>
              <span className="font-semibold tabular-nums">{e.value}</span>
              {e.metric && <Provenance metric={e.metric} compact />}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex gap-2 rounded-xl bg-muted/40 p-2.5">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next step</p>
            <p className="text-xs leading-relaxed">{o.action}</p>
          </div>
        </div>
      </div>

      {!compact && (o.assumptionIds.length > 0 || onTogglePick) && (
        <div className="mt-auto flex flex-wrap items-end gap-2 pt-3">
          {o.assumptionIds.map((id) => (
            <span key={id} className="rounded-md border border-dashed px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {id}
            </span>
          ))}
          {onTogglePick && (
            <Button
              type="button"
              onClick={onTogglePick}
              aria-pressed={picked}
              variant={picked ? "default" : "outline"}
              size="sm"
              className="ml-auto"
            >
              {picked ? <CheckCircle2 className="h-4 w-4" /> : null}
              {picked ? "In the review" : "Add to review"}
            </Button>
          )}
        </div>
      )}
    </motion.article>
  );
}
