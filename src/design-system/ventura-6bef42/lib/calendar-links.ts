export type CalendarEvent = {
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  /** ISO start date-time */
  startsAt: string;
  /** Duration in minutes when no explicit end is given */
  durationMinutes?: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC basic format: 20260820T131500Z */
function toUtcStamp(d: Date) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function bounds(event: CalendarEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + (event.durationMinutes ?? 60) * 60_000);
  return { start, end };
}

function fullDescription(event: CalendarEvent) {
  return [event.description?.trim(), event.url?.trim()].filter(Boolean).join("\n\n");
}

/** Pre-filled Google Calendar event (the same trick Luma emails use). */
export function googleCalendarUrl(event: CalendarEvent) {
  const { start, end } = bounds(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
  });
  const details = fullDescription(event);
  if (details) params.set("details", details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Pre-filled Outlook / Office 365 web event. */
export function outlookCalendarUrl(event: CalendarEvent) {
  const { start, end } = bounds(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  const details = fullDescription(event);
  if (details) params.set("body", details);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Minimal RFC 5545 VEVENT for Apple Calendar / Outlook desktop. */
export function buildIcs(event: CalendarEvent, uid?: string) {
  const { start, end } = bounds(event);
  const details = fullDescription(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ventura//Program events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid ?? `${toUtcStamp(start)}-${Math.random().toString(36).slice(2)}@ventura`}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    details ? `DESCRIPTION:${escapeIcs(details)}` : null,
    event.location ? `LOCATION:${escapeIcs(event.location)}` : null,
    event.url ? `URL:${escapeIcs(event.url)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];
  return lines.join("\r\n");
}

export function downloadIcs(event: CalendarEvent, uid?: string) {
  const blob = new Blob([buildIcs(event, uid)], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${event.title.replace(/[^\w\-]+/g, "-").slice(0, 60) || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
