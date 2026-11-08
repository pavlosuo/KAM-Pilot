import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

// Founder-facing: look up an invitation and the caller's startups.
export const getProgramInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(6).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("program_invitations")
      .select("id, program_id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || (invite as { status: string }).status === "revoked") {
      return { valid: false as const, program: null, startups: [], alreadySubmitted: [] };
    }
    const programId = (invite as { program_id: string }).program_id;

    const { data: program } = await supabaseAdmin
      .from("programs")
      .select("name, description, logo_url, is_active")
      .eq("id", programId)
      .maybeSingle();
    if (!program || !(program as { is_active: boolean }).is_active) {
      return { valid: false as const, program: null, startups: [], alreadySubmitted: [] };
    }

    const { data: ownedRows } = await context.supabase
      .from("startups")
      .select("id, name, logo_url, is_published")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });

    const { data: memberRows } = await supabaseAdmin
      .from("startup_members")
      .select("startup_id")
      .eq("user_id", context.userId);

    const memberIds = ((memberRows ?? []) as Array<{ startup_id: string }>).map(
      (r) => r.startup_id,
    );

    type StartupRow = { id: string; name: string; logo_url: string | null; is_published: boolean };
    const byId = new Map<string, StartupRow>();
    for (const s of (ownedRows ?? []) as StartupRow[]) byId.set(s.id, s);

    const missing = memberIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      const { data: memberStartups } = await supabaseAdmin
        .from("startups")
        .select("id, name, logo_url, is_published")
        .in("id", missing)
        .order("created_at", { ascending: false });
      for (const s of (memberStartups ?? []) as StartupRow[]) byId.set(s.id, s);
    }

    const owned = Array.from(byId.values());
    const ids = owned.map((s) => s.id);
    let submitted: string[] = [];
    if (ids.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("program_startups")
        .select("startup_id")
        .eq("program_id", programId)
        .in("startup_id", ids);
      submitted = ((existing ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id);
    }

    return {
      valid: true as const,
      program: {
        name: (program as { name: string }).name,
        description: (program as { description: string | null }).description,
        logoUrl: (program as { logo_url: string | null }).logo_url,
      },
      startups: owned,
      alreadySubmitted: submitted,
    };
  });

export const submitStartupToProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ token: z.string().min(6).max(64), startupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("program_invitations")
      .select("id, program_id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || (invite as { status: string }).status === "revoked") {
      throw new Error("This invitation link is no longer valid");
    }

    const { data: ownedOne } = await context.supabase
      .from("startups")
      .select("id")
      .eq("id", data.startupId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!ownedOne) {
      const { data: membership } = await supabaseAdmin
        .from("startup_members")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!membership) throw new Error("You can only submit a startup you belong to");
    }

    const { error } = await supabaseAdmin.from("program_startups").upsert(
      {
        program_id: (invite as { program_id: string }).program_id,
        startup_id: data.startupId,
        status: "approved",
        joined_at: new Date().toISOString(),
        submitted_by: context.userId,
      },
      { onConflict: "program_id,startup_id" },
    );
    if (error) throw new Error(error.message);

    const { applyProgramBacking } = await import("@/design-system/ventura-6bef42/lib/program-backing.server");
    await applyProgramBacking(
      supabaseAdmin,
      (invite as { program_id: string }).program_id,
      data.startupId,
    );


    if ((invite as { status: string }).status === "open") {
      await supabaseAdmin
        .from("program_invitations")
        .update({ status: "used", used_at: new Date().toISOString(), used_by: context.userId })
        .eq("id", (invite as { id: string }).id);
    }

    return { ok: true };
  });

export const declineProgramInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(6).max(64) }).parse(d))
  .handler(async ({ data }) => {
    // Declining is a per-user choice and must not revoke the link for others.
    // The client clears the pending invite from localStorage after this call.
    return { ok: true };
  });

