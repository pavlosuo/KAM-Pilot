import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  startupId: z.string().uuid(),
  updateId: z.string().uuid(),
  cards: z
    .array(
      z.object({
        label: z.string().max(60),
        value: z.string().max(60),
        icon_name: z.string().min(1).max(60).nullable(),
        image_url: z.string().url().nullable(),
        description: z.string().max(600).nullable().optional(),
      }),
    )
    .min(0)
    .max(6),
});

export const replaceProgressionCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Headlines that already exist on this update — edits to value/description/icon
    // must not count as an update for XP purposes.
    const { data: priorRows } = await supabase
      .from("startup_progression_cards")
      .select("label")
      .eq("weekly_update_id", data.updateId);
    const priorLabels = new Set(
      ((priorRows as { label: string | null }[] | null) ?? [])
        .map((r) => (r.label ?? "").trim().toLowerCase())
        .filter(Boolean),
    );

    const { error: dErr } = await supabase
      .from("startup_progression_cards")
      .delete()
      .eq("weekly_update_id", data.updateId);
    if (dErr) throw dErr;

    if (data.cards.length === 0) return { ok: true };


    const rows = data.cards.map((c, i) => ({
      startup_id: data.startupId,
      weekly_update_id: data.updateId,
      card_type: "metric",
      label: c.label,
      value: c.value,
      icon_name: c.image_url ? null : c.icon_name,
      image_url: c.image_url,
      description: c.description ?? null,
      source_type: "manual_input",
      display_order: i,
      is_public: true,
    }));

    const { error: iErr } = await supabase
      .from("startup_progression_cards")
      .insert(rows as never);
    if (iErr) throw iErr;

    // XP only for new/changed headlines.
    try {
      const newLabels = data.cards
        .map((c) => c.label)
        .filter((l) => l.trim() && !priorLabels.has(l.trim().toLowerCase()));
      if (newLabels.length > 0) {
        const { data: upd } = await supabase
          .from("weekly_updates")
          .select("week_of")
          .eq("id", data.updateId)
          .maybeSingle();
        const { awardCardHeadlineXp } = await import("@/design-system/ventura-6bef42/lib/xp-awarder.server");
        await awardCardHeadlineXp({
          startupId: data.startupId,
          userId,
          weekOf: (upd as { week_of: string | null } | null)?.week_of ?? null,
          labels: newLabels,
        });
      }
    } catch (e) {
      console.error("awardCardHeadlineXp failed", e);
    }

    return { ok: true };
  });
