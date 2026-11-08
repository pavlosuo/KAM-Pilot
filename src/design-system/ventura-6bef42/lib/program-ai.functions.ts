import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugInput = z.object({ slug: z.string().min(1) });

async function ctx(slug: string) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const programId = await requireProgram(slug);
  return { supabaseAdmin, programId };
}

export const listProgramAiConversations = createServerFn({ method: "POST" })
  .inputValidator((d) => slugInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, programId } = await ctx(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("program_ai_conversations")
      .select("id, title, updated_at")
      .eq("program_id", programId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return { conversations: rows ?? [] };
  });

export const createProgramAiConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => slugInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, programId } = await ctx(data.slug);
    const { data: row, error } = await supabaseAdmin
      .from("program_ai_conversations")
      .insert({ program_id: programId })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getProgramAiMessages = createServerFn({ method: "POST" })
  .inputValidator((d) => slugInput.extend({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, programId } = await ctx(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("program_ai_messages")
      .select("id, role, parts, created_at")
      .eq("program_id", programId)
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return { messages: rows ?? [] };
  });

export const deleteProgramAiConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => slugInput.extend({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, programId } = await ctx(data.slug);
    const { error } = await supabaseAdmin
      .from("program_ai_conversations")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Runs an AI-proposed action after the program lead confirms it. */
export const executeProgramAiAction = createServerFn({ method: "POST" })
  .inputValidator((d) => slugInput.extend({ action: z.unknown() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, programId } = await ctx(data.slug);
    const { programActionSchema, executeProgramAction } = await import("@/design-system/ventura-6bef42/lib/program-ai.server");
    const action = programActionSchema.parse(data.action);
    const message = await executeProgramAction(supabaseAdmin, programId, action);
    return { ok: true, message };
  });
