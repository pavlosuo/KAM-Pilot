import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const list = (n: number, max = 300) => z.array(text(max)).max(n);

/** Validated body of a research request (shared by the server route and tests). */
export const researchRequestSchema = z.object({
  topic: z.enum(["climate", "incentives", "circularity", "company"]),
  country: text(80).min(2),
  countryCode: z.string().trim().max(2),
  company: z.object({
    name: text(160).min(1),
    industry: text(100),
    segment: text(100),
    hqCountry: text(80),
    siteTypes: list(12, 80),
    sitesInScope: z.number().int().min(0).max(10_000),
    synthetic: z.boolean(),
  }),
  person: z.object({
    role: text(120).min(1),
    decisions: list(8),
    goals: list(8),
    reporting: list(8),
    moments: list(6),
  }),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
