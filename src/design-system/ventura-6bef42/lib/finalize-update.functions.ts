import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { computeCurrentWeekStart } from "@/design-system/ventura-6bef42/lib/week-bounds";

const inputSchema = z.object({
  startupId: z.string().uuid(),
  updateId: z.string().uuid().optional().nullable(),
  transcript: z.string().min(1),
});

export const finalizeWeeklyUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are an editor helping a startup founder polish their weekly update.
Take the raw transcript and rewrite it into clean, well-structured text.
Break the text into small paragraphs — each paragraph should be only 2-4 sentences.
This makes the update easy to read and scan.
Fix grammar, punctuation, and capitalization. Keep the founder's voice and meaning intact.
Do NOT add information that isn't in the transcript. Do NOT add headings, titles, or bullet points.
Return ONLY the polished update text.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      system,
      prompt: data.transcript,
    });

    const polished = text.trim();

    let updateId = data.updateId ?? null;
    if (updateId) {
      const { data: existing, error: fErr } = await supabase
        .from("weekly_updates")
        .select("author_id")
        .eq("id", updateId)
        .maybeSingle();
      if (fErr) throw fErr;
      if (!existing || (existing as { author_id: string }).author_id !== userId) {
        throw new Error("Forbidden");
      }
      const { error } = await supabase
        .from("weekly_updates")
        .update({ transcript: data.transcript, summary: polished } as never)
        .eq("id", updateId);
      if (error) throw error;
    } else {
      // Determine current week_of via the shared Monday–Sunday computation
      // so this row's week_of aligns with saveWeeklyUpdateDraft and
      // weekly_customer_conversations (which are also Monday-aligned).
      const { data: s } = await supabase
        .from("startups")
        .select("published_at")
        .eq("id", data.startupId)
        .maybeSingle();
      const publishedAt = (s as { published_at: string | null } | null)?.published_at ?? null;
      const weekOf = computeCurrentWeekStart(publishedAt);

      const insertRow: Record<string, unknown> = {
        startup_id: data.startupId,
        author_id: userId,
        transcript: data.transcript,
        summary: polished,
        status: "draft",
        is_published: false,
      };
      if (weekOf) insertRow.week_of = weekOf;
      const { data: row, error } = await supabase
        .from("weekly_updates")
        .insert(insertRow as never)
        .select("id")
        .single();
      if (error) throw error;
      updateId = (row as { id: string }).id;
    }

    if (updateId) {
      await supabase
        .from("weekly_update_attachments")
        .update({ weekly_update_id: updateId } as never)
        .eq("startup_id", data.startupId)
        .eq("author_id", userId)
        .is("weekly_update_id", null);
    }

    return { id: updateId, summary: polished };
  });
