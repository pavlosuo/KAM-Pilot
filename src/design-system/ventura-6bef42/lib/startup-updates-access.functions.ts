import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { isTestingModeEmail } from "@/design-system/ventura-6bef42/lib/testing-mode";

export const checkStartupPublished = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string | null } | null)?.email ?? null;
    const testingMode = isTestingModeEmail(email);
    const { data: row, error } = await supabase
      .from("startups")
      .select("id, is_published, name, owner_id, published_at")
      .eq("id", data.startupId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { allowed: false, name: "Startup" };

    const isOwner = (row as { owner_id: string }).owner_id === userId;
    let isMember = isOwner;
    if (!isOwner) {
      const { data: m } = await supabase
        .from("startup_members")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("user_id", userId)
        .maybeSingle();
      isMember = Boolean(m);
    }
    const published = (row as { is_published: boolean }).is_published;

    // Block access when the current week already has a published update (by anyone).
    let currentWeekPublished = false;
    const publishedAt = (row as { published_at: string | null }).published_at;
    if (!testingMode && published && isMember && publishedAt) {
      const weekStart = computeCurrentWeekStart(publishedAt);
      if (weekStart) {
        const { data: existing } = await supabase
          .from("weekly_updates")
          .select("id")
          .eq("startup_id", data.startupId)
          .eq("author_id", userId)
          .eq("week_of", weekStart)
          .eq("is_published", true)
          .limit(1);
        currentWeekPublished = ((existing as { id: string }[] | null) ?? []).length > 0;
      }
    }

    return {
      allowed: Boolean(published && isMember && !currentWeekPublished),
      name: (row as { name: string }).name ?? "Startup",
    };
  });
