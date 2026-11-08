/**
 * Weekly-update reminder cap.
 *
 * A reminder counts as *ignored* when it was sent for a given startup + person
 * and that person never published an update for that week. Once a person has
 * ignored this many reminders for one startup, the emails stop.
 */
export const IGNORED_REMINDER_CAP = 8;

type ReminderLog = { message_id: string; status: string };
type PublishedWeek = { week_of: string | null };

/**
 * Count distinct weeks whose reminder was sent but never answered with a
 * published update.
 *
 * `reminderPrefix` is the `weekly-update-reminder:<startupId>:<userId>:` part
 * of the logged message id; the week (YYYY-MM-DD) follows it.
 */
export function countIgnoredReminders(
  logRows: readonly ReminderLog[],
  publishedWeeks: readonly PublishedWeek[],
  reminderPrefix: string,
): number {
  const published = new Set(
    publishedWeeks.map((row) => String(row.week_of ?? "").slice(0, 10)),
  );
  const ignored = new Set(
    logRows
      .filter(
        (row) =>
          row.status === "sent" &&
          row.message_id.startsWith(reminderPrefix) &&
          !published.has(
            row.message_id.slice(reminderPrefix.length, reminderPrefix.length + 10),
          ),
      )
      .map((row) =>
        row.message_id.slice(reminderPrefix.length, reminderPrefix.length + 10),
      ),
  );
  return ignored.size;
}
