import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const input = z.object({
  role: z.enum(["founder", "investor", "mentor"]),
});

/**
 * Adds an account type to the signed-in user. Accounts can hold several
 * roles at once (founder + investor + coach), so existing roles are kept.
 */
export const setJoinRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (existing ?? []).map((r) => r.role as string);

    if (!roles.includes(data.role)) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: data.role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      if (error) throw error;
      roles.push(data.role);
    }

    // Signing up auto-assigns the founder role. If the user picked another role
    // and never actually started as a founder, drop that unused founder role.
    if (data.role !== "founder" && roles.includes("founder")) {
      const [{ data: account }, { data: owned }] = await Promise.all([
        supabaseAdmin
          .from("founder_accounts")
          .select("onboarding_completed_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin.from("startups").select("id").eq("owner_id", userId).limit(1),
      ]);
      const startedAsFounder =
        Boolean(account?.onboarding_completed_at) || (owned?.length ?? 0) > 0;
      if (!startedAsFounder) {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "founder");
        const idx = roles.indexOf("founder");
        if (idx >= 0) roles.splice(idx, 1);
      }
    }

    return { role: data.role, roles };
  });
