// Shared profile completeness scoring used on profile page and gating startup creation.
// Mirrors the inline logic in src/routes/_authenticated/founder-onboarding.tsx.

type Account = {
  photo_url?: string | null;
  headline?: string | null;
  city?: string | null;
  country?: string | null;
  about?: string | null;
} | null;

type ExpRow = {
  company?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string | null;
  logo_url?: string | null;
};

type EduRow = {
  school?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string | null;
  logo_url?: string | null;
};

export function computeProfileCompleteness(input: {
  account: Account;
  experiences: ExpRow[];
  educations: EduRow[];
  skills: string[];
}): number {
  const { account: a, experiences, educations, skills } = input;
  const about = (a?.about ?? "").trim();

  let score = 0;
  if (a?.photo_url) score += 10;
  if (a?.city?.trim()) score += 7;
  if (a?.country?.trim()) score += 3;
  if (a?.headline?.trim()) score += 15;

  // Experience: only the first card counts (18 max).
  // Logo counts if uploaded OR auto-fetched via logo.dev (company name present).
  const firstExp = experiences[0];
  if (firstExp) {
    score += 6;
    if (firstExp.start_date) score += 3;
    if (firstExp.end_date || firstExp.is_current) score += 3;
    if (firstExp.description?.trim()) score += 3;
    if (firstExp.logo_url || firstExp.company?.trim()) score += 3;
  }

  // Education: only the first card counts (13 max).
  const firstEdu = educations[0];
  if (firstEdu) {
    if (firstEdu.school?.trim()) score += 3;
    if (firstEdu.start_date) score += 3;
    if (firstEdu.end_date || firstEdu.is_current) score += 3;
    if (firstEdu.description?.trim()) score += 2;
    if (firstEdu.logo_url || firstEdu.school?.trim()) score += 2;
  }


  score += Math.min(skills.length, 3) * 5;
  if (about.length >= 200) score += 19;
  else if (about.length > 0) score += Math.round((about.length / 200) * 19);

  return Math.min(100, score);
}
