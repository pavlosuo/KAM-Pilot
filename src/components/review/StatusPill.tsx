import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { HealthStatus } from "@/lib/engine/metrics";
import { STATUS_META } from "@/lib/ui/palette";

export function StatusDot({ status, className }: { status: HealthStatus; className?: string }) {
  return <span className={cn("inline-flex h-2 w-2 shrink-0 rounded-full", STATUS_META[status].dot, className)} />;
}

export function StatusPill({ status, className, label }: { status: HealthStatus; className?: string; label?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-widest ring-1", m.soft, m.text, m.ring, className)}>
      <StatusDot status={status} />
      {label ?? m.label}
    </span>
  );
}
