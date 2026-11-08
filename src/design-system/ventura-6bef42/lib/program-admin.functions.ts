import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export const listPrograms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdminUser } = await import("@/design-system/ventura-6bef42/lib/program-admin.server");
    await assertAdminUser(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const { data: programs, error } = await supabaseAdmin
      .from("programs")
      .select("id, name, slug, description, logo_url, theme_color, background_mode, is_active, created_at, cohort_start_date")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (programs ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      logo_url: string | null;
      theme_color: string | null;
      background_mode: string | null;
      is_active: boolean;
      created_at: string;
      cohort_start_date: string | null;
    }>;

    const ids = rows.map((r) => r.id);
    const counts = new Map<string, { approved: number; pending: number }>();
    const logins = new Map<string, string>();
    if (ids.length > 0) {
      const [{ data: members }, { data: creds }] = await Promise.all([
        supabaseAdmin.from("program_startups").select("program_id, status").in("program_id", ids),
        supabaseAdmin.from("program_credentials").select("program_id, login_id").in("program_id", ids),
      ]);
      for (const m of (members ?? []) as Array<{ program_id: string; status: string }>) {
        const c = counts.get(m.program_id) ?? { approved: 0, pending: 0 };
        if (m.status === "approved") c.approved += 1;
        if (m.status === "pending") c.pending += 1;
        counts.set(m.program_id, c);
      }
      for (const c of (creds ?? []) as Array<{ program_id: string; login_id: string }>) {
        logins.set(c.program_id, c.login_id);
      }
    }

    return {
      programs: rows.map((r) => ({
        ...r,
        loginId: logins.get(r.id) ?? null,
        approvedCount: counts.get(r.id)?.approved ?? 0,
        pendingCount: counts.get(r.id)?.pending ?? 0,
      })),
    };
  });

export const createProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(2000).optional().nullable(),
        logoUrl: z.string().trim().url().max(500).optional().nullable(),
        cohortStartDate: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-01")
          .optional()
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminUser } = await import("@/design-system/ventura-6bef42/lib/program-admin.server");
    await assertAdminUser(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { hashPassword, randomString, slugifyProgram } = await import(
      "@/design-system/ventura-6bef42/lib/program-crypto.server"
    );

    const slug = slugifyProgram(data.name);
    const { data: program, error } = await supabaseAdmin
      .from("programs")
      .insert({
        name: data.name,
        slug,
        description: data.description || null,
        logo_url: data.logoUrl || null,
        cohort_start_date: data.cohortStartDate || null,
        created_by: context.userId,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    const loginId = `${slug.split("-").slice(0, -1).join("-") || "program"}-lead`;
    const password = randomString(14);
    const { error: credError } = await supabaseAdmin.from("program_credentials").insert({
      program_id: (program as { id: string }).id,
      login_id: loginId,
      password_hash: await hashPassword(password),
    });
    if (credError) throw new Error(credError.message);

    return { slug: (program as { slug: string }).slug, loginId, password };
  });

export const updateProgramBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        programId: z.string().uuid(),
        name: z.string().trim().min(2).max(120).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        logoUrl: z.string().trim().max(1000).url().nullable().optional(),
        themeColor: z
          .string()
          .trim()
          .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4F46E5")
          .nullable()
          .optional(),
        backgroundMode: z.enum(["light", "dark"]).optional(),
        cohortStartDate: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-01")
          .nullable()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminUser } = await import("@/design-system/ventura-6bef42/lib/program-admin.server");
    await assertAdminUser(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const patch: {
      name?: string;
      description?: string | null;
      logo_url?: string | null;
      theme_color?: string | null;
      background_mode?: string;
      cohort_start_date?: string | null;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl || null;
    if (data.themeColor !== undefined) patch.theme_color = data.themeColor || null;
    if (data.backgroundMode !== undefined) patch.background_mode = data.backgroundMode;
    if (data.cohortStartDate !== undefined) patch.cohort_start_date = data.cohortStartDate || null;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("programs").update(patch).eq("id", data.programId);
    if (error) throw new Error(error.message);

    if (data.logoUrl !== undefined) {
      const { syncProgramBackingLogos } = await import("@/design-system/ventura-6bef42/lib/program-backing.server");
      await syncProgramBackingLogos(supabaseAdmin, data.programId);
    }
    return { ok: true };
  });

export const rotateProgramPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ programId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdminUser } = await import("@/design-system/ventura-6bef42/lib/program-admin.server");
    await assertAdminUser(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { hashPassword, randomString } = await import("@/design-system/ventura-6bef42/lib/program-crypto.server");

    const password = randomString(14);
    const { data: existing } = await supabaseAdmin
      .from("program_credentials")
      .select("id, login_id")
      .eq("program_id", data.programId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("program_credentials")
        .update({ password_hash: await hashPassword(password) })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
      return { loginId: (existing as { login_id: string }).login_id, password };
    }

    const loginId = `program-${randomString(5).toLowerCase()}-lead`;
    const { error } = await supabaseAdmin.from("program_credentials").insert({
      program_id: data.programId,
      login_id: loginId,
      password_hash: await hashPassword(password),
    });
    if (error) throw new Error(error.message);
    return { loginId, password };
  });

export const setProgramActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ programId: z.string().uuid(), isActive: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminUser } = await import("@/design-system/ventura-6bef42/lib/program-admin.server");
    await assertAdminUser(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("programs")
      .update({ is_active: data.isActive })
      .eq("id", data.programId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ programId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdminUser } = await import("@/design-system/ventura-6bef42/lib/program-admin.server");
    await assertAdminUser(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("programs").delete().eq("id", data.programId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
