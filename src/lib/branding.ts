/**
 * Lindström brand colours (lindstromgroup.com style guide). The app's own
 * chrome always uses Lindström's dark blue; a customer's brand colour, when the
 * operator sets one, is shown only as an accent on that customer's report.
 */
export const COMPANY_PALETTES = {
  lindstrom: { primary: "#003f72", secondary: "#e52330", source: "https://lindstromgroup.com/style-guide/" },
} as const;

export function validBrandColor(value?: string): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function companyPalette(_name: string, override?: string) {
  const palette = COMPANY_PALETTES.lindstrom;
  return { ...palette, accent: validBrandColor(override) ? override : palette.secondary, custom: validBrandColor(override) };
}
