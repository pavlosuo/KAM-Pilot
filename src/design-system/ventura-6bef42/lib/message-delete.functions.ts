import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

/** Deletes a message the signed-in user sent. */
export const deleteMyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!row) throw new Error("Message not found");
    if ((row as { sender_id: string }).sender_id !== userId) {
      throw new Error("You can only delete your own messages");
    }

    const { error } = await supabaseAdmin.from("messages").delete().eq("id", data.messageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
