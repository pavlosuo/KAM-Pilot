import { sendTemplateEmail } from "@/design-system/ventura-6bef42/lib/email-templates/send-email";

const SITE_NAME = "Ventura";
const SITE_URL = "https://venturafund.eu";


export type InboxEmailPayload = {
  /** Stable id of the source object, used for idempotency. */
  eventId: string;
  kindLabel: string;
  title: string;
  body: string;
  context?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
};

/**
 * Emails an inbox item to the given app users.
 * Respects the profiles.email_notifications preference, the suppression list
 * and per-(event, user) idempotency. Never throws — email failures must not
 * break the action that produced the inbox item.
 */
export async function sendInboxEmails(userIds: string[], item: InboxEmailPayload) {
  try {
    const ids = Array.from(new Set(userIds.filter(Boolean)));
    if (!ids.length) return;

    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const [{ data: prefs }, { data: accounts }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email_notifications, full_name").in("id", ids),
      supabaseAdmin.from("founder_accounts").select("user_id, email, full_name").in("user_id", ids),
    ]);

    const optedOut = new Set(
      ((prefs ?? []) as Array<{ id: string; email_notifications: boolean | null }>)
        .filter((p) => p.email_notifications === false)
        .map((p) => p.id),
    );
    const nameById = new Map(
      ((prefs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
        p.id,
        p.full_name,
      ]),
    );

    for (const acc of (accounts ?? []) as Array<{
      user_id: string;
      email: string | null;
      full_name: string | null;
    }>) {
      const email = acc.email?.trim().toLowerCase();
      if (!email || optedOut.has(acc.user_id)) continue;

      try {
        const idempotencyKey = `inbox:${item.eventId}:${acc.user_id}`;
        const { data: alreadySent } = await supabaseAdmin
          .from("email_send_log")
          .select("id")
          .eq("message_id", idempotencyKey)
          .limit(1)
          .maybeSingle();
        if (alreadySent) continue;

        const templateData = {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName: nameById.get(acc.user_id) ?? acc.full_name ?? undefined,
          kindLabel: item.kindLabel,
          title: item.title,
          body: item.body,
          context: item.context ?? null,
          linkUrl: item.linkUrl ?? null,
          linkLabel: item.linkLabel ?? "Open document",
        };

        try {
          const result = await sendTemplateEmail("inbox-item", email, {
            templateData,
            idempotencyKey,
          });
          const { error: logErr } = await supabaseAdmin.from("email_send_log").insert({
            message_id: idempotencyKey,
            template_name: "inbox-item",
            recipient_email: email,
            status: result.sent ? "sent" : "suppressed",
          });
          if (logErr) console.error("[inbox-email] log write failed", logErr);
        } catch (sendErr) {
          const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
          const { error: logErr } = await supabaseAdmin.from("email_send_log").insert({
            message_id: idempotencyKey,
            template_name: "inbox-item",
            recipient_email: email,
            status: "failed",
            error_message: message,
          });
          if (logErr) console.error("[inbox-email] log write failed", logErr);
          console.error("[inbox-email] send failed", { email }, sendErr);
        }

      } catch (perUserErr) {
        console.error("[inbox-email] per-user failure", acc.user_id, perUserErr);
      }
    }
  } catch (err) {
    console.error("[inbox-email] fatal", err);
  }
}

/** Owner + members of a startup. */
export async function startupTeamUserIds(startupId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const [{ data: s }, { data: members }] = await Promise.all([
    supabaseAdmin.from("startups").select("owner_id").eq("id", startupId).maybeSingle(),
    supabaseAdmin.from("startup_members").select("user_id").eq("startup_id", startupId),
  ]);
  const ids = new Set<string>();
  const owner = (s as { owner_id: string } | null)?.owner_id;
  if (owner) ids.add(owner);
  for (const m of (members ?? []) as Array<{ user_id: string }>) ids.add(m.user_id);
  return Array.from(ids);
}

/** Everyone on approved startups in a program. */
export async function programMemberUserIds(programId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("program_startups")
    .select("startup_id, status")
    .eq("program_id", programId);
  const startupIds = ((rows ?? []) as Array<{ startup_id: string; status: string | null }>)
    .filter((r) => r.status !== "rejected")
    .map((r) => r.startup_id);
  if (!startupIds.length) return [];
  const [{ data: owners }, { data: members }] = await Promise.all([
    (await import("@/design-system/ventura-6bef42/integrations/supabase/client.server")).supabaseAdmin
      .from("startups")
      .select("owner_id")
      .in("id", startupIds),
    (await import("@/design-system/ventura-6bef42/integrations/supabase/client.server")).supabaseAdmin
      .from("startup_members")
      .select("user_id")
      .in("startup_id", startupIds),
  ]);
  const ids = new Set<string>();
  for (const o of (owners ?? []) as Array<{ owner_id: string }>) ids.add(o.owner_id);
  for (const m of (members ?? []) as Array<{ user_id: string }>) ids.add(m.user_id);
  return Array.from(ids);
}

export async function programName(programId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("programs")
    .select("name")
    .eq("id", programId)
    .maybeSingle();
  return (data as { name: string } | null)?.name ?? null;
}

/**
 * Program-related emails (challenge reminders, program inbox messages, lead
 * announcements, etc.). Enabled: inbox items are created in-app and also
 * delivered by email.
 */
export const PROGRAM_EMAILS_ENABLED = true;

/** Program-scoped wrapper around sendInboxEmails. */
export async function sendProgramInboxEmails(
  userIds: string[],
  item: InboxEmailPayload,
) {
  if (!PROGRAM_EMAILS_ENABLED) return;
  await sendInboxEmails(userIds, item);
}
