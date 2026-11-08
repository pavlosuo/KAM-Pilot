import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const senderRoleSchema = z.enum(["founder", "investor", "mentor", "admin"]);
type SenderRole = z.infer<typeof senderRoleSchema>;

export type InboxItem = {
  id: string;
  kind: "comment" | "message" | "announcement" | "event" | "document" | "alert";
  title: string;
  body: string;
  createdAt: string;
  context: string | null;
  href?: string | null;
  pinned?: boolean;
  downloadHref?: string | null;
  fileName?: string | null;
};

export type InboxMessage = {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  mine: boolean;
  senderId: string;
  senderName: string;
  attachmentName: string | null;
  attachmentHref: string | null;
};

export type InboxThread = {
  id: string;
  startupId: string;
  startupName: string;
  personId: string;
  personName: string;
  personAvatar: string | null;
  unread: number;
  lastMessageAt: string;
  messages: InboxMessage[];
};

export type InboxCommentGroup = {
  startupId: string;
  startupName: string;
  latestAt: string;
  count: number;
  preview: string;
};

const messageInput = z.object({
  startupId: z.string().uuid(),
  recipientId: z.string().uuid(),
  senderRole: senderRoleSchema,
  body: z.string().trim().max(5000).optional().default(""),
  attachment: z.object({
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.string().trim().min(1).max(160),
    fileBase64: z.string().min(1).max(20_000_000),
  }).optional().nullable(),
});

async function userStartupIds(supabase: any, userId: string) {
  const [owned, member] = await Promise.all([
    supabase
      .from("startups")
      .select("id, name")
      .eq("owner_id", userId)
      .eq("is_demo", false),
    supabase.from("startup_members").select("startup_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>((owned.data ?? []).map((row: { id: string }) => row.id));
  for (const row of (member.data ?? []) as Array<{ startup_id: string }>) ids.add(row.startup_id);
  return { ids, owned: (owned.data ?? []) as Array<{ id: string; name: string }> };
}

export const getInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const startupAccess = await userStartupIds(supabase, userId);
    const startupIds = [...startupAccess.ids];

    const { data: messageData } = await supabaseAdmin
      .from("messages")
      .select("id, body, created_at, read_at, startup_id, sender_id, recipient_id, sender_role, attachment_path, attachment_name")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true })
      .limit(1000);
    const messageRows = (messageData ?? []) as Array<{ id: string; body: string; created_at: string; read_at: string | null; startup_id: string; sender_id: string; recipient_id: string; sender_role: SenderRole | null; attachment_path: string | null; attachment_name: string | null }>;
    const allStartupIds = [...new Set([...startupIds, ...messageRows.map((row) => row.startup_id)])];
    const participantIds = [...new Set(messageRows.flatMap((row) => [row.sender_id, row.recipient_id]).filter((id) => id !== userId))];

    const [{ data: startupRows }, { data: profileRows }, { data: founderRows }, { data: investorRows }, { data: coachRows }, { data: programRows }] = await Promise.all([
      allStartupIds.length ? supabaseAdmin.from("startups").select("id, name, owner_id, logo_url").in("id", allStartupIds) : Promise.resolve({ data: [] }),
      participantIds.length ? supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", participantIds) : Promise.resolve({ data: [] }),
      participantIds.length ? supabaseAdmin.from("founder_accounts").select("user_id, full_name, photo_url").in("user_id", participantIds) : Promise.resolve({ data: [] }),
      participantIds.length ? supabaseAdmin.from("investor_profiles").select("user_id, full_name, photo_url").in("user_id", participantIds) : Promise.resolve({ data: [] }),
      participantIds.length ? supabaseAdmin.from("coach_profiles").select("user_id, full_name, photo_url").in("user_id", participantIds) : Promise.resolve({ data: [] }),
      participantIds.length ? supabaseAdmin.from("programs").select("id, name").in("id", participantIds) : Promise.resolve({ data: [] }),
    ]);
    const startups = (startupRows ?? []) as Array<{ id: string; name: string; owner_id: string; logo_url: string | null }>;
    const startupById = new Map(startups.map((row) => [row.id, row]));
    const profiles = (profileRows ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
    const profileById = new Map(profiles.map((row) => [row.id, row]));
    type RoleProfile = { user_id: string; full_name: string | null; photo_url: string | null };
    const founderById = new Map(((founderRows ?? []) as RoleProfile[]).map((row) => [row.user_id, row]));
    const investorById = new Map(((investorRows ?? []) as RoleProfile[]).map((row) => [row.user_id, row]));
    const coachById = new Map(((coachRows ?? []) as RoleProfile[]).map((row) => [row.user_id, row]));
    const senderRoleById = new Map<string, SenderRole>();
    for (const row of messageRows) if (row.sender_role) senderRoleById.set(row.sender_id, row.sender_role);
    const roleIdentity = (userId: string, role: SenderRole | null, preferFounder = false) => {
      const base = profileById.get(userId);
      const preferred = role === "founder"
        ? founderById.get(userId)
        : role === "investor"
          ? investorById.get(userId)
          : role === "mentor"
            ? coachById.get(userId)
            : preferFounder
              ? founderById.get(userId)
              : investorById.get(userId) ?? coachById.get(userId) ?? founderById.get(userId);
      return {
        name: preferred?.full_name ?? base?.full_name ?? "Ventura member",
        avatar: preferred?.photo_url ?? base?.avatar_url ?? null,
      };
    };
    const programs = (programRows ?? []) as Array<{ id: string; name: string }>;
    const programById = new Map(programs.map((row) => [row.id, row]));

    const attachmentPaths = messageRows.map((row) => row.attachment_path).filter((path): path is string => Boolean(path));
    const attachmentByPath = new Map<string, string>();
    if (attachmentPaths.length) {
      const { data: signed } = await supabaseAdmin.storage.from("program-documents").createSignedUrls(attachmentPaths, 60 * 60);
      for (const row of signed ?? []) if (row.path && row.signedUrl) attachmentByPath.set(row.path, row.signedUrl);
    }

    const threadMap = new Map<string, InboxThread>();
    const programThreadMap = new Map<string, InboxThread>();
    const programMessages: InboxItem[] = [];
    for (const row of messageRows) {
      const mine = row.sender_id === userId;
      const otherId = mine ? row.recipient_id : row.sender_id;
      const program = programById.get(otherId);
      if (program) {
        const key = `${row.startup_id}:${program.id}`;
        const programThread = programThreadMap.get(key) ?? {
          id: key,
          startupId: row.startup_id,
          startupName: startupById.get(row.startup_id)?.name ?? "Startup",
          personId: program.id,
          personName: program.name,
          personAvatar: null,
          unread: 0,
          lastMessageAt: row.created_at,
          messages: [],
        };
        programThread.messages.push({
          id: row.id, body: row.body, createdAt: row.created_at, readAt: row.read_at, mine,
          senderId: row.sender_id, senderName: mine ? "You" : program.name,
          attachmentName: row.attachment_name,
          attachmentHref: row.attachment_path ? attachmentByPath.get(row.attachment_path) ?? null : null,
        });
        if (!mine && !row.read_at) programThread.unread += 1;
        programThread.lastMessageAt = row.created_at;
        programThreadMap.set(key, programThread);
        if (!mine) programMessages.push({
          id: `message-${row.id}`, kind: "message", title: `Message from ${program.name}`, body: row.body,
          createdAt: row.created_at, context: startupById.get(row.startup_id)?.name ?? null,
          href: row.attachment_path ? attachmentByPath.get(row.attachment_path) ?? null : null,
          fileName: row.attachment_name,
        });
        continue;
      }
      const viewingAsStartup = startupAccess.ids.has(row.startup_id);
      const startup = startupById.get(row.startup_id);
      const personId = viewingAsStartup ? otherId : (startup?.owner_id ?? otherId);
      const otherIdentity = roleIdentity(personId, senderRoleById.get(personId) ?? null, !viewingAsStartup);
      const key = `${row.startup_id}:${viewingAsStartup ? otherId : "startup"}`;
      const thread = threadMap.get(key) ?? {
        id: key,
        startupId: row.startup_id,
        startupName: startup?.name ?? "Startup",
        personId,
        personName: otherIdentity.name,
        personAvatar: otherIdentity.avatar,
        unread: 0,
        lastMessageAt: row.created_at,
        messages: [],
      };
      thread.messages.push({
        id: row.id, body: row.body, createdAt: row.created_at, readAt: row.read_at, mine,
        senderId: row.sender_id,
        senderName: mine ? "You" : roleIdentity(row.sender_id, row.sender_role, !viewingAsStartup).name,
        attachmentName: row.attachment_name,
        attachmentHref: row.attachment_path ? attachmentByPath.get(row.attachment_path) ?? null : null,
      });
      if (!mine && !row.read_at) thread.unread += 1;
      thread.lastMessageAt = row.created_at;
      threadMap.set(key, thread);
    }

    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const isFounder = ((roleRows ?? []) as Array<{ role: string }>).some((row) => row.role === "founder");

    const items: InboxItem[] = [...programMessages];
    const commentGroups: InboxCommentGroup[] = [];
    let programIds: string[] = [];
    let hasPitchVideo = false;
    if (startupIds.length) {
      const { data: comments } = await supabaseAdmin.from("comments").select("id, body, created_at, startup_id, user_id").in("startup_id", startupIds).neq("user_id", userId).order("created_at", { ascending: false }).limit(100);
      const groups = new Map<string, InboxCommentGroup>();
      for (const row of (comments ?? []) as Array<{ id: string; body: string; created_at: string; startup_id: string; user_id: string }>) {
        const current = groups.get(row.startup_id);
        if (current) current.count += 1;
        else groups.set(row.startup_id, { startupId: row.startup_id, startupName: startupById.get(row.startup_id)?.name ?? "Startup", latestAt: row.created_at, count: 1, preview: row.body });
      }
      commentGroups.push(...groups.values());

      const [{ data: memberships }, { data: videoStartups }] = await Promise.all([
        supabaseAdmin.from("program_startups").select("program_id, status").in("startup_id", startupIds),
        supabaseAdmin.from("startups").select("id").in("id", startupIds).not("pitch_video_uid", "is", null).limit(1),
      ]);
      programIds = [...new Set(((memberships ?? []) as Array<{ program_id: string; status: string | null }>).filter((m) => m.status !== "rejected").map((m) => m.program_id))];
      hasPitchVideo = (videoStartups ?? []).length > 0;
      if (programIds.length) {
        const [{ data: programNames }, { data: anns }, { data: events }, { data: docs }] = await Promise.all([
          supabaseAdmin.from("programs").select("id, name").in("id", programIds),
          supabaseAdmin.from("program_announcements").select("id, title, body, is_pinned, published_at, program_id").in("program_id", programIds).order("published_at", { ascending: false }).limit(50),
          supabaseAdmin.from("program_events").select("id, title, description, starts_at, location, url, created_at, program_id").in("program_id", programIds).order("starts_at", { ascending: false }).limit(50),
          supabaseAdmin.from("program_documents").select("id, file_name, storage_path, created_at, program_id").in("program_id", programIds).order("created_at", { ascending: false }).limit(50),
        ]);
        const names = new Map(((programNames ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
        for (const row of (anns ?? []) as any[]) items.push({ id: `ann-${row.id}`, kind: "announcement", title: row.is_pinned ? `📌 ${row.title}` : row.title, body: row.body, createdAt: row.published_at, context: names.get(row.program_id) ?? "Program", pinned: Boolean(row.is_pinned) });
        for (const row of (events ?? []) as any[]) items.push({ id: `event-${row.id}`, kind: "event", title: row.title, body: [new Date(row.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }), row.location, row.description].filter(Boolean).join(" · "), createdAt: row.created_at, context: names.get(row.program_id) ?? "Program", href: row.url });
        const documentRows = (docs ?? []) as Array<{ id: string; file_name: string; storage_path: string; created_at: string; program_id: string }>;
        if (documentRows.length) {
          const paths = documentRows.map((row) => row.storage_path);
          const [{ data: views }, { data: downloads }] = await Promise.all([
            supabaseAdmin.storage.from("program-documents").createSignedUrls(paths, 60 * 60),
            supabaseAdmin.storage.from("program-documents").createSignedUrls(paths, 60 * 60, { download: true }),
          ]);
          const viewMap = new Map((views ?? []).flatMap((row) => row.path && row.signedUrl ? [[row.path, row.signedUrl] as const] : []));
          const downloadMap = new Map((downloads ?? []).flatMap((row) => row.path && row.signedUrl ? [[row.path, row.signedUrl] as const] : []));
          for (const row of documentRows) items.push({ id: `doc-${row.id}`, kind: "document", title: row.file_name, body: "Shared document from your program", createdAt: row.created_at, context: names.get(row.program_id) ?? "Program", href: viewMap.get(row.storage_path) ?? null, downloadHref: downloadMap.get(row.storage_path) ?? viewMap.get(row.storage_path) ?? null, fileName: row.file_name });
        }
      }
    }

    const { data: notifications } = await supabaseAdmin.from("user_notifications").select("id, title, body, context, href, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
    for (const row of (notifications ?? []) as any[]) items.push({ id: `alert-${row.id}`, kind: "alert", title: row.title, body: row.body, createdAt: row.created_at, context: row.context, href: row.href });

    items.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const threads = [...threadMap.values()].sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
    commentGroups.sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
    const programThreads = [...programThreadMap.values()].sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
    return {
      items: items.slice(0, 80),
      threads,
      programThreads,
      commentGroups,
      directUnread: threads.reduce((sum, thread) => sum + thread.unread, 0),
      programUnread: programThreads.reduce((sum, thread) => sum + thread.unread, 0),
      showProgramTab: isFounder && (programIds.length > 0 || programThreads.length > 0),
      showCommentsTab: isFounder && hasPitchVideo,
    };
  });

export const markInboxThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid(), personId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("startup_id", data.startupId).eq("sender_id", data.personId).eq("recipient_id", context.userId).is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendInboxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => messageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: roleRow } = await context.supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", data.senderRole).maybeSingle();
    if (!roleRow) throw new Error("This role is not active on your account.");
    const { data: prior } = await supabaseAdmin.from("messages").select("id").eq("startup_id", data.startupId).or(`and(sender_id.eq.${userId},recipient_id.eq.${data.recipientId}),and(sender_id.eq.${data.recipientId},recipient_id.eq.${userId})`).limit(1).maybeSingle();
    if (!prior) throw new Error("You can only reply to an existing conversation.");
    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    if (data.attachment) {
      const bytes = Buffer.from(data.attachment.fileBase64, "base64");
      if (!bytes.length || bytes.length > 400 * 1024 * 1024) throw new Error("Attachments must be under 400MB");
      attachmentName = data.attachment.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
      attachmentPath = `messages/direct/${userId}/${crypto.randomUUID()}-${attachmentName}`;
      const { error } = await supabaseAdmin.storage.from("program-documents").upload(attachmentPath, bytes, { contentType: data.attachment.mimeType, upsert: false });
      if (error) throw new Error(error.message);
    }
    if (!data.body && !attachmentPath) throw new Error("Write a message or attach a file");
    const { error } = await supabaseAdmin.from("messages").insert({ startup_id: data.startupId, sender_id: userId, recipient_id: data.recipientId, sender_role: data.senderRole, body: data.body || `📎 ${attachmentName}`, is_private: true, attachment_path: attachmentPath, attachment_name: attachmentName });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
