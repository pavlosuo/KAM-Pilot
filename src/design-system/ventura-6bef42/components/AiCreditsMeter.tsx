import type { AiCreditPool } from "@/design-system/ventura-6bef42/lib/ai-credits.functions";

export function AiCreditsMeter({ pools, personal = false }: { pools: AiCreditPool[]; personal?: boolean }) {
  if (!pools.length) {
    return <p className="text-sm text-muted-foreground">You're not part of a program yet.</p>;
  }
  return (
    <div className="space-y-4">
      {pools.map((p) => {
        const pct = p.limit ? Math.min(100, Math.round((p.used / p.limit) * 100)) : 100;
        const label = p.pool === "lead" ? "Lead credits" : personal ? "Your credits" : "Founders total (150 each)";
        return (
          <div key={`${p.programId}-${p.pool}`} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">
                {p.programName} · <span className="text-muted-foreground">{label}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {p.remaining} / {p.limit} left
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Resets {new Date(p.resetsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
            </p>
          </div>
        );
      })}
    </div>
  );
}
