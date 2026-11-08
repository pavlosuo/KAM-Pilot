import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Current login id + branding for the signed-in program lead. */
export const getProgramSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const [{ data: program }, { data: cred }] = await Promise.all([
      supabaseAdmin
        .from("programs")
        .select("logo_url, theme_color, background_mode")
        .eq("id", programId)
        .maybeSingle(),
      supabaseAdmin.from("program_credentials").select("login_id").eq("program_id", programId).maybeSingle(),
    ]);

    return {
      logoUrl: (program as { logo_url: string | null } | null)?.logo_url ?? null,
      themeColor: (program as { theme_color: string | null } | null)?.theme_color ?? null,
      backgroundMode:
        ((program as { background_mode?: string | null } | null)?.background_mode ?? "light") === "dark"
          ? ("dark" as const)
          : ("light" as const),
      loginId: (cred as { login_id: string } | null)?.login_id ?? "",
    };
  });

/** Update dashboard branding (logo + theme colour) as the program lead. */
export const updateProgramSelfBranding = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        logoUrl: z.string().trim().max(1000).url().nullable(),
        themeColor: z
          .string()
          .trim()
          .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4F46E5")
          .nullable(),
        backgroundMode: z.enum(["light", "dark"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { error } = await supabaseAdmin
      .from("programs")
      .update({
        logo_url: data.logoUrl,
        theme_color: data.themeColor,
        ...(data.backgroundMode ? { background_mode: data.backgroundMode } : {}),
      })
      .eq("id", programId);
    if (error) throw new Error(error.message);
    const { syncProgramBackingLogos } = await import("@/design-system/ventura-6bef42/lib/program-backing.server");
    await syncProgramBackingLogos(supabaseAdmin, programId);
    return { ok: true as const };
  });

/** Upload a new dashboard logo. Accepts a base64 payload from the program lead. */
export const uploadProgramLogo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        base64: z.string().min(1).max(4_000_000),
        contentType: z.string().min(1).max(100),
        ext: z.string().trim().max(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    if (!/^image\//.test(data.contentType)) throw new Error("Only image files are allowed");

    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const ext = (data.ext || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
    const path = `programs/${programId}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("startup-logos")
      .upload(path, bytes, { upsert: true, contentType: data.contentType });
    if (error) throw new Error(error.message);

    const { data: pub } = supabaseAdmin.storage.from("startup-logos").getPublicUrl(path);
    return { url: pub.publicUrl };
  });

/** Change the program-lead login id and/or password. Requires the current password. */
export const updateProgramCredentials = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        currentPassword: z.string().min(1).max(200),
        loginId: z.string().trim().min(3).max(120).optional(),
        newPassword: z.string().min(8).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { hashPassword, verifyPassword } = await import("@/design-system/ventura-6bef42/lib/program-crypto.server");
    const programId = await requireProgram(data.slug);

    const { data: cred } = await supabaseAdmin
      .from("program_credentials")
      .select("id, password_hash")
      .eq("program_id", programId)
      .maybeSingle();
    if (!cred) throw new Error("No credentials configured for this program");
    const row = cred as { id: string; password_hash: string };

    const valid = await verifyPassword(data.currentPassword, row.password_hash);
    if (!valid) return { ok: false as const, reason: "invalid_password" as const };

    const patch: { login_id?: string; password_hash?: string } = {};
    if (data.loginId) patch.login_id = data.loginId;
    if (data.newPassword) patch.password_hash = await hashPassword(data.newPassword);
    if (Object.keys(patch).length === 0) return { ok: true as const };

    if (patch.login_id) {
      const { data: clash } = await supabaseAdmin
        .from("program_credentials")
        .select("id")
        .eq("login_id", patch.login_id)
        .neq("id", row.id)
        .maybeSingle();
      if (clash) return { ok: false as const, reason: "login_taken" as const };
    }

    const { error } = await supabaseAdmin.from("program_credentials").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
