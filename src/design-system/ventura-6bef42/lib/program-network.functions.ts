import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listProgramNetwork = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const [{ data: coaches }, { data: members }, { data: connections }] = await Promise.all([
      supabaseAdmin
        .from("program_coaches")
        .select(
          "id, name, email, expertise, photo_url, linkedin_url, headline, expertise_summary, matched_startup_id, match_points, match_reason",
        )
        .eq("program_id", programId)
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("program_startups")
        .select("startup_id, coach_id, investor_ready")
        .eq("program_id", programId)
        .eq("status", "approved"),
      supabaseAdmin
        .from("program_investor_connections")
        .select("id, startup_id, investor_user_id, external_name, status, note, connected_at")
        .eq("program_id", programId)
        .order("connected_at", { ascending: false }),
    ]);

    const memberRows = (members ?? []) as Array<{
      startup_id: string;
      coach_id: string | null;
      investor_ready: boolean;
    }>;
    const ids = memberRows.map((m) => m.startup_id);
    const { data: startups } = await supabaseAdmin
      .from("startups")
      .select("id, name, logo_url, stage")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const investorIds = Array.from(
      new Set(
        ((connections ?? []) as Array<{ investor_user_id: string | null }>)
          .map((c) => c.investor_user_id)
          .filter((v): v is string => !!v),
      ),
    );
    const { data: investors } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, organization, avatar_url")
      .in("id", investorIds.length ? investorIds : ["00000000-0000-0000-0000-000000000000"]);

    const { listProgramConnectionsData } = await import("@/design-system/ventura-6bef42/lib/program-connections.server");
    const connectionsData = await listProgramConnectionsData(supabaseAdmin, programId);

    return {
      coaches: coaches ?? [],
      members: memberRows,
      startups: startups ?? [],
      connections: connections ?? [],
      investors: investors ?? [],
      programConnections: connectionsData.connections,
      connectionMatches: connectionsData.matches,
      introRequests: connectionsData.requests,
    };
  });

export const upsertProgramCoach = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        id: z.string().uuid().optional().nullable(),
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
        expertise: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
        photoUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const payload = {
      program_id: programId,
      name: data.name,
      email: data.email || null,
      expertise: data.expertise,
      photo_url: data.photoUrl || null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("program_coaches")
        .update(payload)
        .eq("program_id", programId)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("program_coaches")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteProgramCoach = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_coaches")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignProgramCoach = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        coachId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    let coachName: string | null = null;
    if (data.coachId) {
      const { data: coach } = await supabaseAdmin
        .from("program_coaches")
        .select("name")
        .eq("program_id", programId)
        .eq("id", data.coachId)
        .maybeSingle();
      coachName = (coach as { name: string } | null)?.name ?? null;
    }
    const { error } = await supabaseAdmin
      .from("program_startups")
      .update({ coach_id: data.coachId, coach_name: coachName })
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setInvestorReady = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ slug: z.string().min(1), startupId: z.string().uuid(), ready: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_startups")
      .update({ investor_ready: data.ready })
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchVenturaInvestors = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), query: z.string().trim().max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    await requireProgram(data.slug);
    if (data.query.length < 2) return { investors: [] };

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "investor");
    const ids = ((roles ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
    if (!ids.length) return { investors: [] };

    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, organization, avatar_url")
      .in("id", ids)
      .or(`full_name.ilike.%${data.query}%,organization.ilike.%${data.query}%`)
      .limit(10);
    return { investors: rows ?? [] };
  });

export const upsertInvestorConnection = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        id: z.string().uuid().optional().nullable(),
        startupId: z.string().uuid(),
        investorUserId: z.string().uuid().optional().nullable(),
        externalName: z.string().trim().max(160).optional().nullable(),
        status: z.enum(["suggested", "intro_sent", "meeting_held", "passed"]),
        note: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    if (!data.investorUserId && !data.externalName) throw new Error("Investor is required");

    const payload = {
      program_id: programId,
      startup_id: data.startupId,
      investor_user_id: data.investorUserId || null,
      external_name: data.externalName || null,
      status: data.status,
      note: data.note || null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("program_investor_connections")
        .update(payload)
        .eq("program_id", programId)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("program_investor_connections").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvestorConnection = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_investor_connections")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
