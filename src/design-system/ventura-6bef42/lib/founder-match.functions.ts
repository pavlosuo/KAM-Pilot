import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

const scope = z.object({
  startupId: z.string().uuid(),
  programId: z.string().uuid(),
});

export const getStartupMatchBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { loadMatchBoard } = await import("@/design-system/ventura-6bef42/lib/founder-match.server");
    return loadMatchBoard(supabaseAdmin, data.startupId, data.programId);
  });

export const requestConnectionIntro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ suggestionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: member } = await admin
      .from("startup_members")
      .select("user_id")
      .eq("startup_id", data.startupId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: startup } = await admin
      .from("startups")
      .select("owner_id")
      .eq("id", data.startupId)
      .maybeSingle();
    if (!member && (startup as { owner_id?: string } | null)?.owner_id !== context.userId) {
      throw new Error("Forbidden");
    }

    const { data: suggestion } = await admin
      .from("startup_match_suggestions")
      .select("id, kind, connection_id, name")
      .eq("id", data.suggestionId)
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (!suggestion?.connection_id) throw new Error("This person is not in the program network.");

    await admin.from("program_connection_requests").upsert(
      {
        program_id: data.programId,
        startup_id: data.startupId,
        connection_id: suggestion.connection_id,
        kind: suggestion.kind,
        note: null,
        status: "open",
      },
      { onConflict: "startup_id,connection_id" },
    );
    await admin
      .from("startup_match_suggestions")
      .update({ intro_requested: true })
      .eq("id", data.suggestionId);

    // Mirror the request into the program inbox as a message from the startup.
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const who = (profile as { full_name?: string | null } | null)?.full_name ?? "A founder";
    const personName = (suggestion as { name?: string | null }).name ?? "someone in the network";
    const kindLabel = suggestion.kind === "investor" ? "investor" : "mentor";
    await admin.from("messages").insert({
      startup_id: data.startupId,
      sender_id: context.userId,
      recipient_id: data.programId,
      sender_role: "founder",
      is_private: false,
      body: `${who} asked to be connected with ${personName} (${kindLabel}) from the program network.`,
    });

    return { ok: true };
  });
