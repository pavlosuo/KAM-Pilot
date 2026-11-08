import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getProgramAccess = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { getProgramSessionRaw } = await import("@/design-system/ventura-6bef42/lib/program-session.server");

    const { data: program } = await supabaseAdmin
      .from("programs")
      .select("id, name, slug, description, logo_url, theme_color, background_mode, is_active")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!program || !(program as { is_active: boolean }).is_active) {
      return { exists: false as const, unlocked: false as const, program: null };
    }

    const session = await getProgramSessionRaw();
    const unlocked =
      session.data.programId === (program as { id: string }).id &&
      session.data.slug === data.slug;

    return {
      exists: true as const,
      unlocked,
      program: {
        name: (program as { name: string }).name,
        slug: data.slug,
        description: (program as { description: string | null }).description,
        logoUrl: (program as { logo_url: string | null }).logo_url,
        themeColor: (program as { theme_color: string | null }).theme_color,
        backgroundMode:
          ((program as { background_mode?: string | null }).background_mode ?? "light") === "dark"
            ? ("dark" as const)
            : ("light" as const),
      },
    };
  });

export const loginProgram = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        loginId: z.string().min(1).max(120),
        password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { verifyPassword } = await import("@/design-system/ventura-6bef42/lib/program-crypto.server");
    const { getProgramSessionRaw } = await import("@/design-system/ventura-6bef42/lib/program-session.server");

    const { data: program } = await supabaseAdmin
      .from("programs")
      .select("id, is_active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!program || !(program as { is_active: boolean }).is_active) {
      return { ok: false as const };
    }
    const programId = (program as { id: string }).id;

    const { data: cred } = await supabaseAdmin
      .from("program_credentials")
      .select("id, login_id, password_hash")
      .eq("program_id", programId)
      .maybeSingle();
    if (!cred) return { ok: false as const };

    const row = cred as { id: string; login_id: string; password_hash: string };
    if (row.login_id.toLowerCase() !== data.loginId.trim().toLowerCase()) {
      return { ok: false as const };
    }
    const valid = await verifyPassword(data.password, row.password_hash);
    if (!valid) return { ok: false as const };

    await supabaseAdmin
      .from("program_credentials")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", row.id);

    const session = await getProgramSessionRaw();
    await session.update({ programId, slug: data.slug });
    return { ok: true as const };
  });

export const logoutProgram = createServerFn({ method: "POST" }).handler(async () => {
  const { getProgramSessionRaw } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const session = await getProgramSessionRaw();
  await session.clear();
  return { ok: true as const };
});

/**
 * Program sign-in from the shared login page: resolves the program by login ID
 * alone, so leads no longer need their private dashboard link to sign in.
 */
export const loginProgramByCredentials = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        loginId: z.string().min(1).max(120),
        password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { verifyPassword } = await import("@/design-system/ventura-6bef42/lib/program-crypto.server");
    const { getProgramSessionRaw } = await import("@/design-system/ventura-6bef42/lib/program-session.server");

    const loginId = data.loginId.trim();
    const { data: creds } = await supabaseAdmin
      .from("program_credentials")
      .select("id, login_id, password_hash, program_id")
      .ilike("login_id", loginId)
      .limit(5);

    const rows = (creds ?? []) as {
      id: string;
      login_id: string;
      password_hash: string;
      program_id: string;
    }[];

    for (const row of rows) {
      if (row.login_id.toLowerCase() !== loginId.toLowerCase()) continue;
      const valid = await verifyPassword(data.password, row.password_hash);
      if (!valid) continue;

      const { data: program } = await supabaseAdmin
        .from("programs")
        .select("id, slug, is_active")
        .eq("id", row.program_id)
        .maybeSingle();
      const p = program as { id: string; slug: string; is_active: boolean } | null;
      if (!p || !p.is_active) return { ok: false as const, slug: null };

      await supabaseAdmin
        .from("program_credentials")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", row.id);

      const session = await getProgramSessionRaw();
      await session.update({ programId: p.id, slug: p.slug });
      return { ok: true as const, slug: p.slug };
    }

    return { ok: false as const, slug: null };
  });
