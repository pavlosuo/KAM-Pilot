import type { Dataset } from "@/lib/data/types";
import { EMPTY_PROFILE, ROLE_ARCHETYPES, archetypeLook, type Avatar } from "@/lib/engine/avatars";
import { RESEARCH_TOPICS, countryCode, type ResearchRequest } from "@/lib/regulation/types";
import type { InterviewCompany, InterviewDraft } from "./interview-types";
import { audienceSiteScope } from "./audience";

/** Companies (with their site countries) offered to the interview - only what the uploaded data contains. */
export function interviewCompanies(ds: Dataset): InterviewCompany[] {
  return ds.customers.map((c) => {
    const sites = ds.sites.filter((s) => s.customerId === c.id);
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.country, (counts.get(s.country) ?? 0) + 1);
    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      segment: c.segment,
      hqCountry: c.hqCountry,
      topics: c.priorityTopics,
      countries: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, sites: n })),
      synthetic: /synthetic/i.test(c.status),
    };
  });
}

/** Turns a completed interview draft into a stored avatar (archetype defaults fill any gaps). */
export function draftToAvatar(d: InterviewDraft, previous?: Avatar | null): Avatar {
  const arch = ROLE_ARCHETYPES[d.archetype ?? "kam-balanced"];
  const look = archetypeLook(d.archetype);
  const role = d.role?.trim() || arch.role;
  return {
    id: previous?.id ?? `avatar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: d.personName?.trim() || role,
    role,
    icon: previous?.icon ?? look.icon,
    hue: previous?.hue ?? look.hue,
    weights: d.weights ?? arch.weights,
    detail: d.detail ?? arch.detail,
    tone: d.tone ?? arch.tone,
    units: previous?.units ?? arch.units,
    showMoney: d.showMoney ?? arch.showMoney,
    skepticism: d.skepticism ?? arch.skepticism,
    concerns: d.concerns.length ? d.concerns : arch.concerns,
    preset: false,
    customerId: d.customerId,
    country: d.country && d.country !== "ALL" ? d.country : null,
    archetype: d.archetype ?? "kam-balanced",
    profile: {
      ...EMPTY_PROFILE,
      decisions: d.decisions,
      goals: d.goals,
      reporting: d.reporting,
      moments: d.moments,
      avoid: d.avoid,
      lookups: d.lookups,
    },
    brief: previous?.brief ?? null,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
  };
}

/** Rebuilds an interview draft from a saved avatar (to re-open or refine it). */
export function avatarToDraft(a: Avatar): InterviewDraft {
  return {
    customerId: a.customerId ?? null,
    personName: a.name !== a.role ? a.name : null,
    role: a.role,
    country: a.country ?? "ALL",
    archetype: a.archetype ?? null,
    decisions: a.profile?.decisions ?? [],
    goals: a.profile?.goals ?? [],
    reporting: a.profile?.reporting ?? [],
    moments: a.profile?.moments ?? [],
    avoid: a.profile?.avoid ?? [],
    detail: a.detail,
    tone: a.tone,
    showMoney: a.showMoney,
    skepticism: a.skepticism,
    weights: a.weights,
    concerns: a.concerns,
    lookups: a.profile?.lookups ?? [],
  };
}

/** Jurisdiction researched for an avatar: their country, or the company's HQ when they cover all countries. */
export function researchCountry(a: Avatar, ds: Dataset): string {
  if (a.country) return a.country;
  const sites = ds.sites.filter((s) => s.customerId === a.customerId);
  const scope = audienceSiteScope(a, sites);
  if (scope) {
    const counts = new Map<string, number>();
    for (const s of sites) if (scope.includes(s.id)) counts.set(s.country, (counts.get(s.country) ?? 0) + 1);
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
    if (top) return top[0];
  }
  return ds.customers.find((c) => c.id === a.customerId)?.hqCountry || "Finland";
}

export function researchRequests(a: Avatar, ds: Dataset, today = new Date()): ResearchRequest[] {
  const c = ds.customers.find((x) => x.id === a.customerId);
  const country = researchCountry(a, ds);
  const all = ds.sites.filter((s) => s.customerId === a.customerId);
  const scope = audienceSiteScope(a, all);
  const sites = scope ? all.filter((s) => scope.includes(s.id)) : all;
  const p = a.profile ?? EMPTY_PROFILE;
  return RESEARCH_TOPICS.map((topic) => ({
    topic,
    country,
    countryCode: countryCode(country),
    company: {
      name: c?.name ?? "Customer",
      industry: c?.industry ?? "",
      segment: c?.segment ?? "",
      hqCountry: c?.hqCountry ?? "",
      siteTypes: [...new Set(sites.map((s) => s.siteType).filter(Boolean))].slice(0, 12),
      sitesInScope: sites.length,
      synthetic: /synthetic/i.test(c?.status ?? ""),
    },
    person: { role: a.role, decisions: p.decisions, goals: p.goals, reporting: p.reporting, moments: p.moments },
    today: today.toISOString().slice(0, 10),
  }));
}
