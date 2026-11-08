import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  startupId: z.string().uuid(),
  ownerId: z.string().uuid(),
});

export type PitchAsideExperience = {
  id: string;
  kind: "experience";
  title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  logo_url: string | null;
};

export type PitchAsideEducation = {
  id: string;
  kind: "education";
  school: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  logo_url: string | null;
};

export type PitchAsideCard = {
  id: string;
  label: string;
  value: string | null;
  icon_name: string | null;
  image_url: string | null;
  description: string | null;
};


export const getPitchAsideData = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;

    const [expRes, eduRes, latestUpdRes] = await Promise.all([
      sb
        .from("founder_experiences")
        .select("id, title, company, start_date, end_date, is_current, logo_url")
        .eq("user_id", data.ownerId),
      sb
        .from("founder_education")
        .select("id, school, start_date, end_date, is_current, logo_url")
        .eq("user_id", data.ownerId),
      sb
        .from("weekly_updates")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("is_published", true)
        .order("week_of", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const experiences: PitchAsideExperience[] = ((expRes.data ?? []) as Array<{
      id: string;
      title: string;
      company: string;
      start_date: string | null;
      end_date: string | null;
      is_current: boolean;
      logo_url: string | null;
    }>).map((r) => ({ ...r, kind: "experience" as const }));

    const education: PitchAsideEducation[] = ((eduRes.data ?? []) as Array<{
      id: string;
      school: string;
      start_date: string | null;
      end_date: string | null;
      is_current: boolean;
      logo_url: string | null;
    }>).map((r) => ({ ...r, kind: "education" as const }));

    const updateId = (latestUpdRes.data as { id: string } | null)?.id ?? null;

    let cards: PitchAsideCard[] = [];
    if (updateId) {
      const { data: rows } = await sb
        .from("startup_progression_cards")
        .select("id, label, value, icon_name, image_url, description, display_order, is_public")
        .eq("startup_id", data.startupId)
        .eq("weekly_update_id", updateId)
        .eq("is_public", true)
        .order("display_order", { ascending: true });
      cards = ((rows ?? []) as Array<{ id: string; label: string; value: string | null; icon_name: string | null; image_url: string | null; description: string | null }>).map(
        (r) => ({ id: r.id, label: r.label, value: r.value, icon_name: r.icon_name, image_url: r.image_url, description: r.description }),
      );
    }

    return { experiences, education, cards };
  });
