import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export type ProgramThreadItem = {
  id: string;
  kind: "sent" | "reply" | "announcement" | "event" | "document";
  author: string;
  body: string;
  title?: string | null;
  createdAt: string;
  href?: string | null;
  downloadHref?: string | null;
  audience?: "team" | "personal";
  pinned?: boolean;
  attachmentName?: string | null;
  attachmentHref?: string | null;
};

export const getProgramThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ startupId: z.string().uuid(), programId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: membership } = await supabase
      .from("program_startups")
      .select("id, status")
      .eq("program_id", data.programId)
      .eq("startup_id", data.startupId)
      .maybeSingle();

    if (!membership || (membership as { status: string }).status !== "approved") {
      return { items: [] as ProgramThreadItem[] };
    }

    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const [{ data: program }, { data: messages }, { data: announcements }, { data: events }, { data: documents }] =
      await Promise.all([
        supabaseAdmin.from("programs").select("name").eq("id", data.programId).maybeSingle(),
        supabaseAdmin
          .from("messages")
          .select("id, body, created_at, sender_id, recipient_id, is_private, attachment_path, attachment_name")
          .eq("startup_id", data.startupId)
          .or(`recipient_id.eq.${data.programId},sender_id.eq.${data.programId}`)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("program_announcements")
          .select("id, title, body, is_pinned, published_at")
          .eq("program_id", data.programId)
          .order("published_at", { ascending: false })
          .limit(30),
        supabaseAdmin
          .from("program_events")
          .select("id, title, description, starts_at, location, url, created_at")
          .eq("program_id", data.programId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabaseAdmin
          .from("program_documents")
          .select("id, file_name, storage_path, created_at")
          .eq("program_id", data.programId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

    const programLabel = (program as { name: string } | null)?.name ?? "Program leads";
    const items: ProgramThreadItem[] = [];
    const messageRows = (messages ?? []) as Array<{
      id: string;
      body: string;
      created_at: string;
      sender_id: string;
      recipient_id: string;
      is_private: boolean | null;
      attachment_path?: string | null;
      attachment_name?: string | null;
    }>;
    const senderIds = Array.from(
      new Set(messageRows.filter((message) => message.sender_id !== data.programId).map((message) => message.sender_id)),
    );
    const senderNames = new Map<string, string>();
    if (senderIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      for (const profile of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
        senderNames.set(profile.id, profile.full_name ?? "Teammate");
      }
    }

    // Signed links for message attachments.
    const attachmentPaths = messageRows
      .map((message) => message.attachment_path)
      .filter((path): path is string => !!path);
    const attachmentLinks = new Map<string, string>();
    if (attachmentPaths.length) {
      const { data: signed } = await supabaseAdmin.storage
        .from("program-documents")
        .createSignedUrls(attachmentPaths, 60 * 60);
      for (const row of signed ?? []) {
        if (row.path && row.signedUrl) attachmentLinks.set(row.path, row.signedUrl);
      }
    }

    const fanout = new Map<string, Set<string>>();
    for (const message of messageRows) {
      if (message.sender_id !== data.programId) continue;
      const key = `${message.created_at}-${message.body}`;
      const recipients = fanout.get(key) ?? new Set<string>();
      recipients.add(message.recipient_id);
      fanout.set(key, recipients);
    }

    const seen = new Set<string>();
    for (const message of messageRows) {
      const fromProgram = message.sender_id === data.programId;
      if (fromProgram && message.recipient_id !== userId) continue;
      if (!fromProgram && message.is_private && message.sender_id !== userId) continue;
      const dedupe = `${fromProgram ? "p" : message.sender_id}-${message.created_at}-${message.body}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const audience: "team" | "personal" = fromProgram
        ? (fanout.get(`${message.created_at}-${message.body}`)?.size ?? 1) > 1
          ? "team"
          : "personal"
        : message.is_private
          ? "personal"
          : "team";
      items.push({
        id: `msg-${message.id}`,
        kind: fromProgram ? "reply" : "sent",
        author: fromProgram
          ? programLabel
          : message.sender_id === userId
            ? "You"
            : (senderNames.get(message.sender_id) ?? "Teammate"),
        body: message.body,
        createdAt: message.created_at,
        audience,
        attachmentName: message.attachment_name ?? null,
        attachmentHref: message.attachment_path
          ? (attachmentLinks.get(message.attachment_path) ?? null)
          : null,
      });
    }

    for (const announcement of (announcements ?? []) as Array<{
      id: string;
      title: string;
      body: string;
      is_pinned: boolean | null;
      published_at: string;
    }>) {
      items.push({
        id: `ann-${announcement.id}`,
        kind: "announcement",
        author: programLabel,
        title: announcement.is_pinned ? `📌 ${announcement.title}` : announcement.title,
        body: announcement.body,
        createdAt: announcement.published_at,
        pinned: Boolean(announcement.is_pinned),
      });
    }

    for (const event of (events ?? []) as Array<{
      id: string;
      title: string;
      description: string | null;
      starts_at: string;
      location: string | null;
      url: string | null;
      created_at: string;
    }>) {
      const when = new Date(event.starts_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      items.push({
        id: `event-${event.id}`,
        kind: "event",
        author: programLabel,
        title: event.title,
        body: [when, event.location, event.description].filter(Boolean).join(" · "),
        createdAt: event.created_at,
        href: event.url,
      });
    }

    const documentRows = (documents ?? []) as Array<{
      id: string;
      file_name: string;
      storage_path: string;
      created_at: string;
    }>;
    if (documentRows.length) {
      const paths = documentRows.map((document) => document.storage_path);
      const [{ data: signed }, { data: downloads }] = await Promise.all([
        supabaseAdmin.storage.from("program-documents").createSignedUrls(paths, 60 * 60),
        supabaseAdmin.storage.from("program-documents").createSignedUrls(paths, 60 * 60, { download: true }),
      ]);
      const viewUrls = new Map<string, string>();
      const downloadUrls = new Map<string, string>();
      for (const result of (signed ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
        if (result.path && result.signedUrl) viewUrls.set(result.path, result.signedUrl);
      }
      for (const result of (downloads ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
        if (result.path && result.signedUrl) downloadUrls.set(result.path, result.signedUrl);
      }
      for (const document of documentRows) {
        items.push({
          id: `doc-${document.id}`,
          kind: "document",
          author: programLabel,
          title: document.file_name,
          body: "Shared document from your program",
          createdAt: document.created_at,
          href: viewUrls.get(document.storage_path) ?? null,
          downloadHref: downloadUrls.get(document.storage_path) ?? viewUrls.get(document.storage_path) ?? null,
        });
      }
    }

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { items };
  });