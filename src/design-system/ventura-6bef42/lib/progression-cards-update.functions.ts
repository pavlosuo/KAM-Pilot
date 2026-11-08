import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  cards: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(60),
        value: z.string().min(1).max(60),
        icon_name: z.string().min(1).max(60).nullable(),
        image_url: z.string().url().nullable(),
      }),
    )
    .min(1)
    .max(20),
});

export const updateProgressionCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    for (const c of data.cards) {
      const { error } = await supabase
        .from("startup_progression_cards")
        .update({
          label: c.label,
          value: c.value,
          icon_name: c.icon_name,
          image_url: c.image_url,
        } as never)
        .eq("id", c.id);
      if (error) throw error;
    }
    return { ok: true };
  });
