import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["investor", "mentor"]);

async function assertRole(context: { supabase: any; userId: string }, role: "investor" | "mentor") {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", role).maybeSingle();
  if (!data) throw new Error("This assistant is not available for your active role.");
}

export const listRoleAssistantThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: roleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, data.role);
    const { data: rows, error } = await context.supabase.from("role_assistant_threads").select("id, title, updated_at").eq("user_id", context.userId).eq("role", data.role).order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return { threads: rows ?? [] };
  });

export const createRoleAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: roleSchema, title: z.string().trim().max(80).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context, data.role);
    const { data: row, error } = await context.supabase.from("role_assistant_threads").insert({ user_id: context.userId, role: data.role, title: data.title || "New conversation" }).select("id, title, updated_at").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getRoleAssistantMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("role_assistant_messages").select("id, role, content, parts, created_at").eq("thread_id", data.threadId).eq("user_id", context.userId).order("created_at");
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

export const deleteRoleAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("role_assistant_threads").delete().eq("id", data.threadId).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });