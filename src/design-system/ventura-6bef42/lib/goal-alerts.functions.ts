import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

/**
 * Goal alerts: an investor/mentor asks to be notified when a startup reaches
 * a goal. A weekly cron job checks published weekly updates against the goal.
 */
export const createGoalAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupName: z.string().trim().min(1).max(120),
        goal: z.string().trim().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("startups")
      .select("id, name, slug")
      .eq("is_published", true)
      .eq("is_paused", false)
      .ilike("name", `%${data.startupName}%`)
      .limit(5);

    const candidates = (rows ?? []) as Array<{ id: string; name: string; slug: string }>;
    const exact = candidates.find(
      (row) => row.name.trim().toLowerCase() === data.startupName.trim().toLowerCase(),
    );
    const startup = exact ?? candidates[0];
    if (!startup) {
      throw new Error(`No active startup called "${data.startupName}" was found on Ventura.`);
    }

    const sentence = `Send me an email when ${startup.name} reaches ${data.goal}.`;

    const { error } = await supabaseAdmin.from("goal_alerts").insert({
      user_id: context.userId,
      startup_id: startup.id,
      goal_text: data.goal,
      sentence,
      status: "active",
    });
    if (error) throw new Error(error.message);

    return { sentence, startupName: startup.name, startupSlug: startup.slug };
  });

export const checkStartupExists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupName: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("startups")
      .select("id, name, slug")
      .eq("is_published", true)
      .eq("is_paused", false)
      .ilike("name", `%${data.startupName}%`)
      .limit(5);

    const candidates = (rows ?? []) as Array<{ id: string; name: string; slug: string }>;
    const exact = candidates.find(
      (row) => row.name.trim().toLowerCase() === data.startupName.trim().toLowerCase(),
    );
    const startup = exact ?? candidates[0];
    return { exists: Boolean(startup), name: startup?.name ?? null };
  });

export const listGoalAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("goal_alerts")
      .select("id, goal_text, sentence, status, created_at, startup_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { alerts: data ?? [] };
  });

export const cancelGoalAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ alertId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("goal_alerts")
      .update({ status: "cancelled" })
      .eq("id", data.alertId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { cancelled: true };
  });
