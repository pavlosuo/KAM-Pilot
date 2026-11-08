import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeProfileCompleteness } from "@/design-system/ventura-6bef42/lib/profile-completeness";

const SITE_NAME = "Ventura";
const SITE_URL = "https://venturafund.eu";
const SENDER_DOMAIN = "notify.venturafund.eu";
const FROM_DOMAIN = "notify.venturafund.eu";
const FROM_NAME = "Ventura";

const MIN_INVITE_COMPLETENESS = 80;
const TEAM_MEMBER_LIMIT = 6;

async function computeMyCompleteness(admin: unknown, userId: string): Promise<number> {
  const a = admin as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          order: (k: string, opts: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
      };
    };
  };
  const [{ data: account }, { data: exps }, { data: edus }, { data: skillsRows }] = await Promise.all([
    a.from("founder_accounts").select("photo_url, headline, city, country, about").eq("user_id", userId).maybeSingle(),
    a.from("founder_experiences").select("company, start_date, end_date, is_current, description, logo_url").eq("user_id", userId).order("sort_order", { ascending: true }),
    a.from("founder_education").select("school, start_date, end_date, description, logo_url").eq("user_id", userId).order("sort_order", { ascending: true }),
    a.from("founder_skills").select("name").eq("user_id", userId).order("sort_order", { ascending: true }),
  ]);
  const skills = ((skillsRows as { name: string }[] | null) ?? []).map((s) => s.name).filter(Boolean);
  return computeProfileCompleteness({
    account: (account as never) ?? null,
    experiences: (exps as never[]) ?? [],
    educations: (edus as never[]) ?? [],
    skills,
  });
}


async function assertOwner(
  supabase: { from: (t: string) => unknown },
  startupId: string,
  userId: string,
): Promise<{ name: string }> {
  const q = supabase.from("startups") as unknown as {
    select: (s: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { id: string; name: string } | null; error: unknown }>;
        };
      };
    };
  };
  const { data, error } = await q.select("id, name").eq("id", startupId).eq("owner_id", userId).maybeSingle();
  if (error) throw error as Error;
  if (!data) throw new Error("Startup not found or not owned by current user");
  return { name: data.name };
}

// -------- list --------

export const listStartupTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Must be owner OR existing member to view.
    const { data: ownerRow } = await supabase
      .from("startups")
      .select("id")
      .eq("id", data.startupId)
      .eq("owner_id", userId)
      .maybeSingle();
    const isOwner = !!ownerRow;

    if (!isOwner) {
      const { data: memberRow } = await supabase
        .from("startup_members")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!memberRow) throw new Error("Not authorized to view team");
    }

    const { data: members, error: mErr } = await supabase
      .from("startup_members")
      .select("id, user_id, role, title, created_at")
      .eq("startup_id", data.startupId)
      .order("created_at", { ascending: true });
    if (mErr) throw mErr;

    // Fetch owner so they appear in the team list too
    const { data: startupRow } = await supabase
      .from("startups")
      .select("owner_id")
      .eq("id", data.startupId)
      .single();
    const ownerId = startupRow?.owner_id as string | undefined;

    const memberUserIds = (members ?? []).map((m) => m.user_id);
    const allUserIds = [...new Set([...memberUserIds, ownerId].filter((x): x is string => !!x))];

    type ProfileRow = { id: string; full_name: string | null; avatar_url: string | null; handle: string | null };
    type FounderRow = { user_id: string; full_name: string | null; photo_url: string | null };
    let profiles: ProfileRow[] = [];
    let founders: FounderRow[] = [];
    if (allUserIds.length > 0) {
      const { data: accs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, handle")
        .in("id", allUserIds);
      profiles = ((accs as unknown) as ProfileRow[] | null) ?? [];
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const adminMod = await import("@supabase/supabase-js");
        const admin = adminMod.createClient(supabaseUrl, supabaseServiceKey);
        const { data: facc } = await admin
          .from("founder_accounts")
          .select("user_id, full_name, photo_url")
          .in("user_id", allUserIds);
        founders = ((facc as unknown) as FounderRow[] | null) ?? [];
      }
    }

    const memberMap = new Map<string, { id: string; user_id: string; role: string; title: string | null; name: string | null; avatar_url: string | null; handle: string | null; isCreator: boolean }>();

    (members ?? []).forEach((m) => {
      const p = profiles.find((x) => x.id === m.user_id);
      const f = founders.find((x) => x.user_id === m.user_id);
      memberMap.set(m.user_id, {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        title: (m as { title: string | null }).title ?? null,
        name: f?.full_name ?? p?.full_name ?? null,
        avatar_url: f?.photo_url ?? p?.avatar_url ?? null,
        handle: p?.handle ?? null,
        isCreator: m.user_id === ownerId,
      });
    });

    if (ownerId && !memberMap.has(ownerId)) {
      const p = profiles.find((x) => x.id === ownerId);
      const f = founders.find((x) => x.user_id === ownerId);
      memberMap.set(ownerId, {
        id: `owner-${ownerId}`,
        user_id: ownerId,
        role: "founder",
        title: "Founder",
        name: f?.full_name ?? p?.full_name ?? null,
        avatar_url: f?.photo_url ?? p?.avatar_url ?? null,
        handle: p?.handle ?? null,
        isCreator: true,
      });
    }

    // Creator first, then everyone else in original join order
    const memberList = Array.from(memberMap.values()).sort((a, b) => {
      if (a.isCreator && !b.isCreator) return -1;
      if (!a.isCreator && b.isCreator) return 1;
      return 0;
    });

    let invitations: { id: string; email: string; status: string; created_at: string }[] = [];
    if (isOwner) {
      const { data: invs, error: iErr } = await supabase
        .from("startup_invitations")
        .select("id, email, status, created_at")
        .eq("startup_id", data.startupId)
        .order("created_at", { ascending: false });
      if (iErr) throw iErr;
      invitations = (invs as typeof invitations) ?? [];
    }

    return { members: memberList, invitations, isOwner };
  });

// -------- invite --------

const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const inviteTeammates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        emails: z.array(emailSchema).min(1).max(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { name: startupName } = await assertOwner(supabase, data.startupId, userId);

    // inviter display name
    const { data: inviter } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const inviterName = ((inviter as { full_name: string | null } | null)?.full_name) || "A teammate";

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminMod = await import("@supabase/supabase-js");
    const admin =
      supabaseUrl && supabaseServiceKey
        ? adminMod.createClient(supabaseUrl, supabaseServiceKey)
        : null;

    // De-dup against the user's email
    const { data: meRes } = await supabase.auth.getUser();
    const myEmail = meRes.user?.email?.toLowerCase() ?? null;

    const uniqueEmails = Array.from(new Set(data.emails.map((e) => e.toLowerCase()))).filter(
      (e) => e !== myEmail,
    );

    const results: { email: string; status: "sent" | "already_invited" | "already_member" | "error"; error?: string }[] = [];

    // Enforce team size limit (owner + members + pending invites ≤ 6)
    const { count: memberCount } = await supabase
      .from("startup_members")
      .select("*", { count: "exact", head: true })
      .eq("startup_id", data.startupId);
    const { count: pendingCount } = await supabase
      .from("startup_invitations")
      .select("*", { count: "exact", head: true })
      .eq("startup_id", data.startupId)
      .eq("status", "pending");
    const currentTotal = 1 + (memberCount ?? 0) + (pendingCount ?? 0);
    if (currentTotal >= TEAM_MEMBER_LIMIT) {
      throw new Error(`This startup already has the maximum of ${TEAM_MEMBER_LIMIT} team members.`);
    }
    const maxNewInvites = TEAM_MEMBER_LIMIT - currentTotal;
    if (uniqueEmails.length > maxNewInvites) {
      throw new Error(
        `You can only invite ${maxNewInvites} more team member${maxNewInvites === 1 ? "" : "s"}.`,
      );
    }

    const { sendTemplateEmail } = await import("@/design-system/ventura-6bef42/lib/email-templates/send-email");


    for (const email of uniqueEmails) {
      try {
        // already a member? look up by founder_accounts.email (case-insensitive)
        let existingUserId: string | null = null;
        if (admin) {
          const { data: existingUser } = await admin
            .from("founder_accounts")
            .select("user_id")
            .ilike("email", email)
            .maybeSingle();
          existingUserId = (existingUser as { user_id: string } | null)?.user_id ?? null;
        }

        if (existingUserId) {
          const { data: alreadyMember } = await supabase
            .from("startup_members")
            .select("id")
            .eq("startup_id", data.startupId)
            .eq("user_id", existingUserId)
            .maybeSingle();
          if (alreadyMember) {
            results.push({ email, status: "already_member" });
            continue;
          }
        }

        // upsert invitation: if one exists for (startup, email) keep it, otherwise insert.
        const { data: existingInv } = await supabase
          .from("startup_invitations")
          .select("id, token, status")
          .eq("startup_id", data.startupId)
          .eq("email", email)
          .maybeSingle();

        let token: string;
        if (existingInv) {
          if (existingInv.status === "accepted") {
            results.push({ email, status: "already_member" });
            continue;
          }
          if (existingInv.status === "revoked") {
            // re-activate
            const { error: upErr } = await supabase
              .from("startup_invitations")
              .update({ status: "pending" })
              .eq("id", existingInv.id);
            if (upErr) throw upErr;
          }
          token = existingInv.token;
        } else {
          const { data: newInv, error: insErr } = await supabase
            .from("startup_invitations")
            .insert({
              startup_id: data.startupId,
              invited_by: userId,
              email,
            })
            .select("token")
            .single();
          if (insErr) throw insErr;
          token = (newInv as { token: string }).token;
        }

        if (!admin) throw new Error("Email service not configured");

        const acceptUrl = `${SITE_URL}/invite/accept?token=${token}`;
        const messageId = `teammate-invite:${token}`;
        try {
          const result = await sendTemplateEmail("teammate-invite", email, {
            templateData: {
              siteName: SITE_NAME,
              siteUrl: SITE_URL,
              inviterName,
              startupName,
              acceptUrl,
            },
            idempotencyKey: messageId,
          });
          const { error: logErr } = await admin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "teammate-invite",
            recipient_email: email,
            status: result.sent ? "sent" : "suppressed",
          });
          if (logErr) console.error("[startup-team] log write failed", logErr);
        } catch (sendErr) {
          const message = sendErr instanceof Error ? sendErr.message : String(sendErr);
          const { error: logErr } = await admin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "teammate-invite",
            recipient_email: email,
            status: "failed",
            error_message: message,
          });
          if (logErr) console.error("[startup-team] log write failed", logErr);
          throw sendErr;
        }


        results.push({ email, status: "sent" });
      } catch (e) {
        results.push({
          email,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { results };
  });

// -------- accept --------

export const getInviteEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server not configured");
    const adminMod = await import("@supabase/supabase-js");
    const admin = adminMod.createClient(supabaseUrl, supabaseServiceKey);
    const completeness = await computeMyCompleteness(admin, userId);
    const { countUserStartups, MAX_STARTUPS_PER_USER } = await import(
      "@/design-system/ventura-6bef42/lib/startup-limit.server"
    );
    const startupCount = await countUserStartups(admin, userId);
    return {
      completeness,
      minRequired: MIN_INVITE_COMPLETENESS,
      startupCount,
      maxStartups: MAX_STARTUPS_PER_USER,
      atStartupLimit: startupCount >= MAX_STARTUPS_PER_USER,
    };
  });

export const acceptStartupInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: meRes } = await supabase.auth.getUser();
    const myEmail = meRes.user?.email?.toLowerCase() ?? null;
    if (!myEmail) throw new Error("No email on signed-in account");

    // Use admin client to read the invitation (RLS would hide it from the invitee).
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server not configured");
    const adminMod = await import("@supabase/supabase-js");
    const admin = adminMod.createClient(supabaseUrl, supabaseServiceKey);





    const { data: inv, error: iErr } = await admin
      .from("startup_invitations")
      .select("id, startup_id, email, status")
      .eq("token", data.token)
      .maybeSingle();
    if (iErr) throw iErr;
    if (!inv) throw new Error("Invitation not found");
    if (inv.status === "revoked") throw new Error("Invitation was revoked");
    if (inv.status === "accepted") {
      // Idempotent: still ensure membership exists.
    }
    if ((inv.email as string).toLowerCase() !== myEmail) {
      throw new Error(
        `This invitation was sent to ${inv.email}. Sign in with that email to accept it.`,
      );
    }

    // A user can be affiliated with at most 2 startups (owned + joined).
    const { assertCanJoinAnotherStartup } = await import("@/design-system/ventura-6bef42/lib/startup-limit.server");
    await assertCanJoinAnotherStartup(admin, userId, inv.startup_id as string);

    // Upsert membership
    const { error: mErr } = await admin
      .from("startup_members")
      .upsert(
        { startup_id: inv.startup_id, user_id: userId, role: "member", title: "Co-founder" } as never,
        { onConflict: "startup_id,user_id" },
      );

    if (mErr) throw mErr;

    const { error: uErr } = await admin
      .from("startup_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
      })
      .eq("id", inv.id);
    if (uErr) throw uErr;

    // Fetch startup slug for redirect
    const { data: s } = await admin
      .from("startups")
      .select("id, slug, name")
      .eq("id", inv.startup_id)
      .maybeSingle();

    return { ok: true, startup: s };
  });

// -------- revoke / remove --------

export const revokeStartupInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv } = await supabase
      .from("startup_invitations")
      .select("id, startup_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    await assertOwner(supabase, inv.startup_id as string, userId);
    const { error } = await supabase
      .from("startup_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const removeStartupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ startupId: z.string().uuid(), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.startupId, userId);
    const { error } = await supabase
      .from("startup_members")
      .delete()
      .eq("startup_id", data.startupId)
      .eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateStartupMemberTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        memberId: z.string().uuid(),
        title: z.string().trim().max(80).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.startupId, userId);
    const value = data.title && data.title.length > 0 ? data.title : null;
    const { error } = await supabase
      .from("startup_members")
      .update({ title: value } as never)
      .eq("id", data.memberId)
      .eq("startup_id", data.startupId);
    if (error) throw error;
    return { ok: true };
  });

export const leaveStartup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ startupId: z.string().uuid(), deleteUpdates: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Owners cannot "leave" their own startup.
    const { data: ownerRow } = await (supabase.from("startups") as unknown as {
      select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> } } };
    }).select("id").eq("id", data.startupId).eq("owner_id", userId).maybeSingle();
    if (ownerRow) throw new Error("Owners can't leave their own startup. Delete it instead.");

    // Optionally remove the member's own weekly updates from this startup first
    // (must happen while membership/RLS access is still intact).
    if (data.deleteUpdates) {
      const { error: delErr } = await supabase
        .from("weekly_updates")
        .delete()
        .eq("startup_id", data.startupId)
        .eq("author_id", userId);
      if (delErr) throw delErr;
    }

    const { error } = await supabase
      .from("startup_members")
      .delete()
      .eq("startup_id", data.startupId)
      .eq("user_id", userId);
    if (error) throw error;

    // If this was the user's featured startup, clear it.
    await supabase
      .from("profiles")
      .update({ featured_startup_id: null } as never)
      .eq("id", userId)
      .eq("featured_startup_id", data.startupId);

    return { ok: true };
  });
