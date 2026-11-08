import type { Customer, Dataset } from "@/lib/data/types";
import { buildAudience, locationOptions } from "@/lib/avatar/audience";
import { EMPTY_PROFILE, type Avatar } from "@/lib/engine/avatars";
import { PRIORITY_KEYS, type Weights } from "@/lib/engine/priorities";
import { RECAP_TOPIC_CATALOG } from "@/lib/engine/recap";
import type { PersonRequest, PersonResult } from "./types";

/** Recap topics the AI may choose for questions 4 and 5. */
export function personTopics(): PersonRequest["topics"] {
  return RECAP_TOPIC_CATALOG.map((t) => ({ id: t.id, question: t.question, about: t.about }));
}

/** Company context sent with a person research request. */
export function personCompany(customer: Customer, ds: Dataset, website: string | null): PersonRequest["company"] {
  const opts = locationOptions(ds, customer.id);
  return {
    name: customer.name,
    industry: customer.industry,
    website,
    countries: opts.countries.map((c) => c.value).slice(0, 60),
    cities: opts.cities.map((c) => c.value).slice(0, 200),
  };
}

/** Keeps only locations where the company has sites, spelled as in the data. */
export function matchPersonLocations(found: string[], customer: Customer, ds: Dataset): string[] {
  const opts = locationOptions(ds, customer.id);
  const known = [...opts.countries, ...opts.cities].map((o) => o.value);
  const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const out: string[] = [];
  for (const f of found) {
    const hit = known.find((k) => norm(k) === norm(f));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  // Every location of the company means "all locations".
  return out.length === known.length ? [] : out;
}

/**
 * Turns a researched profile into a saved person. Role defaults (detail,
 * tone, units, rehearsal style) come from the same audience builder as the
 * studio; the AI's value weights, interests and two Recap questions are kept.
 */
export function personAvatar(result: PersonResult, ctx: { customer: Customer; dataset: Dataset; id: string; linkedin: string | null; now: string }): Avatar {
  const locations = matchPersonLocations(result.locations, ctx.customer, ctx.dataset);
  const base = buildAudience({ customer: ctx.customer, roles: [result.role], locations }, ctx.dataset);
  const weights = Object.fromEntries(PRIORITY_KEYS.map((k) => [k, Math.max(0, Math.min(3, Math.round(result.weights[k] ?? 0)))])) as Weights;
  const catalog = new Set(RECAP_TOPIC_CATALOG.map((t) => t.id));
  const recapTopics = result.recapTopics.filter((t) => catalog.has(t)).slice(0, 2);
  return {
    ...base,
    id: ctx.id,
    name: result.name.trim(),
    origin: "person",
    weights,
    // The AI's weights are the person's values; no interview profile overrides them.
    profile: { ...EMPTY_PROFILE },
    concerns: result.wantsToSee.length ? result.wantsToSee : base.concerns,
    photo: result.photo,
    photoSource: result.photoSource,
    wantsToSee: result.wantsToSee.slice(0, 3),
    interests: result.interests.slice(0, 6),
    summary: result.summary,
    linkedin: ctx.linkedin,
    sources: result.sources,
    recapTopics,
    recapQuestions: Object.fromEntries(Object.entries(result.recapQuestions).filter(([k]) => recapTopics.includes(k))),
    createdAt: ctx.now,
  };
}
