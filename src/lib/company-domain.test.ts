import { describe, expect, it } from "vitest";
import { companyDomain } from "./company-domain";

describe("company logo domains", () => {
  it("reads explicit company websites", () => {
    expect(companyDomain("https://www.lindstromgroup.com/about/")).toBe("lindstromgroup.com");
    expect(companyDomain("example.org")).toBe("example.org");
  });
  it("does not guess domains from company names", () => {
    expect(companyDomain("Acme Manufacturing")).toBeNull();
    expect(companyDomain("javascript:alert(1)")).toBeNull();
  });
});