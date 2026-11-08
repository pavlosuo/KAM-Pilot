import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const startInput = z.object({
  startupId: z.string().uuid(),
  pdfPath: z.string().min(1),
  thumbnailPaths: z.array(z.string()).max(60),
});

export const createDeckParseJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => startInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error } = await supabase
      .from("deck_parse_jobs")
      .insert({
        user_id: userId,
        startup_id: data.startupId,
        pdf_path: data.pdfPath,
        thumbnail_paths: data.thumbnailPaths,
        status: "queued",
      })
      .select("*")
      .single();
    if (error) throw error;
    return { jobId: job.id as string };
  });

export const runDeckParseJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { runJob } = await import("./deck-parse.server");
    const result = await runJob(data.jobId, userId);
    return result;
  });

export const getDeckParseJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error } = await supabase
      .from("deck_parse_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return { job };
  });

export const getMyDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("startup_drafts")
      .select("*")
      .eq("user_id", userId);
    if (data.startupId) q = q.eq("startup_id", data.startupId);
    const { data: row, error } = await q
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { draft: row };
  });

export const updateMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ draftId: z.string().uuid(), data: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("startup_drafts")
      .update({ data: data.data as never })
      .eq("id", data.draftId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const createEmptyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Reuse existing draft for this startup if present
    const { data: existing } = await supabase
      .from("startup_drafts")
      .select("id")
      .eq("user_id", userId)
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (existing) return { draftId: existing.id as string };
    const { data: row, error } = await supabase
      .from("startup_drafts")
      .insert({ user_id: userId, startup_id: data.startupId, data: {} as never })
      .select("id")
      .single();
    if (error) throw error;
    return { draftId: row.id as string };
  });
