import { z } from "zod";
import { ARCHETYPE_IDS, type ArchetypeId, type Detail, type Tone } from "@/lib/engine/avatars";
import { PRIORITY_KEYS, type Weights } from "@/lib/engine/priorities";

/**
 * The avatar interview: the AI asks only what cannot be looked up on the web
 * (who, where, what they decide, what they are measured on, upcoming moments,
 * presentation style) and keeps a structured draft the operator sees filling in.
 */

export interface InterviewCompany {
  id: string;
  name: string;
  industry: string;
  segment: string;
  hqCountry: string;
  topics: string[];
  countries: Array<{ name: string; sites: number }>;
  synthetic: boolean;
}

export interface InterviewDraft {
  customerId: string | null;
  personName: string | null;
  role: string | null;
  /** Country name from the company's site countries, or "ALL". */
  country: string | null;
  archetype: ArchetypeId | null;
  decisions: string[];
  goals: string[];
  reporting: string[];
  moments: string[];
  avoid: string[];
  detail: Detail | null;
  tone: Tone | null;
  showMoney: boolean | null;
  skepticism: number | null;
  weights: Weights | null;
  concerns: string[];
  lookups: string[];
}

export const EMPTY_DRAFT: InterviewDraft = {
  customerId: null,
  personName: null,
  role: null,
  country: null,
  archetype: null,
  decisions: [],
  goals: [],
  reporting: [],
  moments: [],
  avoid: [],
  detail: null,
  tone: null,
  showMoney: null,
  skepticism: null,
  weights: null,
  concerns: [],
  lookups: [],
};

/** Parameters the interview must collect before research can run. */
export type RequiredParam = "company" | "role" | "location" | "decisions" | "goals";

export const REQUIRED_PARAMS: Array<{ key: RequiredParam; label: string }> = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "location", label: "Location" },
  { key: "decisions", label: "Decisions they own" },
  { key: "goals", label: "What they're measured on" },
];

export function missingParams(d: InterviewDraft): RequiredParam[] {
  const out: RequiredParam[] = [];
  if (!d.customerId) out.push("company");
  if (!d.role) out.push("role");
  if (!d.country) out.push("location");
  if (!d.decisions.length) out.push("decisions");
  if (!d.goals.length) out.push("goals");
  return out;
}

/** The interview never asks more than this many questions. */
export const MAX_INTERVIEW_QUESTIONS = 5;

/**
 * The avatar is saved (and research starts) without any confirmation step as
 * soon as every required item is known, or once the question limit is reached
 * and at least the company is known (archetype defaults fill the rest).
 */
export function shouldAutoSave(d: InterviewDraft, answers: number): boolean {
  if (!d.customerId) return false;
  return missingParams(d).length === 0 || answers >= MAX_INTERVIEW_QUESTIONS;
}

export interface InterviewMessage {
  role: "assistant" | "user";
  text: string;
}

export type InterviewTurn =
  | { ok: true; reply: string; quickReplies: string[]; draft: InterviewDraft; missing: RequiredParam[] }
  | { ok: false; error: string };

const t = (max: number) => z.string().max(max);

export const interviewInputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["assistant", "user"]), text: t(2500) }))
    .min(1)
    .max(40),
  companies: z
    .array(
      z.object({
        id: t(60),
        name: t(160),
        industry: t(100),
        segment: t(100),
        hqCountry: t(80),
        topics: z.array(t(80)).max(12),
        countries: z.array(z.object({ name: t(80), sites: z.number().int().min(0).max(100_000) })).max(40),
        synthetic: z.boolean(),
      }),
    )
    .min(1)
    .max(50),
  draft: z.object({
    customerId: t(60).nullable(),
    personName: t(80).nullable(),
    role: t(120).nullable(),
    country: t(80).nullable(),
    archetype: z.enum(ARCHETYPE_IDS as [ArchetypeId, ...ArchetypeId[]]).nullable(),
    decisions: z.array(t(300)).max(10),
    goals: z.array(t(300)).max(10),
    reporting: z.array(t(300)).max(10),
    moments: z.array(t(300)).max(10),
    avoid: z.array(t(300)).max(10),
    detail: z.enum(["headline", "balanced", "deep"]).nullable(),
    tone: z.enum(["executive", "operational", "technical"]).nullable(),
    showMoney: z.boolean().nullable(),
    skepticism: z.number().min(1).max(5).nullable(),
    weights: z.record(z.enum(PRIORITY_KEYS as [string, ...string[]]), z.number().min(0).max(3)).nullable(),
    concerns: z.array(t(300)).max(8),
    lookups: z.array(t(200)).max(12),
  }),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type InterviewInput = z.infer<typeof interviewInputSchema>;
