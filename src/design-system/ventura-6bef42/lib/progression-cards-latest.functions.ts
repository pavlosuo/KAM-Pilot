import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const inputSchema = z.object({ startupId: z.string().uuid() });

export const getLatestPublishedCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Find the most recent published weekly update for this startup.
    const { data: updates, error } = await supabase
      .from("weekly_updates")
      .select("id, published_at")
      .eq("startup_id", data.startupId)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(10);
    if (error) throw error;

    const ids = ((updates as { id: string }[] | null) ?? []).map((r) => r.id);
    if (ids.length === 0) return { hasPrevious: false, cards: [] };

    for (const id of ids) {
      const { data: rows } = await supabase
        .from("startup_progression_cards")
        .select("label, value, icon_name, image_url, description, display_order")
        .eq("weekly_update_id", id)
        .order("display_order", { ascending: true });
      const list = (rows as Array<{
        label: string;
        value: string | null;
        icon_name: string | null;
        image_url: string | null;
        description: string | null;
      }> | null) ?? [];
      if (list.length > 0) {
        return { hasPrevious: true, cards: list };
      }
    }
    return { hasPrevious: true, cards: [] };
  });
