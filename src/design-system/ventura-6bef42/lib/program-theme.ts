/** Maps a program's hex theme colour onto the design tokens used by program surfaces. */
export function programBrandStyle(hex: string | null | undefined): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const fg = lum > 0.6 ? "#111111" : "#ffffff";
  return {
    ["--primary" as string]: hex,
    ["--primary-foreground" as string]: fg,
    ["--ring" as string]: hex,
    ["--sidebar-primary" as string]: hex,
    ["--accent-foreground" as string]: "var(--foreground)",
  } as React.CSSProperties;
}
