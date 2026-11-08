import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export const PITCH_DECK_UPLOAD_LIMIT = 10;

export const recordPitchDeckUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: prof, error } = await supabaseAdmin
      .from("profiles")
      .select("pitch_deck_upload_count")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const current = prof?.pitch_deck_upload_count ?? 0;
    if (current >= PITCH_DECK_UPLOAD_LIMIT) {
      throw new Error(
        `Pitch deck upload limit reached (${PITCH_DECK_UPLOAD_LIMIT} per account). Contact support if you need more.`,
      );
    }
    const next = current + 1;
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ pitch_deck_upload_count: next })
      .eq("id", userId);
    if (upErr) throw new Error(upErr.message);
    return { count: next, limit: PITCH_DECK_UPLOAD_LIMIT };
  });
