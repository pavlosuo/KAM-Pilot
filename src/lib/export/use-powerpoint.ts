import { useEffect, useState, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Deck } from "./deck";
import { exportPalette, type HexPalette } from "./colors";
import { blobBase64, convertedBlob } from "./conversion";
import { convertPowerPoint } from "./conversion.functions";
import { preparationKey, preparationStore } from "./preparation";

export function usePowerPoint(deck: Deck) {
  const convert = useServerFn(convertPowerPoint);
  const [palette, setPalette] = useState<HexPalette | null>(null);
  // Read document colours only after hydration; refresh when the report changes.
  useEffect(() => { setPalette(exportPalette()); }, [deck]);
  const key = palette ? preparationKey(deck, palette) : "";
  const state = useSyncExternalStore(preparationStore.subscribe, () => preparationStore.get(key), () => undefined);
  const prepare = (retry = false) => {
    if (!palette || !key) return;
    preparationStore.prepare(key, async () => {
      const { deckToPptx } = await import("./pptx");
      const filename = `${deck.fileBase}.pptx`.replace(/[^\w.-]/g, "-").slice(-180);
      const result = await convert({ data: { file: await blobBase64(await deckToPptx(deck, palette)), filename } });
      if (!result.ok) throw new Error(result.error.includes("CREDITS_EXCEEDED")
        ? "CloudConvert has no conversion credits left. Add credits in CloudConvert, then retry PowerPoint."
        : result.error);
      return { blob: convertedBlob(result.file), filename };
    }, retry);
  };
  useEffect(() => {
    // Coalesce changing notes, filters and arriving research before converting a new version.
    const timer = setTimeout(() => prepare(), 800);
    return () => clearTimeout(timer);
  }, [key]);
  return { state, retry: () => prepare(true) };
}