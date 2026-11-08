import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

// Returns the latest published weekly update for a startup, with attachments
// (signed URLs). Visible only to team members of the startup. Returns null
// when the caller is not on the team or no published update exists.
export const getLatestUpdateForTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check team membership (owner or member). RLS on weekly_updates already
    // enforces this, but checking explicitly lets us return a clean null.
    const [{ data: ownerRow }, { data: memberRow }] = await Promise.all([
      supabase.from("startups").select("owner_id").eq("id", data.startupId).maybeSingle(),
      supabase.from("startup_members").select("id").eq("startup_id", data.startupId).eq("user_id", userId).maybeSingle(),
    ]);
    let isTeam =
      ((ownerRow as { owner_id: string } | null)?.owner_id === userId) || !!memberRow;
    if (!isTeam) {
      // Investors get read access to published updates on startup profiles.
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "investor")
        .maybeSingle();
      isTeam = !!roleRow;
    }
    if (!isTeam) return { update: null, attachments: [] };

    const { data: upd } = await supabase
      .from("weekly_updates")
      .select("id, title, summary, transcript, content, week_of, published_at, author_id")
      .eq("startup_id", data.startupId)
      .eq("is_published", true)
      .order("week_of", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!upd) return { update: null, attachments: [] };
    const update = upd as {
      id: string; title: string | null; summary: string | null; transcript: string | null;
      content: unknown; week_of: string; published_at: string | null; author_id: string;
    };

    let authorName: string | null = null;
    if (update.author_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", update.author_id)
        .maybeSingle();
      authorName = (p as { full_name: string | null } | null)?.full_name ?? null;
    }

    const { data: attRows } = await supabase
      .from("weekly_update_attachments")
      .select("id, storage_path, file_name, file_size, mime_type, created_at")
      .eq("weekly_update_id", update.id)
      .order("created_at", { ascending: true });

    const rows = (attRows ?? []) as Array<{
      id: string; storage_path: string; file_name: string; file_size: number; mime_type: string;
    }>;

    let attachments: Array<{
      id: string; file_name: string; file_size: number; mime_type: string; url: string | null;
    }> = [];
    if (rows.length > 0) {
      const paths = rows.map((r) => r.storage_path);
      const { data: signed } = await supabase.storage
        .from("update-attachments")
        .createSignedUrls(paths, 60 * 60);
      const byPath = new Map<string, string | null>(
        ((signed ?? []) as Array<{ path: string | null; signedUrl: string | null }>).map((s) => [
          s.path ?? "",
          s.signedUrl ?? null,
        ]),
      );
      attachments = rows.map((r) => ({
        id: r.id,
        file_name: r.file_name,
        file_size: r.file_size,
        mime_type: r.mime_type,
        url: byPath.get(r.storage_path) ?? null,
      }));
    }

    return {
      update: {
        id: update.id,
        title: update.title,
        summary: update.summary,
        transcript: update.transcript,
        week_of: update.week_of,
        published_at: update.published_at,
        author_id: update.author_id,
        author_name: authorName,
      },
      attachments,
    };
  });
