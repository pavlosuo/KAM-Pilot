import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import type { Database } from "@/design-system/ventura-6bef42/integrations/supabase/types";

const IdInput = z.object({ startupId: z.string().uuid() });

export const getEngagementCounts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

    // Try to read bearer token to determine liked-by-me. Falls back to anon.
    let userId: string | null = null;
    let supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    try {
      const authHeader = getRequest()?.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        const authed = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData } = await authed.auth.getClaims(token);
        if (claimsData?.claims?.sub) {
          userId = claimsData.claims.sub;
          supabase = authed;
        }
      }
    } catch {
      // ignore — treat as anon
    }

    const [likes, comments, mine] = await Promise.all([
      supabase.from("likes").select("id", { count: "exact", head: true }).eq("startup_id", data.startupId),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("startup_id", data.startupId),
      userId
        ? supabase.from("likes").select("id").eq("startup_id", data.startupId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      likes: likes.count ?? 0,
      comments: comments.count ?? 0,
      liked: !!mine.data,
    };
  });


export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("likes")
      .select("id")
      .eq("startup_id", data.startupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.data) {
      await supabase.from("likes").delete().eq("id", existing.data.id);
      return { liked: false };
    }
    await supabase.from("likes").insert({ startup_id: data.startupId, user_id: userId });
    return { liked: true };
  });

export type CommentNode = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  author: { full_name: string | null; avatar_url: string | null; handle: string | null };
  like_count: number;
  liked: boolean;
  replies: CommentNode[];
};

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }): Promise<{ comments: CommentNode[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("comments")
      .select("id, user_id, body, created_at, parent_id")
      .eq("startup_id", data.startupId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const list = rows ?? [];
    if (list.length === 0) return { comments: [] };

    const userIds = [...new Set(list.map((c) => c.user_id))];
    const commentIds = list.map((c) => c.id);

    const [profsRes, likesRes, myLikesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, handle").in("id", userIds),
      supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds),
      supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds).eq("user_id", userId),
    ]);

    const profiles: Record<string, { full_name: string | null; avatar_url: string | null; handle: string | null }> =
      Object.fromEntries(
        (profsRes.data ?? []).map((p) => [
          p.id,
          { full_name: p.full_name, avatar_url: p.avatar_url, handle: p.handle },
        ]),
      );

    const likeCounts: Record<string, number> = {};
    for (const row of likesRes.data ?? []) {
      likeCounts[row.comment_id] = (likeCounts[row.comment_id] ?? 0) + 1;
    }
    const myLiked = new Set((myLikesRes.data ?? []).map((r) => r.comment_id));

    const nodes: Record<string, CommentNode> = {};
    for (const c of list) {
      nodes[c.id] = {
        id: c.id,
        user_id: c.user_id,
        body: c.body,
        created_at: c.created_at,
        parent_id: c.parent_id,
        author: profiles[c.user_id] ?? { full_name: null, avatar_url: null, handle: null },
        like_count: likeCounts[c.id] ?? 0,
        liked: myLiked.has(c.id),
        replies: [],
      };
    }
    const roots: CommentNode[] = [];
    for (const c of list) {
      const node = nodes[c.id];
      if (c.parent_id && nodes[c.parent_id]) {
        nodes[c.parent_id].replies.push(node);
      } else {
        roots.push(node);
      }
    }
    roots.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { comments: roots };
  });

const AddCommentInput = z.object({
  startupId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().uuid().nullable().optional(),
});

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddCommentInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let parentId: string | null = data.parentId ?? null;
    // If replying to a reply, flatten to root parent so we stay 2-level.
    if (parentId) {
      const { data: parent } = await supabase
        .from("comments")
        .select("id, parent_id, startup_id")
        .eq("id", parentId)
        .maybeSingle();
      if (!parent || parent.startup_id !== data.startupId) {
        throw new Error("Invalid parent comment");
      }
      if (parent.parent_id) parentId = parent.parent_id;
    }
    const { data: row, error } = await supabase
      .from("comments")
      .insert({ startup_id: data.startupId, user_id: userId, body: data.body, parent_id: parentId })
      .select("id, user_id, body, created_at, parent_id")
      .single();
    if (error) throw error;

    try {
      const { sendInboxEmails, startupTeamUserIds } = await import("@/design-system/ventura-6bef42/lib/inbox-email.server");
      const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
      const [team, { data: startup }, { data: author }] = await Promise.all([
        startupTeamUserIds(data.startupId),
        supabaseAdmin.from("startups").select("name").eq("id", data.startupId).maybeSingle(),
        supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      await sendInboxEmails(
        team.filter((id) => id !== userId),
        {
          eventId: `comment-${row.id}`,
          kindLabel: "Comment",
          title: `${(author as { full_name: string | null } | null)?.full_name ?? "Someone"} commented on your pitch video`,
          body: data.body,
          context: (startup as { name: string } | null)?.name ?? null,
        },
      );
    } catch (e) {
      console.error("[addComment] inbox email failed", e);
    }

    return { comment: row };
  });


export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("comments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const toggleCommentLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ commentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("comment_likes")
      .select("id")
      .eq("comment_id", data.commentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.data) {
      await supabase.from("comment_likes").delete().eq("id", existing.data.id);
      return { liked: false };
    }
    await supabase.from("comment_likes").insert({ comment_id: data.commentId, user_id: userId });
    return { liked: true };
  });

export const searchMentionUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ q: z.string().trim().min(1).max(50) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.q.replace(/[%,]/g, "");
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, full_name, handle, avatar_url")
      .not("handle", "is", null)
      .or(`handle.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(8);
    if (error) throw error;
    return { users: rows ?? [] };
  });
