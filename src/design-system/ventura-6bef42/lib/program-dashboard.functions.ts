import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getProgramOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { loadOverview } = await import("@/design-system/ventura-6bef42/lib/program-dashboard.server");
    const programId = await requireProgram(data.slug);
    return loadOverview(supabaseAdmin, programId);
  });

export const getProgramPortfolio = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        status: z.enum(["approved", "pending", "declined"]).default("approved"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { loadPortfolio } = await import("@/design-system/ventura-6bef42/lib/program-dashboard.server");
    const programId = await requireProgram(data.slug);
    return { startups: await loadPortfolio(supabaseAdmin, programId, data.status) };
  });

export const getProgramStartupDetail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), startupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { loadStartupDetail } = await import("@/design-system/ventura-6bef42/lib/program-dashboard.server");
    const programId = await requireProgram(data.slug);
    return loadStartupDetail(supabaseAdmin, programId, data.startupId);
  });

export const setProgramStartupStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        status: z.enum(["approved", "declined", "pending"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_startups")
      .update({
        status: data.status,
        joined_at: data.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    if (error) throw new Error(error.message);
    if (data.status === "approved") {
      const { applyProgramBacking } = await import("@/design-system/ventura-6bef42/lib/program-backing.server");
      await applyProgramBacking(supabaseAdmin, programId, data.startupId);
    }
    return { ok: true };
  });

export const removeProgramStartup = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), startupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    // Clean up program-scoped data for this startup, then drop the membership.
    await supabaseAdmin
      .from("program_kpi_assignments")
      .delete()
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    await supabaseAdmin
      .from("program_notes")
      .delete()
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    await supabaseAdmin
      .from("program_investor_connections")
      .delete()
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);

    const { error } = await supabaseAdmin
      .from("program_startups")
      .delete()
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setProgramStartupCoach = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        coachName: z.string().trim().max(120).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_startups")
      .update({ coach_name: data.coachName || null })
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProgramNote = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_notes")
      .insert({ program_id: programId, startup_id: data.startupId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProgramNote = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_notes")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProgramInvitations = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("program_invitations")
      .select("id, token, label, status, created_at, used_at")
      .eq("program_id", programId)
      .order("created_at", { ascending: false });
    return { invitations: rows ?? [] };
  });

export const createProgramInvitation = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), label: z.string().trim().max(120).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { randomString } = await import("@/design-system/ventura-6bef42/lib/program-crypto.server");
    const programId = await requireProgram(data.slug);
    const token = randomString(28);
    const { error } = await supabaseAdmin
      .from("program_invitations")
      .insert({ program_id: programId, token, label: data.label || null });
    if (error) throw new Error(error.message);
    return { token };
  });

export const revokeProgramInvitation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_invitations")
      .update({ status: "revoked" })
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProgramInvitation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_invitations")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
