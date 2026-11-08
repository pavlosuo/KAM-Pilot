import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeDataset } from "@/lib/data/codec";
import { archetypeForRole, audienceSiteScope, buildAudience, locationOptions, resolveLocations, roleSuggestions } from "./audience";

const ds = decodeDataset(JSON.parse(readFileSync("src/data/default-dataset.json", "utf8")));
const northstar = ds.customers.find((c) => c.id === "CUST001")!;
const sites = ds.sites.filter((s) => s.customerId === "CUST001");

describe("studio step 2 - who the KAM meets", () => {
  it("suggests a food company's quality manager first and marks three obvious roles", () => {
    const s = roleSuggestions(northstar);
    expect(s[0].role).toBe("Quality & food safety manager");
    expect(s.filter((r) => r.likely)).toHaveLength(3);
  });

  it("maps typed roles to the closest lens", () => {
    expect(archetypeForRole("Head of Purchasing")).toBe("procurement");
    expect(archetypeForRole("Group CFO")).toBe("cfo");
    expect(archetypeForRole("ESG lead")).toBe("sustainability");
    expect(archetypeForRole("Shift supervisor")).toBe("operations");
    expect(archetypeForRole("Barista")).toBe("kam-balanced");
  });

  it("offers the countries and cities defined in the data", () => {
    const { countries, cities } = locationOptions(ds, "CUST001");
    expect(countries.map((c) => `${c.value}:${c.sites}`)).toEqual(["Finland:12", "Poland:6", "Sweden:6"]);
    expect(cities.some((c) => c.value === "Tampere" && c.country === "Finland")).toBe(true);
  });

  it("scopes the report to the chosen countries and cities and keeps own locations as labels", () => {
    const r = resolveLocations(["Finland", "Malmö", "Tallinn"], sites);
    expect(r.siteIds).toHaveLength(13);
    expect(r.countries.sort()).toEqual(["Finland", "Sweden"]);
    expect(r.unmatched).toEqual(["Tallinn"]);
  });

  it("builds one stable audience per company, roles and locations", () => {
    const a = buildAudience({ customer: northstar, roles: ["Procurement manager"], locations: ["Finland"] }, ds);
    const b = buildAudience({ customer: northstar, roles: ["Procurement manager"], locations: ["Finland"] }, ds);
    expect(a.id).toBe(b.id);
    expect(a.archetype).toBe("procurement");
    expect(a.country).toBe("Finland");
    expect(audienceSiteScope(a, sites)).toHaveLength(12);
  });

  it("covers the whole company when no location is chosen or none matches", () => {
    const all = buildAudience({ customer: northstar, roles: ["CFO / Finance director"], locations: [] }, ds);
    expect(audienceSiteScope(all, sites)).toBeNull();
    const own = buildAudience({ customer: northstar, roles: ["CFO / Finance director"], locations: ["Tallinn"] }, ds);
    expect(audienceSiteScope(own, sites)).toBeNull();
    expect(own.locations).toEqual(["Tallinn"]);
  });

  it("keeps chosen Polish cities instead of widening the audience to Poland", () => {
    const polishSites = sites.filter((s) => s.country === "Poland");
    const cities = [...new Set(polishSites.map((s) => s.city))].slice(0, 2);
    const avatar = buildAudience({ customer: northstar, roles: ["Procurement manager"], locations: cities }, ds);
    expect(avatar.locations).toEqual(cities);
    expect(avatar.country).toBe("Poland");
    expect(audienceSiteScope(avatar, sites)).toEqual(polishSites.filter((s) => cities.includes(s.city)).map((s) => s.id));
    expect(audienceSiteScope(avatar, sites)?.length).toBeLessThan(polishSites.length);
  });
});
