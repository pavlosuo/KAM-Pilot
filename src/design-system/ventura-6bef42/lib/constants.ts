export const INDUSTRIES = [
  "AI / ML",
  "Fintech",
  "Healthtech",
  "Climate",
  "Devtools",
  "Consumer",
  "Enterprise SaaS",
  "Marketplace",
  "Hardware",
  "Education",
  "Biotech",
  "Other",
] as const;

export const STAGES = [
  "Idea",
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C+",
] as const;

export type Industry = (typeof INDUSTRIES)[number];
export type Stage = (typeof STAGES)[number];
