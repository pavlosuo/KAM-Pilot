import { describe, expect, it } from "vitest";
import { companyPalette, validBrandColor } from "./branding";

describe("company theme selection", () => {
  it("uses Lindström dark blue and red for the app", () => {
    expect(companyPalette("Lindström").primary).toBe("#003f72");
    expect(companyPalette("Lindström").secondary).toBe("#e52330");
  });
  it("applies a customer's colour only as the report accent", () => {
    const p = companyPalette("NorthStar Foods Group", "#123456");
    expect(p.accent).toBe("#123456");
    expect(p.primary).toBe("#003f72");
    expect(companyPalette("Apex Industrial Systems").accent).toBe("#e52330");
  });
  it("rejects non-colour overrides", () => {
    expect(validBrandColor("url(https://example.com)")).toBe(false);
    expect(companyPalette("NorthStar Foods Group", "red; background:white").accent).toBe("#e52330");
  });
});
