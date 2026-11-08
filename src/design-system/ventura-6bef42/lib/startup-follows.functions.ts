import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const toggleSchema = z.object({
  startupId: z.string().uuid(),
  follow: z.boolean(),
});

export const toggleStartupFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => toggleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.follow) {
      const { error } = await supabase
        .from("startup_follows")
        .upsert(
          { user_id: userId, startup_id: data.startupId },
          { onConflict: "user_id,startup_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("startup_follows")
        .delete()
        .eq("user_id", userId)
        .eq("startup_id", data.startupId);
      if (error) throw error;
    }
    return { following: data.follow };
  });

export const listMyStartupFollows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("startup_follows")
      .select("startup_id")
      .eq("user_id", userId);
    if (error) throw error;
    return { startupIds: ((data ?? []) as { startup_id: string }[]).map((r) => r.startup_id) };
  });

export type FollowNewsItem = {
  key: string;
  kind: "progression_card" | "weekly_update" | "pitch_video" | "pitch_deck";
  startupId: string;
  startupName: string;
  startupSlug: string;
  logoUrl: string | null;
  title: string;
  subtitle: string | null;
  at: string; // ISO
};

export type FollowedStartup = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  followedAt: string;
};


export const getFollowedStartupsNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: follows, error: fErr } = await supabase
      .from("startup_follows")
      .select("startup_id, created_at")
      .eq("user_id", userId);
    if (fErr) throw fErr;
    const followRows = (follows ?? []) as { startup_id: string; created_at: string }[];
    const ids = followRows.map((r) => r.startup_id);
    const followedAt = new Map(followRows.map((r) => [r.startup_id, new Date(r.created_at).getTime()] as const));
    if (ids.length === 0) return { items: [] as FollowNewsItem[], followed: [] as FollowedStartup[] };



    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;

    const [startupsRes, updatesRes, cardsRes] = await Promise.all([
      sb
        .from("startups")
        .select("id, name, slug, logo_url, pitch_deck_url, pitch_video_uid, pitch_video_status, updated_at")
        .in("id", ids),
      sb
        .from("weekly_updates")
        .select("id, startup_id, title, published_at, is_published")
        .in("startup_id", ids)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(50),
      sb
        .from("startup_progression_cards")
        .select("id, startup_id, label, value, created_at, is_public")
        .in("startup_id", ids)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    const startups = (startupsRes.data ?? []) as Array<{
      id: string; name: string; slug: string; logo_url: string | null;
      pitch_deck_url: string | null; pitch_video_uid: string | null;
      pitch_video_status: string | null; updated_at: string;
    }>;
    const byId = new Map(startups.map((s) => [s.id, s] as const));

    const items: FollowNewsItem[] = [];

    const isAfterFollow = (startupId: string, at: string | null) => {
      if (!at) return false;
      const followed = followedAt.get(startupId);
      if (followed === undefined) return false;
      return new Date(at).getTime() >= followed;
    };

    for (const u of (updatesRes.data ?? []) as Array<{
      id: string; startup_id: string; title: string | null; published_at: string | null;
    }>) {
      const s = byId.get(u.startup_id);
      if (!s || !u.published_at) continue;
      if (!isAfterFollow(u.startup_id, u.published_at)) continue;
      items.push({
        key: `wu-${u.id}`,
        kind: "weekly_update",
        startupId: s.id,
        startupName: s.name,
        startupSlug: s.slug,
        logoUrl: s.logo_url,
        title: "New weekly update",
        subtitle: u.title ?? null,
        at: u.published_at,
      });
    }

    for (const c of (cardsRes.data ?? []) as Array<{
      id: string; startup_id: string; label: string; value: string | null; created_at: string;
    }>) {
      const s = byId.get(c.startup_id);
      if (!s) continue;
      if (!isAfterFollow(c.startup_id, c.created_at)) continue;
      items.push({
        key: `pc-${c.id}`,
        kind: "progression_card",
        startupId: s.id,
        startupName: s.name,
        startupSlug: s.slug,
        logoUrl: s.logo_url,
        title: `Milestone: ${c.label}`,
        subtitle: c.value,
        at: c.created_at,
      });
    }

    for (const s of startups) {
      if (s.pitch_video_uid && isAfterFollow(s.id, s.updated_at)) {
        items.push({
          key: `pv-${s.id}`,
          kind: "pitch_video",
          startupId: s.id,
          startupName: s.name,
          startupSlug: s.slug,
          logoUrl: s.logo_url,
          title: "New pitch video uploaded",
          subtitle: null,
          at: s.updated_at,
        });
      }
      if (s.pitch_deck_url && isAfterFollow(s.id, s.updated_at)) {
        items.push({
          key: `pd-${s.id}`,
          kind: "pitch_deck",
          startupId: s.id,
          startupName: s.name,
          startupSlug: s.slug,
          logoUrl: s.logo_url,
          title: "Pitch deck updated",
          subtitle: null,
          at: s.updated_at,
        });
      }
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const followed: FollowedStartup[] = followRows
      .map((r) => {
        const s = byId.get(r.startup_id);
        if (!s) return null;
        return {
          id: s.id,
          name: s.name,
          slug: s.slug,
          logoUrl: s.logo_url,
          followedAt: r.created_at,
        };
      })
      .filter((x): x is FollowedStartup => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { items: items.slice(0, 100), followed };
  });


