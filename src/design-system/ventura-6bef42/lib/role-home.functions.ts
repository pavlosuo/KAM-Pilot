import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export type RoleHomeRole = "investor" | "mentor";

export type StartupMatch = {
  id: string;
  startupId: string;
  rank: number;
  score: number;
  reasons: string[];
  generatedAt: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  stage: string | null;
  industry: string | null;
  industryTags: string[];
  businessModels: string[];
  location: string | null;
  ownerId: string;
  pitchVideoUid: string | null;
  saved: boolean;
};

const roleSchema = z.enum(["investor", "mentor"]);

async function assertRole(
  // The authenticated middleware supplies the generated database client.
  // Keep this small guard client-agnostic so it can be shared by these functions.
  supabase: any,
  userId: string,
  role: RoleHomeRole,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (!data) throw new Error(`Your ${role} role is not active on this account.`);
}

export const getRoleHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: roleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, data.role);
    const { loadRoleHome } = await import("@/design-system/ventura-6bef42/lib/role-home.server");
    return loadRoleHome(context.userId, data.role, false);
  });

export const refreshRoleHomeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: roleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, data.role);
    const { loadRoleHome } = await import("@/design-system/ventura-6bef42/lib/role-home.server");
    return loadRoleHome(context.userId, data.role, true);
  });

export const sendStartupFounderMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ role: roleSchema, startupId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, context.userId, data.role);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: startup } = await supabaseAdmin
      .from("startups")
      .select("id, owner_id, is_published, hidden_from_discovery, is_paused")
      .eq("id", data.startupId)
      .maybeSingle();
    if (!startup || !startup.is_published || startup.hidden_from_discovery || startup.is_paused) {
      throw new Error("This startup is not available for messaging.");
    }
    const { startupTeamUserIds, sendInboxEmails } = await import("@/design-system/ventura-6bef42/lib/inbox-email.server");
    const teamIds = (await startupTeamUserIds(startup.id)).filter((id) => id !== context.userId);
    const recipients = teamIds.length ? teamIds : [startup.owner_id];

    const { data: inserted, error } = await supabaseAdmin
      .from("messages")
      .insert(
        recipients.map((recipientId) => ({
          startup_id: startup.id,
          sender_id: context.userId,
          recipient_id: recipientId,
           sender_role: data.role,
          body: data.body,
          is_private: true,
        })),
      )
      .select("id");
    if (error) throw new Error(error.message);

    try {
      const [{ data: startupRow }, { data: sender }] = await Promise.all([
        supabaseAdmin.from("startups").select("name").eq("id", startup.id).maybeSingle(),
        supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
      ]);
      const eventId = (inserted as Array<{ id: string }> | null)?.[0]?.id ?? `${startup.id}-${Date.now()}`;
      await sendInboxEmails(recipients, {
        eventId: `message-${eventId}`,
        kindLabel: "Message",
        title: `${(sender as { full_name: string | null } | null)?.full_name ?? "Someone"} sent you a message on Ventura`,
        body: data.body,
        context: (startupRow as { name: string } | null)?.name ?? null,
      });
    } catch (e) {
      console.error("[sendStartupFounderMessage] inbox email failed", e);
    }

    return { sent: true, recipients: recipients.length };
  });