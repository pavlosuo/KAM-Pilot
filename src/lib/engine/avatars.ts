import type { RegulatoryBrief } from "@/lib/regulation/types";
import { ZERO_WEIGHTS, type PriorityKey, type Weights } from "./priorities";

/**
 * Stakeholder avatars (organizer feedback): the same customer is reviewed by
 * people who value different outputs. An avatar is created by the operator
 * through the AI interview, carries the person's company, location, goals and
 * researched country rules, and re-orders and re-words the dashboard, the AI
 * narrative, the exported review and the rehearsal persona.
 */

export type Detail = "headline" | "balanced" | "deep";
export type Tone = "executive" | "operational" | "technical";
export type AvatarIcon = "briefcase" | "leaf" | "factory" | "shield" | "coins" | "crown" | "users" | "flask";

/** What the interview learned that cannot be looked up on the web. */
export interface AvatarProfile {
  /** Decisions the person owns or approves. */
  decisions: string[];
  /** What they are measured on - targets with numbers and dates where given. */
  goals: string[];
  /** Reporting duties (CSRD/ESRS, SBTi, CDP, ISO 14001, BRCGS …). */
  reporting: string[];
  /** Upcoming moments: contract renewal, budget round, audit, tender. */
  moments: string[];
  /** Things to leave out or handle carefully. */
  avoid: string[];
  /** Planned web lookups the interviewer announced. */
  lookups: string[];
}

export interface Avatar {
  id: string;
  name: string;
  role: string;
  icon: AvatarIcon;
  hue: AvatarHue;
  weights: Weights;
  detail: Detail;
  tone: Tone;
  units: { co2: "kg" | "t"; water: "L" | "m3" };
  showMoney: boolean;
  /** 1 friendly … 5 tough - used by the boardroom rehearsal. */
  skepticism: number;
  /** What this person typically asks in a review. */
  concerns: string[];
  preset?: boolean;
  customerId?: string | null;
  /** Country the person operates in; null = several or all of the company's countries. */
  country?: string | null;
  /** Locations chosen in the studio (countries, cities or the operator's own entries); empty = all. */
  locations?: string[];
  archetype?: ArchetypeId;
  profile?: AvatarProfile;
  /** Web-researched country rules, incentives and commitments. */
  brief?: RegulatoryBrief | null;
  createdAt?: string;
  /** How the person was added: in the report studio or through the People pop-up. */
  origin?: "studio" | "person";
  /** Portrait found on the web for the person's name (downscaled data URL, browser-local). */
  photo?: string | null;
  /** Page the portrait was found on. */
  photoSource?: string | null;
  /** Three short things this person wants to see in the report. */
  wantsToSee?: string[];
  /** Key interests found in the person's material and on the web. */
  interests?: string[];
  /** One line on who the person is. */
  summary?: string;
  /** LinkedIn profile given by the KAM. */
  linkedin?: string | null;
  /** Public pages the person research relied on. */
  sources?: Array<{ title: string; url: string }>;
  /** Recap topic ids chosen for questions 4 and 5 (in order). */
  recapTopics?: string[];
  /** The person's own wording of those questions, by topic id. */
  recapQuestions?: Record<string, string>;
}

/** The person's name, or "" when the KAM has not entered one. */
export function personName(a: Pick<Avatar, "name" | "role">): string {
  const n = a.name?.trim() ?? "";
  return n && n !== a.role.trim() ? n : "";
}

/** Name shown on people cards: the entered name, or "Anonym". */
export function peopleLabel(a: Pick<Avatar, "name" | "role">): string {
  return personName(a) || "Anonym";
}

/** Short label for headers and decks: the name when known, otherwise the role. */
export function audienceLabel(a: Pick<Avatar, "name" | "role">): string {
  return personName(a) || a.role;
}

export type ArchetypeId = "kam-balanced" | "cfo" | "sustainability" | "operations" | "quality" | "ceo" | "procurement";

export const EMPTY_PROFILE: AvatarProfile = { decisions: [], goals: [], reporting: [], moments: [], avoid: [], lookups: [] };

/** Human label for an avatar's location. */
export function avatarLocation(a: Pick<Avatar, "country" | "locations">): string {
  if (a.locations?.length) return a.locations.length > 3 ? `${a.locations.slice(0, 2).join(", ")} +${a.locations.length - 2}` : a.locations.join(", ");
  return a.country ? a.country : "All locations";
}

export type AvatarHue = "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan" | "orange" | "slate";

export const AVATAR_HUES: AvatarHue[] = ["blue", "emerald", "amber", "rose", "violet", "cyan", "orange", "slate"];

const w = (p: Partial<Record<PriorityKey, number>>): Weights => ({ ...ZERO_WEIGHTS, ...p });

export const PRESET_AVATARS: Avatar[] = [
  {
    id: "kam-balanced",
    name: "Annual review (balanced)",
    role: "Key account manager",
    icon: "users",
    hue: "slate",
    weights: w({ water: 1, emissions: 1, cost: 1, circularity: 1, service: 1, hygiene: 1, improvement: 2 }),
    detail: "balanced",
    tone: "executive",
    units: { co2: "t", water: "m3" },
    showMoney: true,
    skepticism: 2,
    concerns: ["What did we get for the contract?", "What should we change next year?"],
    preset: true,
  },
  {
    id: "cfo",
    name: "Finance director",
    role: "CFO",
    icon: "coins",
    hue: "amber",
    weights: w({ cost: 3, service: 1, improvement: 2, evidence: 1 }),
    detail: "headline",
    tone: "executive",
    units: { co2: "t", water: "m3" },
    showMoney: true,
    skepticism: 4,
    concerns: ["Are we paying for garments nobody uses?", "Show me the money behind the green numbers.", "What does a cheaper alternative really cost?"],
    preset: true,
  },
  {
    id: "sustainability",
    name: "Sustainability manager",
    role: "Head of Sustainability",
    icon: "leaf",
    hue: "emerald",
    weights: w({ emissions: 3, water: 2, circularity: 3, evidence: 3 }),
    detail: "deep",
    tone: "technical",
    units: { co2: "kg", water: "L" },
    showMoney: false,
    skepticism: 4,
    concerns: ["Which numbers can I put in our Scope 3 disclosure?", "Compared to what baseline?", "How uncertain is the repair handprint?"],
    preset: true,
  },
  {
    id: "operations",
    name: "Operations director",
    role: "Site & production operations",
    icon: "factory",
    hue: "blue",
    weights: w({ service: 3, hygiene: 2, cost: 1, improvement: 2 }),
    detail: "balanced",
    tone: "operational",
    units: { co2: "t", water: "m3" },
    showMoney: false,
    skepticism: 3,
    concerns: ["Which sites keep raising service requests?", "Are garments there when shifts start?", "Who fixes late deliveries?"],
    preset: true,
  },
  {
    id: "quality",
    name: "Quality & hygiene lead",
    role: "Food safety / QA",
    icon: "shield",
    hue: "rose",
    weights: w({ hygiene: 3, service: 2, evidence: 2 }),
    detail: "deep",
    tone: "operational",
    units: { co2: "t", water: "m3" },
    showMoney: false,
    skepticism: 4,
    concerns: ["Are coats really washed as often as our hygiene plan says?", "Can we trace a garment if an auditor asks?", "Which sites are at risk?"],
    preset: true,
  },
  {
    id: "ceo",
    name: "Managing director",
    role: "CEO / country manager",
    icon: "crown",
    hue: "violet",
    weights: w({ cost: 2, emissions: 2, service: 1, improvement: 3 }),
    detail: "headline",
    tone: "executive",
    units: { co2: "t", water: "m3" },
    showMoney: true,
    skepticism: 3,
    concerns: ["In one minute: is this partnership working?", "What are the three things we should decide today?"],
    preset: true,
  },
  {
    id: "procurement",
    name: "Procurement manager",
    role: "Category / procurement manager",
    icon: "briefcase",
    hue: "cyan",
    weights: w({ cost: 3, service: 2, evidence: 2, circularity: 1 }),
    detail: "balanced",
    tone: "operational",
    units: { co2: "t", water: "m3" },
    showMoney: true,
    skepticism: 4,
    concerns: ["Which contract terms should change at renewal?", "Can you prove the service levels you promise?", "What do we pay for that we do not use?"],
    preset: true,
  },
];

/**
 * Neutral lens used before any avatar exists. Not a stakeholder - the
 * operator creates real avatars through the interview.
 */
export const NEUTRAL_LENS: Avatar = { ...PRESET_AVATARS[0], name: "Neutral review", role: "No avatar selected" };

/** Role archetypes the interview starts from (weights, tone and detail defaults). */
export const ROLE_ARCHETYPES: Record<ArchetypeId, Avatar> = Object.fromEntries(PRESET_AVATARS.map((a) => [a.id, a])) as Record<ArchetypeId, Avatar>;

export const ARCHETYPE_IDS = Object.keys(ROLE_ARCHETYPES) as ArchetypeId[];

const ARCHETYPE_LOOK: Record<ArchetypeId, { icon: AvatarIcon; hue: AvatarHue }> = {
  "kam-balanced": { icon: "users", hue: "slate" },
  cfo: { icon: "coins", hue: "amber" },
  sustainability: { icon: "leaf", hue: "emerald" },
  operations: { icon: "factory", hue: "blue" },
  quality: { icon: "shield", hue: "rose" },
  ceo: { icon: "crown", hue: "violet" },
  procurement: { icon: "briefcase", hue: "cyan" },
};

export function archetypeLook(id: ArchetypeId | undefined | null) {
  return ARCHETYPE_LOOK[id ?? "kam-balanced"] ?? ARCHETYPE_LOOK["kam-balanced"];
}

export function newAvatar(): Avatar {
  return {
    id: `custom-${Math.random().toString(36).slice(2, 9)}`,
    name: "New stakeholder",
    role: "Role at the customer",
    icon: "briefcase",
    hue: "cyan",
    weights: w({ water: 1, emissions: 1, cost: 1, service: 1 }),
    detail: "balanced",
    tone: "executive",
    units: { co2: "t", water: "m3" },
    showMoney: true,
    skepticism: 3,
    concerns: [],
    preset: false,
    customerId: null,
  };
}
