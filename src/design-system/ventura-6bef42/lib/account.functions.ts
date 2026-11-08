import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const userId = context.userId;

    // Find all startups owned by this user
    const { data: ownedStartups, error: ownedErr } = await supabaseAdmin
      .from("startups")
      .select("id")
      .eq("owner_id", userId);
    if (ownedErr) throw new Error(ownedErr.message);

    for (const s of ownedStartups ?? []) {
      // Find earliest-invited team member (excluding the owner themselves)
      const { data: members, error: memErr } = await supabaseAdmin
        .from("startup_members")
        .select("user_id, created_at")
        .eq("startup_id", s.id)
        .neq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (memErr) throw new Error(memErr.message);

      const successor = members?.[0]?.user_id ?? null;

      if (successor) {
        // Transfer ownership to the earliest team member
        const { error: transferErr } = await supabaseAdmin
          .from("startups")
          .update({ owner_id: successor })
          .eq("id", s.id);
        if (transferErr) throw new Error(transferErr.message);

        // Remove successor from startup_members (now they're the owner)
        await supabaseAdmin
          .from("startup_members")
          .delete()
          .eq("startup_id", s.id)
          .eq("user_id", successor);
      } else {
        // No other team members — delete the startup with the founder
        const { error: delErr } = await supabaseAdmin
          .from("startups")
          .delete()
          .eq("id", s.id);
        if (delErr) throw new Error(delErr.message);
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });

const REMOVABLE_ROLES = ["founder", "investor", "mentor"] as const;
type RemovableRole = (typeof REMOVABLE_ROLES)[number];

export const removeRole = createServerFn({ method: "POST" })
  .inputValidator((data: { role: RemovableRole }) => {
    if (!data || !REMOVABLE_ROLES.includes(data.role)) {
      throw new Error("This role can't be removed");
    }
    return data;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const userId = context.userId;
    const role = data.role;

    const { data: roleRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw new Error(rolesErr.message);
    const current = (roleRows ?? []).map((row) => row.role);
    if (!current.includes(role)) return { success: true, remaining: current };
    if (current.length <= 1) {
      throw new Error("You can't remove your last role. Delete your account instead.");
    }

    // Remove the role row itself.
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (delErr) throw new Error(delErr.message);

    // Clean up role-specific profile data (kept best-effort).
    if (role === "investor") {
      await supabaseAdmin.from("investor_research").delete().eq("user_id", userId);
      await supabaseAdmin.from("investor_profiles").delete().eq("user_id", userId);
      await supabaseAdmin.from("role_home_matches").delete().eq("user_id", userId).eq("role", "investor");
      await supabaseAdmin.from("role_home_shuffle_state").delete().eq("user_id", userId).eq("role", "investor");
    } else if (role === "mentor") {
      await supabaseAdmin.from("coach_research").delete().eq("user_id", userId);
      await supabaseAdmin.from("coach_profiles").delete().eq("user_id", userId);
      await supabaseAdmin.from("role_home_matches").delete().eq("user_id", userId).eq("role", "mentor");
      await supabaseAdmin.from("role_home_shuffle_state").delete().eq("user_id", userId).eq("role", "mentor");
    }

    return { success: true, remaining: current.filter((r) => r !== role) };
  });
