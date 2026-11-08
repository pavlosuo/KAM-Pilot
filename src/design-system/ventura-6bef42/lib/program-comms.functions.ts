import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listProgramComms = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const [{ data: announcements }, { data: events }, { data: documents }] = await Promise.all([
      supabaseAdmin
        .from("program_announcements")
        .select("id, title, body, is_pinned, published_at")
        .eq("program_id", programId)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false }),
      supabaseAdmin
        .from("program_events")
        .select("id, title, description, starts_at, location, url")
        .eq("program_id", programId)
        .order("starts_at", { ascending: true }),
      supabaseAdmin
        .from("program_documents")
        .select("id, file_name, file_size, mime_type, storage_path, created_at")
        .eq("program_id", programId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      announcements: announcements ?? [],
      events: events ?? [],
      documents: documents ?? [],
    };
  });

export const upsertProgramAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        id: z.string().uuid().optional().nullable(),
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(5000),
        isPinned: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const payload = {
      program_id: programId,
      title: data.title,
      body: data.body,
      is_pinned: data.isPinned,
    };
    const q = data.id
      ? supabaseAdmin
          .from("program_announcements")
          .update(payload)
          .eq("program_id", programId)
          .eq("id", data.id)
      : supabaseAdmin.from("program_announcements").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);

    if (!data.id) {
      const { sendProgramInboxEmails, programMemberUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [members, name] = await Promise.all([
        programMemberUserIds(programId),
        programName(programId),
      ]);
      await sendProgramInboxEmails(members, {
        eventId: `ann-${programId}-${data.title}-${Date.now()}`,
        kindLabel: "Announcement",
        title: data.title,
        body: data.body,
        context: name,
      });
    }
    return { ok: true };
  });


export const deleteProgramAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_announcements")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertProgramEvent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        id: z.string().uuid().optional().nullable(),
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().max(2000).optional().nullable(),
        startsAt: z.string().min(4),
        location: z.string().trim().max(160).optional().nullable(),
        url: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const payload = {
      program_id: programId,
      title: data.title,
      description: data.description || null,
      starts_at: new Date(data.startsAt).toISOString(),
      location: data.location || null,
      url: data.url || null,
    };
    const q = data.id
      ? supabaseAdmin
          .from("program_events")
          .update(payload)
          .eq("program_id", programId)
          .eq("id", data.id)
      : supabaseAdmin.from("program_events").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);

    if (!data.id) {
      const { sendProgramInboxEmails, programMemberUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [members, name] = await Promise.all([
        programMemberUserIds(programId),
        programName(programId),
      ]);
      const when = new Date(payload.starts_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      await sendProgramInboxEmails(members, {
        eventId: `event-${programId}-${data.title}-${payload.starts_at}`,
        kindLabel: "Event",
        title: data.title,
        body: [when, payload.location, payload.description].filter(Boolean).join(" · "),
        context: name,
        linkUrl: payload.url,
        linkLabel: "Event details",
      });
    }
    return { ok: true };

  });

export const deleteProgramEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_events")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadProgramDocument = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().max(120).default("application/octet-stream"),
        base64: z.string().min(1).max(20_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const path = `${programId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("program-documents")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { error } = await supabaseAdmin.from("program_documents").insert({
      program_id: programId,
      storage_path: path,
      file_name: data.fileName,
      file_size: bytes.length,
      mime_type: data.mimeType,
    });
    if (error) throw new Error(error.message);

    {
      const { sendProgramInboxEmails, programMemberUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [members, name, { data: signed }] = await Promise.all([
        programMemberUserIds(programId),
        programName(programId),
        supabaseAdmin.storage.from("program-documents").createSignedUrl(path, 60 * 60 * 24 * 7),
      ]);
      await sendProgramInboxEmails(members, {
        eventId: `doc-${path}`,
        kindLabel: "Document",
        title: data.fileName,
        body: "A new document was shared with your program.",
        context: name,
        linkUrl: signed?.signedUrl ?? null,
        linkLabel: "Open document",
      });
    }
    return { ok: true };

  });

export const getProgramDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { data: doc } = await supabaseAdmin
      .from("program_documents")
      .select("storage_path")
      .eq("program_id", programId)
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Not found");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("program-documents")
      .createSignedUrl((doc as { storage_path: string }).storage_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

export const deleteProgramDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { data: doc } = await supabaseAdmin
      .from("program_documents")
      .select("storage_path")
      .eq("program_id", programId)
      .eq("id", data.id)
      .maybeSingle();
    if (doc) {
      await supabaseAdmin.storage
        .from("program-documents")
        .remove([(doc as { storage_path: string }).storage_path]);
    }
    const { error } = await supabaseAdmin
      .from("program_documents")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProgramInboxMessages = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select("id, body, created_at, read_at, startup_id, sender_id")
      .eq("recipient_id", programId)
      .order("created_at", { ascending: false })
      .limit(50);

    const msgRows = (rows ?? []) as Array<{
      id: string;
      body: string;
      created_at: string;
      read_at: string | null;
      startup_id: string;
      sender_id: string;
    }>;

    const startupIds = Array.from(new Set(msgRows.map((m) => m.startup_id)));
    const senderIds = Array.from(new Set(msgRows.map((m) => m.sender_id)));

    const [{ data: startups }, { data: profiles }] = await Promise.all([
      startupIds.length
        ? supabaseAdmin.from("startups").select("id, name, slug").in("id", startupIds)
        : Promise.resolve({ data: [] }),
      senderIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", senderIds)
        : Promise.resolve({ data: [] }),
    ]);

    const startupById = new Map(
      ((startups ?? []) as Array<{ id: string; name: string; slug: string }>).map((s) => [s.id, s]),
    );
    const profileById = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
        p.id,
        p.full_name ?? "Founder",
      ]),
    );

    const messages = msgRows.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      readAt: m.read_at,
      startup: startupById.get(m.startup_id) ?? null,
      senderName: profileById.get(m.sender_id) ?? "Founder",
      senderId: m.sender_id,
    }));

    return { messages };
  });

export const markProgramInboxRead = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { error } = await supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.messageId)
      .eq("recipient_id", programId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendProgramStartupMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: link } = await supabaseAdmin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (!link) throw new Error("Startup is not part of this program");

    const { sendProgramInboxEmails, startupTeamUserIds, programName } = await import(
      "@/design-system/ventura-6bef42/lib/inbox-email.server"
    );
    const [recipients, name] = await Promise.all([
      startupTeamUserIds(data.startupId),
      programName(programId),
    ]);
    if (!recipients.length) return { ok: true, recipients: 0 };

    const { error } = await supabaseAdmin.from("messages").insert(
      recipients.map((uid) => ({
        startup_id: data.startupId,
        sender_id: programId,
        recipient_id: uid,
        body: data.body,
      })),
    );
    if (error) throw new Error(error.message);

    await sendProgramInboxEmails(recipients, {
      eventId: `pmsg-${programId}-${data.startupId}-${Date.now()}`,
      kindLabel: "Message",
      title: `Message from ${name ?? "your program"}`,
      body: data.body,
      context: name,
    });

    return { ok: true, recipients: recipients.length };
  });

export const sendProgramMemberMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        userId: z.string().uuid(),
        body: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: link } = await supabaseAdmin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (!link) throw new Error("Startup is not part of this program");

    const { sendProgramInboxEmails, startupTeamUserIds, programName } = await import(
      "@/design-system/ventura-6bef42/lib/inbox-email.server"
    );
    const [recipients, name] = await Promise.all([
      startupTeamUserIds(data.startupId),
      programName(programId),
    ]);
    if (!recipients.includes(data.userId)) throw new Error("Not a member of this startup");

    const { error } = await supabaseAdmin.from("messages").insert({
      startup_id: data.startupId,
      sender_id: programId,
      recipient_id: data.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);

    await sendProgramInboxEmails([data.userId], {
      eventId: `pmsg-${programId}-${data.userId}-${Date.now()}`,
      kindLabel: "Message",
      title: `Message from ${name ?? "your program"}`,
      body: data.body,
      context: name,
    });

    return { ok: true };
  });

export type ProgramInboxMessage = {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  fromProgram: boolean;
  senderId: string;
  senderName: string;
  audience: "team" | "personal";
  attachmentName?: string | null;
  attachmentHref?: string | null;
};

export type ProgramInboxThread = {
  /** Unique thread key: `${startupId}:team` or `${startupId}:${userId}`. */
  id: string;
  kind: "team" | "personal";
  /** Founder on the other side for personal threads. */
  personUserId: string | null;
  personName: string | null;
  startupId: string;
  startupName: string;
  startupSlug: string;
  unread: number;
  lastMessageAt: string;
  messages: ProgramInboxMessage[];
};


/** Full chat history (both directions) grouped per startup. */
export const listProgramInboxThreads = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select(
        "id, body, created_at, read_at, startup_id, sender_id, recipient_id, is_private, attachment_path, attachment_name",
      )
      .or(`recipient_id.eq.${programId},sender_id.eq.${programId}`)
      .order("created_at", { ascending: true })
      .limit(1000);

    const msgRows = (rows ?? []) as Array<{
      id: string;
      body: string;
      created_at: string;
      read_at: string | null;
      startup_id: string;
      sender_id: string;
      recipient_id: string;
      is_private: boolean | null;
      attachment_path?: string | null;
      attachment_name?: string | null;
    }>;
    if (!msgRows.length) return { threads: [] as ProgramInboxThread[] };

    // Signed links for founder message attachments.
    const attachmentPaths = msgRows
      .map((m) => m.attachment_path)
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

    const startupIds = Array.from(new Set(msgRows.map((m) => m.startup_id)));
    const senderIds = Array.from(
      new Set(
        msgRows.flatMap((m) =>
          m.sender_id === programId
            ? m.recipient_id === programId
              ? []
              : [m.recipient_id]
            : [m.sender_id],
        ),
      ),
    );


    const [{ data: startups }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("startups").select("id, name, slug").in("id", startupIds),
      senderIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", senderIds)
        : Promise.resolve({ data: [] }),
    ]);

    const startupById = new Map(
      ((startups ?? []) as Array<{ id: string; name: string; slug: string }>).map((s) => [s.id, s]),
    );
    const nameById = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
        p.id,
        p.full_name ?? "Founder",
      ]),
    );

    // Program messages to a whole team are fanned out as one row per member.
    const fanout = new Map<string, number>();
    for (const m of msgRows) {
      if (m.sender_id !== programId) continue;
      const key = `${m.startup_id}-${m.created_at}-${m.body}`;
      fanout.set(key, (fanout.get(key) ?? 0) + 1);
    }

    const threads = new Map<string, ProgramInboxThread>();
    const seen = new Set<string>();
    for (const m of msgRows) {
      const fromProgram = m.sender_id === programId;
      const dedupe = `${m.startup_id}-${fromProgram ? "p" : m.sender_id}-${m.created_at}-${m.body}`;
      if (fromProgram) {
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
      }
      const isPersonal = fromProgram
        ? (fanout.get(`${m.startup_id}-${m.created_at}-${m.body}`) ?? 1) === 1
        : Boolean(m.is_private);
      const personId = isPersonal ? (fromProgram ? m.recipient_id : m.sender_id) : null;
      const key = `${m.startup_id}:${personId ?? "team"}`;

      const startup = startupById.get(m.startup_id);
      const thread =
        threads.get(key) ??
        ({
          id: key,
          kind: personId ? "personal" : "team",
          personUserId: personId,
          personName: personId ? (nameById.get(personId) ?? "Founder") : null,
          startupId: m.startup_id,
          startupName: startup?.name ?? "Startup",
          startupSlug: startup?.slug ?? "",
          unread: 0,
          lastMessageAt: m.created_at,
          messages: [],
        } satisfies ProgramInboxThread);
      thread.messages.push({
        id: m.id,
        body: m.body,
        createdAt: m.created_at,
        readAt: m.read_at,
        fromProgram,
        senderId: m.sender_id,
        senderName: fromProgram ? "Program" : (nameById.get(m.sender_id) ?? "Founder"),
        audience: isPersonal ? "personal" : "team",
        attachmentName: m.attachment_name ?? null,
        attachmentHref: m.attachment_path ? (attachmentLinks.get(m.attachment_path) ?? null) : null,
      });
      if (!fromProgram && !m.read_at) thread.unread += 1;
      thread.lastMessageAt = m.created_at;
      threads.set(key, thread);
    }

    return {
      threads: Array.from(threads.values()).sort((a, b) =>
        a.lastMessageAt < b.lastMessageAt ? 1 : -1,
      ),
    };

  });

/** Mention autocomplete for program leads: team members of the startup in the thread. */
export const searchProgramMentionUsers = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), startupId: z.string().uuid(), q: z.string().trim().max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: link } = await supabaseAdmin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (!link) return { users: [] };

    const { startupTeamUserIds } = await import("@/design-system/ventura-6bef42/lib/inbox-email.server");
    const ids = await startupTeamUserIds(data.startupId);
    if (!ids.length) return { users: [] };

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, handle, avatar_url")
      .in("id", ids)
      .limit(20);

    const q = data.q.toLowerCase();
    const users = ((profs ?? []) as Array<{
      id: string;
      full_name: string | null;
      handle: string | null;
      avatar_url: string | null;
    }>).filter(
      (u) =>
        !q ||
        (u.handle ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q),
    );
    return { users: users.slice(0, 8) };
  });

/** Mark founder messages in a thread as read (optionally only one founder's private thread). */
export const markProgramThreadRead = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        startupId: z.string().uuid(),
        senderId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    let q = supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", programId)
      .eq("startup_id", data.startupId)
      .is("read_at", null);
    if (data.senderId) q = q.eq("sender_id", data.senderId);
    await q;
    return { ok: true };

  });

export const deleteProgramMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), messageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: row } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, startup_id, body, created_at")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!row) throw new Error("Message not found");
    const message = row as {
      sender_id: string;
      startup_id: string;
      body: string;
      created_at: string;
    };
    if (message.sender_id === programId) {
      // Program messages are fanned out to each team member — remove every copy.
      const { error } = await supabaseAdmin
        .from("messages")
        .delete()
        .eq("sender_id", programId)
        .eq("startup_id", message.startup_id)
        .eq("body", message.body)
        .eq("created_at", message.created_at);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Program leads can moderate messages inside their own program's threads.
    const { data: member } = await supabaseAdmin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("startup_id", message.startup_id)
      .maybeSingle();
    if (!member) throw new Error("You can only delete messages in your program");

    const { error } = await supabaseAdmin
      .from("messages")
      .delete()
      .eq("id", data.messageId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
