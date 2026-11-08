import type { Observation } from "@/lib/engine/observations";

export const AUTO_PICK_COUNT = 6;

/**
 * Observations included in the exported review: the KAM's explicit picks, or
 * the top-ranked ones for the current lens (always at least one value item).
 */
export function reviewObservations(all: Observation[], picked: string[] | null, n = AUTO_PICK_COUNT): Observation[] {
  if (picked) {
    const set = new Set(picked);
    return all.filter((o) => set.has(o.id));
  }
  const top = all.slice(0, n);
  if (!top.some((o) => o.kind === "value")) {
    const v = all.find((o) => o.kind === "value");
    if (v) top.splice(top.length - 1, 1, v);
  }
  return top;
}
