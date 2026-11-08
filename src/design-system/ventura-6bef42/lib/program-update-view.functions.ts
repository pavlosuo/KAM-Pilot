import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const base = z.object({ slug: z.string().min(1), startupId: z.string().uuid() });

async function authorize(slug: string, startupId: string) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const programId = await requireProgram(slug);
  const { data: link } = await supabaseAdmin
    .from("program_startups")
    .select("startup_id")
    .eq("program_id", programId)
    .eq("startup_id", startupId)
    .maybeSingle();
  if (!link) throw new Error("Unauthorized");
  return { supabase: supabaseAdmin, programId };
}

/** Opening a startup's full weekly update marks that week as reviewed. */
async function markReviewed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  programId: string,
  startupId: string,
  weekOf: string | null | undefined,
) {
  if (!weekOf) return;
  await supabase
    .from("program_update_reviews")
    .upsert(
      { program_id: programId, startup_id: startupId, week_of: weekOf, reviewed_at: new Date().toISOString() },
      { onConflict: "program_id,startup_id,week_of" },
    );
}

export const getProgramLatestUpdate = createServerFn({ method: "POST" })
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }) => {
    const { supabase, programId } = await authorize(data.slug, data.startupId);
    const { loadLatestUpdate } = await import("@/design-system/ventura-6bef42/lib/update-history.server");
    const res = await loadLatestUpdate(supabase, data.startupId);
    await markReviewed(
      supabase,
      programId,
      data.startupId,
      (res as { update?: { week_of?: string | null } | null } | null)?.update?.week_of ?? null,
    );

    return res;
  });

export const getProgramUpdateWeeks = createServerFn({ method: "POST" })
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }) => {
    const { supabase } = await authorize(data.slug, data.startupId);
    const { loadPublishedWeeks } = await import("@/design-system/ventura-6bef42/lib/update-history.server");
    return loadPublishedWeeks(supabase, data.startupId);
  });


export const getProgramWeekUpdateView = createServerFn({ method: "POST" })
  .inputValidator((d) => base.extend({ weekOf: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabase, programId } = await authorize(data.slug, data.startupId);
    const { loadWeekView } = await import("@/design-system/ventura-6bef42/lib/update-history.server");
    const { data: s } = await supabase
      .from("startups")
      .select("owner_id")
      .eq("id", data.startupId)
      .maybeSingle();
    const ownerId = (s as { owner_id: string } | null)?.owner_id ?? null;
    const res = await loadWeekView(supabase, data.startupId, data.weekOf, ownerId);
    await markReviewed(supabase, programId, data.startupId, data.weekOf);
    return res;
  });

export const getProgramConversationSeries = createServerFn({ method: "POST" })
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }) => {
    const { supabase } = await authorize(data.slug, data.startupId);
    const { loadConversationSeries } = await import("@/design-system/ventura-6bef42/lib/update-history.server");
    return loadConversationSeries(supabase, data.startupId);
  });

export const getProgramStartupStreak = createServerFn({ method: "POST" })
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }) => {
    const { supabase } = await authorize(data.slug, data.startupId);
    const { loadPublishStreak } = await import("@/design-system/ventura-6bef42/lib/update-history.server");
    return loadPublishStreak(supabase, data.startupId);
  });

