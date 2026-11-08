import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export const listMySaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("saves")
      .select("startup_id")
      .eq("user_id", userId);
    if (error) throw error;
    return { startupIds: ((data ?? []) as { startup_id: string }[]).map((r) => r.startup_id) };
  });

export const toggleStartupSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), saved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.saved) {
      const { error } = await supabase
        .from("saves")
        .upsert(
          { user_id: userId, startup_id: data.startupId },
          { onConflict: "user_id,startup_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("saves")
        .delete()
        .eq("user_id", userId)
        .eq("startup_id", data.startupId);
      if (error) throw error;
    }
    return { saved: data.saved };
  });
