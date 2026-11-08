import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

// Set / clear the badge that shows on the public startup profile.
// Only the startup owner or a team member may set it, and only to a badge
// the startup has actually earned (or null to clear).
export const setPinnedBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        code: z.string().min(1).max(64).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Access check via existing team membership
    const [{ data: owner }, { data: member }] = await Promise.all([
      supabase
        .from("startups")
        .select("id")
        .eq("id", data.startupId)
        .eq("owner_id", userId)
        .maybeSingle(),
      supabase
        .from("startup_members")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (!owner && !member) throw new Error("Not authorized");

    if (data.code) {
      const { data: earned } = await supabase
        .from("startup_badges")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("code", data.code)
        .maybeSingle();
      if (!earned) throw new Error("Badge not earned yet");
    }

    const { error } = await supabase
      .from("startups")
      .update({ pinned_badge_code: data.code } as never)
      .eq("id", data.startupId);
    if (error) throw error;
    return { ok: true };
  });

// Public read: pinned badge + level for the startup's public profile.
export const getPublicStartupProgress = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const [{ data: xpRows }, { data: startup }] = await Promise.all([
      supabaseAdmin.from("startup_xp_events").select("xp").eq("startup_id", data.startupId),
      supabaseAdmin
        .from("startups")
        .select("pinned_badge_code")
        .eq("id", data.startupId)
        .maybeSingle(),
    ]);
    const totalXp = ((xpRows as { xp: number }[] | null) ?? []).reduce(
      (s, r) => s + (r.xp ?? 0),
      0,
    );
    return {
      totalXp,
      pinnedBadgeCode:
        (startup as { pinned_badge_code: string | null } | null)?.pinned_badge_code ?? null,
    };
  });
