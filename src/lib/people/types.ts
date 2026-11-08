import { z } from "zod";
import { PRIORITY_KEYS, type PriorityKey } from "@/lib/engine/priorities";

/**
 * A person added through "New report for another person": the KAM gives any
 * mix of a LinkedIn link, a CRM extract, meeting notes and their own text;
 * the AI reads it, searches the web and returns a professional profile.
 */

export const PERSON_TEXT_LIMIT = 60_000;

export const personRequestSchema = z.object({
  company: z.object({
    name: z.string().trim().min(1).max(160),
    industry: z.string().trim().max(160),
    website: z.string().trim().max(300).nullable(),
    countries: z.array(z.string().trim().min(1).max(80)).max(60),
    cities: z.array(z.string().trim().min(1).max(80)).max(200),
  }),
  linkedin: z.string().trim().max(400).nullable(),
  /** The KAM's own words. */
  manual: z.string().max(PERSON_TEXT_LIMIT),
  /** Text read from uploaded files in the browser. */
  files: z
    .array(z.object({ name: z.string().trim().min(1).max(200), kind: z.enum(["crm", "notes"]), text: z.string().max(PERSON_TEXT_LIMIT) }))
    .max(6),
  topics: z.array(z.object({ id: z.string().max(60), question: z.string().max(200), about: z.string().max(300) })).max(20),
});

export type PersonRequest = z.infer<typeof personRequestSchema>;

export interface PersonSource {
  title: string;
  url: string;
}

export interface PersonResult {
  /** True when public information about this exact person was found on the web. */
  found: boolean;
  name: string;
  role: string;
  locations: string[];
  summary: string;
  interests: string[];
  wantsToSee: string[];
  weights: Record<PriorityKey, number>;
  recapTopics: string[];
  recapQuestions: Record<string, string>;
  /** Downscaled portrait as a data URL (null when none was found). */
  photo: string | null;
  photoSource: string | null;
  sources: PersonSource[];
}

export type PersonEvent =
  | { type: "reading" }
  | { type: "query"; query: string }
  | { type: "sources"; count: number }
  | { type: "writing" }
  | { type: "photo" }
  | { type: "result"; result: PersonResult }
  | { type: "error"; error: string };

export const PERSON_PRIORITIES = PRIORITY_KEYS;

/** True when the KAM gave at least one thing to work from. */
export function hasPersonInput(r: Pick<PersonRequest, "linkedin" | "manual" | "files">): boolean {
  return !!r.linkedin?.trim() || !!r.manual.trim() || r.files.some((f) => f.text.trim());
}

/** Accepts linkedin.com profile links only (with or without https://). */
export function normalizeLinkedIn(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    if (!/^\/(in|pub)\/[^/]+/i.test(u.pathname)) return null;
    u.protocol = "https:";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
