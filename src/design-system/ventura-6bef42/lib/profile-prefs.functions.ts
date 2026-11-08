import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

// Internal, non-public profile settings. These columns are not readable by the
// anon/authenticated Data API roles, so they are served here for the signed-in
// owner only.
export const getMyProfilePrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("email_notifications, home_tour_seen_at, program_tour_seen_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      email_notifications: data?.email_notifications ?? true,
      home_tour_seen_at: data?.home_tour_seen_at ?? null,
      program_tour_seen_at: data?.program_tour_seen_at ?? null,
    };
  });
