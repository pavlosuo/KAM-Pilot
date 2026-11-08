import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkEmailSuppressed = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("suppressed_emails")
      .select("reason")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();
    return { suppressed: !!row, reason: row?.reason ?? null };
  });
