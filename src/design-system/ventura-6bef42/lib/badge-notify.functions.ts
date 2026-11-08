import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

/**
 * Marks badge celebrations as seen for the current account, so the pop-up is
 * shown only once per user (each teammate still gets their own celebration).
 */
export const markBadgesSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ badgeIds: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ context, data }) => {
    if (!data.badgeIds.length) return { ok: true };
    await context.supabase
      .from("user_seen_badges")
      .upsert(
        data.badgeIds.map((badge_id) => ({ user_id: context.userId, badge_id })),
        { onConflict: "user_id,badge_id", ignoreDuplicates: true },
      );
    return { ok: true };
  });


