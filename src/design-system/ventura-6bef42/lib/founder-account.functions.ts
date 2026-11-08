import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const ensureFounderAccountInput = z.object({
  fullName: z.string().trim().max(120).optional(),
});

export const ensureFounderAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ensureFounderAccountInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const resolvedFullName =
      data.fullName?.trim() ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
      (typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "") ||
      user.email?.split("@")[0] ||
      "Founder";

    const { data: existingAccount, error: existingError } = await supabase
      .from("founder_accounts")
      .select("id, full_name, email")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const verifiedEmail = user.email ?? null;

    if (!existingAccount) {
      const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

      // Ensure the user has the founder role (required by RLS policies on founder_accounts)
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "founder" }, { onConflict: "user_id,role", ignoreDuplicates: true });

      const { error: insertError } = await supabaseAdmin
        .from("founder_accounts")
        .upsert(
          {
            user_id: userId,
            full_name: resolvedFullName,
            email: verifiedEmail ?? "",
          },
          { onConflict: "user_id", ignoreDuplicates: true },
        );

      if (insertError) {
        throw insertError;
      }

      return { created: true };
    }


    const updates: { full_name?: string; email?: string } = {};

    if (!existingAccount.full_name?.trim() && resolvedFullName) {
      updates.full_name = resolvedFullName;
    }

    if (verifiedEmail && existingAccount.email !== verifiedEmail) {
      updates.email = verifiedEmail;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("founder_accounts")
        .update(updates)
        .eq("id", existingAccount.id);

      if (updateError) {
        throw updateError;
      }
    }

    return { created: false };
  });