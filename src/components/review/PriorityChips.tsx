import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { PRIORITY_META, type PriorityKey, type Weights } from "@/lib/engine/priorities";
import { PRIORITY_BG, PRIORITY_BG_SOFT, PRIORITY_TEXT } from "@/lib/ui/palette";

/** Ranked emphasis chips with a small strength meter. */
export function PriorityChips({ ranked, weights, max = 4, className }: { ranked: PriorityKey[]; weights: Weights; max?: number; className?: string }) {
  const top = ranked.slice(0, max).filter((k) => weights[k] > 0);
  const peak = Math.max(...top.map((k) => weights[k]), 0.0001);
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {top.map((k) => (
        <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-semibold", PRIORITY_BG_SOFT[k], PRIORITY_TEXT[k])}>
          {PRIORITY_META[k].label}
          <span className="flex items-end gap-0.5" aria-hidden="true">
            {[0.33, 0.66, 1].map((t) => (
              <span key={t} className={cn("w-1 rounded-full", weights[k] / peak >= t - 0.01 ? PRIORITY_BG[k] : "bg-current/20", t === 0.33 ? "h-1.5" : t === 0.66 ? "h-2" : "h-2.5")} />
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}
