// Shared week-bounds computation. Every weekly update deadline is Sunday (UTC).
// First week runs from the startup's published_at date to that week's Sunday.
// Subsequent weeks run Monday → Sunday.

function startOfUTCDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

// Sunday on or after d. JS getUTCDay(): Sunday = 0.
function nextOrSameSunday(d: Date): Date {
  const day = d.getUTCDay();
  const delta = (7 - day) % 7;
  return addDays(d, delta);
}

export function computeCurrentWeekBounds(
  publishedAt: string | null | undefined,
): { weekStart: string; weekEnd: string } | null {
  if (!publishedAt) return null;
  const pub = startOfUTCDay(new Date(publishedAt));
  const today = startOfUTCDay(new Date());
  const ref = today < pub ? pub : today;
  const weekEnd = nextOrSameSunday(ref);
  const monday = addDays(weekEnd, -6);
  const weekStart = pub > monday ? pub : monday;
  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
  };
}

export function computeCurrentWeekStart(
  publishedAt: string | null | undefined,
): string | null {
  return computeCurrentWeekBounds(publishedAt)?.weekStart ?? null;
}

// Start of the next week = Monday after the current week's Sunday.
export function computeNextWeekStart(
  publishedAt: string | null | undefined,
): string | null {
  const cur = computeCurrentWeekBounds(publishedAt);
  if (!cur) return null;
  const sunday = new Date(cur.weekEnd + "T00:00:00Z");
  return addDays(sunday, 1).toISOString().slice(0, 10);
}
