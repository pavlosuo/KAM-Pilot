import type { Customer, Dataset, Site } from "@/lib/data/types";
import { EMPTY_PROFILE, ROLE_ARCHETYPES, archetypeLook, type ArchetypeId, type Avatar } from "@/lib/engine/avatars";
import { slugify } from "@/lib/engine/format";

/**
 * Studio step 2: who the KAM is meeting. The operator picks the company, the
 * person's role (suggested for that company, or typed) and the locations they
 * work in (from the data, or typed). Everything else is derived here
 * deterministically, so the same choice always produces the same report.
 */

export interface RoleSuggestion {
  role: string;
  archetype: ArchetypeId;
  /** Plain-language reason shown under the role. */
  hint: string;
  /** Among the most obvious people to meet at this company. */
  likely: boolean;
}

const ROLE_CATALOG: Record<string, { archetype: ArchetypeId; hint: string }> = {
  "Procurement manager": { archetype: "procurement", hint: "Owns the contract, price and renewal" },
  "CFO / Finance director": { archetype: "cfo", hint: "Looks at cost, savings and money tied up" },
  "Sustainability manager": { archetype: "sustainability", hint: "Reports CO₂, water and circularity" },
  "Quality & food safety manager": { archetype: "quality", hint: "Answers to hygiene audits" },
  "Hygiene & infection control lead": { archetype: "quality", hint: "Owns hygiene and traceability" },
  "Plant / production manager": { archetype: "operations", hint: "Needs garments ready for every shift" },
  "HSE & safety manager": { archetype: "operations", hint: "Responsible for protective workwear" },
  "Facility services manager": { archetype: "operations", hint: "Runs textile logistics on site" },
  "Operations director": { archetype: "operations", hint: "Runs the sites day to day" },
  "Managing director / CEO": { archetype: "ceo", hint: "Wants the big picture in one minute" },
};

const BY_INDUSTRY: Array<{ match: RegExp; roles: string[] }> = [
  {
    match: /food|beverage|bakery|dairy|meat/i,
    roles: ["Quality & food safety manager", "Procurement manager", "Plant / production manager", "Sustainability manager", "CFO / Finance director", "Managing director / CEO"],
  },
  {
    match: /manufactur|industr|engineering|automotive|metal|construction/i,
    roles: ["Procurement manager", "HSE & safety manager", "Plant / production manager", "CFO / Finance director", "Sustainability manager", "Managing director / CEO"],
  },
  {
    match: /health|hospital|care|medical|pharma/i,
    roles: ["Hygiene & infection control lead", "Facility services manager", "Procurement manager", "CFO / Finance director", "Sustainability manager", "Managing director / CEO"],
  },
];
const DEFAULT_ROLES = ["Procurement manager", "Operations director", "CFO / Finance director", "Sustainability manager", "Managing director / CEO", "Quality & food safety manager"];

/** The most obvious people a KAM meets at this company, in order. */
export function roleSuggestions(customer: Pick<Customer, "industry" | "priorityTopics">): RoleSuggestion[] {
  const base = BY_INDUSTRY.find((b) => b.match.test(customer.industry))?.roles ?? DEFAULT_ROLES;
  // A company that names cost or sustainability topics moves that buyer forward.
  const topics = customer.priorityTopics.join(" ").toLowerCase();
  const boost = (role: string) =>
    (/cost|utili[sz]ation|price/.test(topics) && /procurement|cfo/i.test(role) ? -1 : 0) + (/scope|carbon|co2|emission/.test(topics) && /sustainab/i.test(role) ? -1 : 0);
  const ordered = base.map((r, i) => ({ r, i: i + boost(r) * 1.5 })).sort((a, b) => a.i - b.i).map((x) => x.r);
  return ordered.map((role, i) => ({ role, ...ROLE_CATALOG[role], likely: i < 3 }));
}

const ARCHETYPE_RULES: Array<{ id: ArchetypeId; match: RegExp }> = [
  { id: "cfo", match: /\b(cfo|finance|financial|controller|treasur|accounting)\b/i },
  { id: "sustainability", match: /sustainab|esg|environment|csr|climate|carbon/i },
  { id: "quality", match: /quality|hygien|food safety|infection|\bqa\b|audit|compliance/i },
  { id: "procurement", match: /procure|purchas|sourcing|buyer|category|supply/i },
  { id: "ceo", match: /\b(ceo|managing director|general manager|country manager|president|owner|chief executive)\b/i },
  { id: "operations", match: /operation|plant|production|site|facilit|logistic|hse|safety|maintenance|shift|warehouse|coo/i },
];

/** Maps any typed role to the closest archetype (weights, tone, money focus). */
export function archetypeForRole(role: string): ArchetypeId {
  const known = ROLE_CATALOG[role.trim()];
  if (known) return known.archetype;
  return ARCHETYPE_RULES.find((r) => r.match.test(role))?.id ?? "kam-balanced";
}

export interface LocationOption {
  value: string;
  kind: "country" | "city";
  country: string;
  sites: number;
}

/** Countries and cities defined for the company's sites in the uploaded data. */
export function locationOptions(ds: Dataset, customerId: string): { countries: LocationOption[]; cities: LocationOption[] } {
  const sites = ds.sites.filter((s) => s.customerId === customerId);
  const byCountry = new Map<string, number>();
  const byCity = new Map<string, { country: string; n: number }>();
  for (const s of sites) {
    byCountry.set(s.country, (byCountry.get(s.country) ?? 0) + 1);
    if (s.city) {
      const k = `${s.city}|${s.country}`;
      byCity.set(k, { country: s.country, n: (byCity.get(k)?.n ?? 0) + 1 });
    }
  }
  const countries = [...byCountry.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, sites]) => ({ value, kind: "country" as const, country: value, sites }));
  const order = new Map(countries.map((c, i) => [c.value, i]));
  const cities = [...byCity.entries()]
    .map(([k, v]) => ({ value: k.split("|")[0], kind: "city" as const, country: v.country, sites: v.n }))
    .sort((a, b) => (order.get(a.country) ?? 0) - (order.get(b.country) ?? 0) || a.value.localeCompare(b.value));
  return { countries, cities };
}

const norm = (v: string) => v.trim().toLocaleLowerCase();

/** Sites matched by the chosen locations (country, city or site name); unmatched entries are kept as labels. */
export function resolveLocations(locations: string[], sites: Site[]): { siteIds: string[]; countries: string[]; unmatched: string[] } {
  const ids = new Set<string>();
  const unmatched: string[] = [];
  for (const loc of locations) {
    const n = norm(loc);
    if (!n) continue;
    const hit = sites.filter((s) => norm(s.country) === n || norm(s.city) === n || norm(s.name) === n || norm(s.id) === n);
    if (hit.length) hit.forEach((s) => ids.add(s.id));
    else unmatched.push(loc.trim());
  }
  const matched = sites.filter((s) => ids.has(s.id));
  return { siteIds: matched.map((s) => s.id), countries: [...new Set(matched.map((s) => s.country))], unmatched };
}

/**
 * Site scope of a report audience. Locations win over the legacy single
 * country; when nothing in the data matches, the whole company is shown.
 */
export function audienceSiteScope(a: Pick<Avatar, "country" | "locations">, sites: Site[]): string[] | null {
  if (a.locations?.length) {
    const r = resolveLocations(a.locations, sites);
    return r.siteIds.length ? r.siteIds : null;
  }
  if (a.country && a.country !== "ALL") return sites.filter((s) => s.country === a.country).map((s) => s.id);
  return null;
}

export interface AudienceChoice {
  customer: Customer;
  roles: string[];
  locations: string[];
}

/** Stable id: choosing the same company, roles and locations again reuses the saved audience and its research. */
export function audienceId(c: AudienceChoice): string {
  const roles = c.roles.map(slugify).sort().join("+") || "kam";
  const locs = c.locations.map(slugify).sort().join("+") || "all";
  return `aud-${slugify(c.customer.id)}-${roles}-${locs}`.slice(0, 120);
}

/** Builds the report audience from the studio choices (archetype defaults fill tone, weights and focus). */
export function buildAudience(c: AudienceChoice, ds: Dataset, previous?: Avatar | null): Avatar {
  const roles = c.roles.map((r) => r.trim()).filter(Boolean);
  const role = roles.join(" & ") || "Key account review";
  const archetype = archetypeForRole(roles[0] ?? "");
  const arch = ROLE_ARCHETYPES[archetype];
  const look = archetypeLook(archetype);
  const sites = ds.sites.filter((s) => s.customerId === c.customer.id);
  const locations = c.locations.map((l) => l.trim()).filter(Boolean);
  const resolved = resolveLocations(locations, sites);
  return {
    id: previous?.id ?? audienceId(c),
    // The studio only knows the role; the person stays "Anonym" until the KAM enters a name.
    name: previous ? previous.name : "",
    role,
    origin: "studio",
    icon: look.icon,
    hue: look.hue,
    weights: arch.weights,
    detail: arch.detail,
    tone: arch.tone,
    units: arch.units,
    showMoney: arch.showMoney,
    skepticism: arch.skepticism,
    concerns: arch.concerns,
    preset: false,
    customerId: c.customer.id,
    country: resolved.countries.length === 1 ? resolved.countries[0] : null,
    locations,
    archetype,
    profile: { ...EMPTY_PROFILE, ...(previous?.profile ?? {}) },
    brief: previous?.brief ?? null,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    photo: previous?.photo ?? null,
    photoSource: previous?.photoSource ?? null,
  };
}

/** Archetypes of every chosen role, first role first (the Recap's role questions use them). */
export function audienceArchetypes(a: Pick<Avatar, "role" | "archetype">): ArchetypeId[] {
  const parts = a.role.split(/\s*&\s*|\s*\/\s*(?=[A-Z])/).filter(Boolean);
  const ids = parts.map(archetypeForRole);
  if (a.archetype && !ids.includes(a.archetype)) ids.unshift(a.archetype);
  return [...new Set(ids)];
}
