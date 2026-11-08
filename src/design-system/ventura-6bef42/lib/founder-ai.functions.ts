import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

const scope = z.object({
  startupId: z.string().uuid(),
  programId: z.string().uuid(),
});

export const listFounderAiConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("founder_ai_conversations")
      .select("id, title, updated_at")
      .eq("startup_id", data.startupId)
      .eq("program_id", data.programId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return { conversations: rows ?? [] };
  });

export const createFounderAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("founder_ai_conversations")
      .insert({
        user_id: context.userId,
        startup_id: data.startupId,
        program_id: data.programId,
      } as never)
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getFounderAiMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("founder_ai_messages")
      .select("id, role, parts, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return { messages: rows ?? [] };
  });

export const deleteFounderAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("founder_ai_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
