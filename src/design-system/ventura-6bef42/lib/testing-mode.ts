// Testing-mode override for weekly updates.
//
// The listed test accounts are allowed to submit multiple weekly updates
// back-to-back without waiting for the actual Monday–Sunday cycle. Each new
// submission is transparently mapped to a fresh, earlier week bucket so it
// doesn't collide with existing rows on (startup_id, week_of, author_id).
//
// Everywhere the rest of the app previously called `computeCurrentWeekStart`
// we call `resolveEffectiveWeekStart` instead — for normal users behavior is
// unchanged.

import { computeCurrentWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";

export const TESTING_MODE_EMAILS = new Set<string>([
  "keylon.main1337@gmail.com",
]);

export function isTestingModeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return TESTING_MODE_EMAILS.has(email.toLowerCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns the week_of bucket to use for the *next* weekly update by this user
// on this startup. In testing mode we walk backwards one week at a time until
// we find a bucket that this author has not yet published for.
export async function resolveEffectiveWeekStart(
  supabase: SB,
  startupId: string,
  userId: string,
  email: string | null | undefined,
): Promise<string | null> {
  const { data } = await supabase
    .from("startups")
    .select("published_at")
    .eq("id", startupId)
    .maybeSingle();
  const publishedAt = (data as { published_at: string | null } | null)?.published_at;
  const base = computeCurrentWeekStart(publishedAt);
  if (!base) return null;
  if (!isTestingModeEmail(email)) return base;

  // Fetch every existing (draft or published) row this author has for this
  // startup, then walk back one week at a time until we find a free bucket.
  const { data: rows } = await supabase
    .from("weekly_updates")
    .select("week_of, is_published")
    .eq("startup_id", startupId)
    .eq("author_id", userId);
  const publishedWeeks = new Set<string>();
  for (const r of ((rows as { week_of: string; is_published: boolean }[] | null) ?? [])) {
    if (r.is_published) publishedWeeks.add(r.week_of);
  }
  // If the current week hasn't been published yet, keep using it so the draft
  // flow behaves normally. Otherwise walk back.
  let candidate = base;
  let guard = 0;
  while (publishedWeeks.has(candidate) && guard < 520) {
    candidate = shiftDate(candidate, -7);
    guard += 1;
  }
  return candidate;
}
