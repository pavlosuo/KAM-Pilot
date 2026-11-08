import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { MetricKey } from "@/lib/engine/provenance";
import { Provenance } from "./Provenance";

/** Lindström statistic block: coloured top rule, large dark-blue figure, plain label. */
export function KpiTile({
  label,
  value,
  unit,
  metric,
  sub,
  icon: Icon,
  iconClass,
  highlight = false,
  range,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  metric?: MetricKey;
  sub?: ReactNode;
  icon?: LucideIcon;
  iconClass?: string;
  highlight?: boolean;
  range?: { low: string; high: string };
  index?: number;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-w-0 flex-col justify-between gap-3 rounded-lg bg-card p-5 shadow-lind", className)}>
      <div className={cn("absolute inset-x-0 top-0 h-1 rounded-t-lg", highlight ? "bg-lind-red" : "bg-lind-navy")} />
      <div className="flex items-start justify-between gap-2 pt-1">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-lind-grey">
          {Icon ? <Icon className={cn("h-4 w-4 shrink-0", iconClass)} /> : null}
          <span className="truncate">{label}</span>
        </span>
        {metric ? <Provenance metric={metric} compact /> : null}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold leading-none tracking-tight tabular-nums text-lind-navy">{value}</span>
          {unit ? <span className="text-sm font-semibold text-lind-grey">{unit}</span> : null}
        </div>
        {range ? (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{range.low}</span>
            <span className="relative h-1.5 flex-1 rounded-full bg-muted">
              <span className="absolute inset-y-0 left-1/4 right-1/4 rounded-full bg-lind-navy/25" />
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lind-navy" />
            </span>
            <span className="tabular-nums">{range.high}</span>
          </div>
        ) : null}
        {sub ? <div className="mt-2 text-sm leading-snug text-muted-foreground">{sub}</div> : null}
      </div>
    </div>
  );
}
