import { readTokenColors, toHex, type TokenColors } from "@/lib/ui/use-token-colors";

export type HexPalette = Record<keyof TokenColors, string>;

/**
 * Exports are printed on light paper whatever the screen theme: read the
 * design tokens with the dark class removed for one synchronous style pass.
 */
export function exportPalette(): HexPalette {
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  if (wasDark) root.classList.remove("dark");
  try {
    const c = readTokenColors();
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, toHex(v)])) as HexPalette;
  } finally {
    if (wasDark) root.classList.add("dark");
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
