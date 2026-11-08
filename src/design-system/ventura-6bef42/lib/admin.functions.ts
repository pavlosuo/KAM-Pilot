import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const all: Array<{
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
    }> = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        all.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    const ids = all.map((u) => u.id);

    // Last action = latest of sign-in and recent activity across key tables.
    const lastAction = new Map<string, string>();
    const bump = (id: string | null | undefined, at: string | null | undefined) => {
      if (!id || !at) return;
      const prev = lastAction.get(id);
      if (!prev || at > prev) lastAction.set(id, at);
    };
    all.forEach((u) => bump(u.id, u.last_sign_in_at));
    const activity: Array<[string, string]> = [
      ["ai_credit_usage", "user_id"],
      ["comments", "user_id"],
      ["likes", "user_id"],
      ["founder_ai_messages", "user_id"],
      ["role_assistant_messages", "user_id"],
      ["messages", "sender_id"],
      ["startup_views", "viewer_id"],
      ["startup_xp_events", "user_id"],
      ["weekly_updates", "author_id"],
    ];
    await Promise.all(
      activity.map(async ([table, col]) => {
        const { data } = await (supabaseAdmin as any)
          .from(table)
          .select(`${col}, created_at`)
          .order("created_at", { ascending: false })
          .limit(5000);
        (data ?? []).forEach((r: any) => bump(r[col], r.created_at));
      }),
    );
    all.forEach((u) => {
      (u as any).last_action_at = lastAction.get(u.id) ?? null;
    });
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, handle")
      .in("id", ids);

    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r: any) => {
      const prev = roleMap.get(r.user_id);
      roleMap.set(r.user_id, prev ? `${prev}, ${r.role}` : r.role);
    });
    const nameMap = new Map<string, string>();
    const handleMap = new Map<string, string | null>();
    (profiles ?? []).forEach((p: any) => {
      nameMap.set(p.id, p.full_name ?? "");
      handleMap.set(p.id, p.handle ?? null);
    });

    return all
      .map((u) => ({
        ...u,
        role: roleMap.get(u.id) ?? null,
        full_name: nameMap.get(u.id) ?? "",
        handle: handleMap.get(u.id) ?? null,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["founder", "investor", "admin"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.userId, role: data.role as any },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own admin account.");
    }
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listAllStartupsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("startups")
      .select("id, name, slug, is_published, hidden_from_discovery, owner_id, published_at, created_at, discovery_order")
      .order("discovery_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setStartupHiddenFromDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ startupId: z.string().uuid(), hidden: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("startups")
      .update({ hidden_from_discovery: data.hidden })
      .eq("id", data.startupId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const setStartupsDiscoveryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ orderedIds: z.array(z.string().uuid()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    // Assign 1..N to given ids
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabaseAdmin
        .from("startups")
        .update({ discovery_order: i + 1 })
        .eq("id", data.orderedIds[i]);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

export const updateSiteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ enabled: z.boolean(), message: z.string().max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    // Update the (single) row; create if none.
    const { data: existing } = await supabaseAdmin
      .from("site_announcements")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("site_announcements")
        .update({
          enabled: data.enabled,
          message: data.message,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("site_announcements")
        .insert({
          enabled: data.enabled,
          message: data.message,
          updated_by: context.userId,
        });
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

