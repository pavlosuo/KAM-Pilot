import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export type AiCreditPool = {
  programId: string;
  programName: string;
  pool: "founder" | "lead";
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
};

/** Founder pools for every program the signed-in user's startups belong to. */
export const getMyAiCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiCreditPool[]> => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { getAiPoolStatus } = await import("@/design-system/ventura-6bef42/lib/ai-credits.server");
    const userId = context.userId;
    const [{ data: owned }, { data: memberOf }] = await Promise.all([
      supabaseAdmin
        .from("startups")
        .select("id")
        .eq("owner_id", userId)
        .eq("is_demo", false),
      supabaseAdmin.from("startup_members").select("startup_id").eq("user_id", userId),
    ]);
    const startupIds = [
      ...((owned ?? []) as Array<{ id: string }>).map((r) => r.id),
      ...((memberOf ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id),
    ];
    if (!startupIds.length) return [];
    const { data: ps } = await supabaseAdmin
      .from("program_startups")
      .select("program_id, programs(name)")
      .in("startup_id", startupIds)
      .eq("status", "approved");
    const programs = new Map<string, string>();
    for (const r of (ps ?? []) as Array<{ program_id: string; programs: { name: string } | null }>) {
      programs.set(r.program_id, r.programs?.name ?? "Program");
    }
    return Promise.all(
      [...programs].map(async ([programId, programName]) => ({
        programId,
        programName,
        ...(await getAiPoolStatus(supabaseAdmin, programId, "founder", userId)),
      })),
    );
  });

/** Lead pool for the program dashboard the caller is signed into. */
export const getProgramAiCredits = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<AiCreditPool[]> => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { getAiPoolStatus } = await import("@/design-system/ventura-6bef42/lib/ai-credits.server");
    const programId = await requireProgram(data.slug);
    const { data: program } = await supabaseAdmin.from("programs").select("name").eq("id", programId).maybeSingle();
    const name = (program as { name?: string } | null)?.name ?? "Program";
    const [lead, founder] = await Promise.all([
      getAiPoolStatus(supabaseAdmin, programId, "lead"),
      getAiPoolStatus(supabaseAdmin, programId, "founder"),
    ]);
    return [
      { programId, programName: name, ...lead },
      { programId, programName: name, ...founder },
    ];
  });
