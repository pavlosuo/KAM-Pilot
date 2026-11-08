import type { Deck } from "./deck";
import type { HexPalette } from "./colors";

export type PreparedPowerPoint = { blob: Blob; filename: string };
export type Preparation = { status: "preparing" } | { status: "ready"; file: PreparedPowerPoint } | { status: "error"; error: string };

/** Session-only cache: identical decks share one conversion; provider writes never run concurrently. */
export function createPreparationStore() {
  const entries = new Map<string, Preparation>();
  const listeners = new Set<() => void>();
  let tail: Promise<void> = Promise.resolve();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get(key: string) { return entries.get(key); },
    prepare(key: string, run: () => Promise<PreparedPowerPoint>, retry = false) {
      const existing = entries.get(key);
      if (existing && !(retry && existing.status === "error")) return;
      entries.set(key, { status: "preparing" });
      emit();
      tail = tail.then(async () => {
        try { entries.set(key, { status: "ready", file: await run() }); }
        catch (error) { entries.set(key, { status: "error", error: error instanceof Error ? error.message : "PowerPoint preparation failed. Please try again." }); }
        // Keep only a small number of completed versions in browser memory.
        for (const [oldKey, entry] of entries) {
          if (entries.size <= 3) break;
          if (oldKey !== key && entry.status !== "preparing") entries.delete(oldKey);
        }
        emit();
      });
    },
  };
}

export const preparationStore = createPreparationStore();
export function preparationKey(deck: Deck, palette: HexPalette) { return JSON.stringify([deck, palette]); }