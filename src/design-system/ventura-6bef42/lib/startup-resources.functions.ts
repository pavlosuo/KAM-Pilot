import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({
  startupId: z.string().uuid(),
  programId: z.string().uuid().nullable().optional(),
});

export type StartupResource = {
  id: string;
  position: number;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  sourceLabel: string | null;
  imageUrl: string | null;
};

/**
 * Resources for the current week. Generated on Mondays by cron; if the week's
 * batch is missing (new startup, cron miss), it is generated on first view.
 */
export const getStartupResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { mondayOf } = await import("@/design-system/ventura-6bef42/lib/startup-resources.server");
    const weekOf = mondayOf();

    // RLS limits reads to the startup's own team.
    const read = async () =>
      supabase
        .from("startup_ai_resources")
        .select("id, position, kind, title, description, url, source_label, image_url")
        .eq("startup_id", data.startupId)
        .eq("week_of", weekOf)
        .order("position", { ascending: true });

    let { data: rows } = await read();

    if (!rows?.length) {
      const { refreshStartupResources } = await import("@/design-system/ventura-6bef42/lib/startup-resources.server");
      const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
      // Only team members reach this point (RLS-backed membership check below).
      const { data: allowed } = await supabase
        .from("startups")
        .select("id")
        .eq("id", data.startupId)
        .maybeSingle();
      if (!allowed) throw new Error("Startup not found");

      try {
        await refreshStartupResources(
          supabaseAdmin,
          data.startupId,
          data.programId ?? null,
          weekOf,
        );
      } catch (e) {
        return { weekOf, resources: [] as StartupResource[], error: (e as Error).message };
      }
      ({ data: rows } = await read());
    }

    const list = ((rows ?? []) as Array<{
      id: string;
      position: number;
      kind: string;
      title: string;
      description: string | null;
      url: string | null;
      source_label: string | null;
      image_url: string | null;
    }>).map((r) => ({
      id: r.id,
      position: r.position,
      kind: r.kind,
      title: r.title,
      description: r.description,
      url: r.url,
      sourceLabel: r.source_label,
      imageUrl: r.image_url,
    }));

    return { weekOf, resources: list, error: null as string | null };
  });
