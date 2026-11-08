import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public, minimal view of a startup's approved program memberships.
// Returns only program branding (id/name/logo) — never coach assignments,
// investor-readiness flags, or any other cohort-internal fields.
export const getStartupProgramBadges = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const { data: memberships } = await supabaseAdmin
      .from("program_startups")
      .select("program_id")
      .eq("startup_id", data.startupId)
      .eq("status", "approved");

    const ids = ((memberships ?? []) as Array<{ program_id: string }>).map((m) => m.program_id);
    if (ids.length === 0) return { programs: [] };

    const { data: programs } = await supabaseAdmin
      .from("programs")
      .select("id, name, logo_url")
      .in("id", ids)
      .eq("is_active", true);

    return {
      programs: (programs ?? []) as Array<{ id: string; name: string; logo_url: string | null }>,
    };
  });
