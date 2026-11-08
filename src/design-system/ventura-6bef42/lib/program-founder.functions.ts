import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

// Founder-facing view of everything their startup's program shares with them.
export const sendMessageToProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        programId: z.string().uuid(),
        body: z.string().trim().max(5000).optional().default(""),
        attachment: z
          .object({
            fileName: z.string().trim().min(1).max(200),
            mimeType: z.string().trim().min(1).max(160),
            fileBase64: z.string().min(1),
          })
          .optional()
          .nullable(),
        /** "private" = visible only to the sender and the program leads. */
        visibility: z.enum(["team", "private"]).optional().default("team"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    const [{ data: startup }, { data: membership }] = await Promise.all([
      supabase.from("startups").select("id, owner_id").eq("id", data.startupId).maybeSingle(),
      supabase
        .from("program_startups")
        .select("id, status")
        .eq("program_id", data.programId)
        .eq("startup_id", data.startupId)
        .maybeSingle(),
    ]);

    if (!startup) throw new Error("Startup not found");
    const isOwner = (startup as { owner_id: string }).owner_id === userId;
    let isMember = false;
    if (!isOwner) {
      const { data: member } = await supabase
        .from("startup_members")
        .select("id")
        .eq("startup_id", data.startupId)
        .eq("user_id", userId)
        .maybeSingle();
      isMember = !!member;
    }
    if (!isOwner && !isMember) throw new Error("You are not a member of this startup");
    if (!membership || (membership as { status: string }).status !== "approved") {
      throw new Error("Startup is not part of this program");
    }

    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    if (data.attachment) {
      const binary = Buffer.from(data.attachment.fileBase64, "base64");
      if (binary.byteLength === 0) throw new Error("The attached file is empty");
      if (binary.byteLength > 400 * 1024 * 1024) throw new Error("Attachments must be under 400MB");
      const safeName = data.attachment.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
      const path = `messages/${data.programId}/${data.startupId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("program-documents")
        .upload(path, binary, { contentType: data.attachment.mimeType, upsert: false });
      if (upErr) throw new Error(upErr.message);
      attachmentPath = path;
      attachmentName = safeName;
    }

    if (!data.body && !attachmentPath) throw new Error("Write a message or attach a file");

    const { error } = await supabaseAdmin.from("messages").insert({
      startup_id: data.startupId,
      sender_id: userId,
      recipient_id: data.programId,
      sender_role: "founder",
      body: data.body || (attachmentName ? `📎 ${attachmentName}` : ""),
      is_private: data.visibility === "private",
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const getFounderProgramPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: memberships } = await supabase
      .from("program_startups")
      .select("program_id, status, coach_id, programs(id, name, logo_url, description)")
      .eq("startup_id", data.startupId)
      .eq("status", "approved");

    const rows = (memberships ?? []) as Array<{
      program_id: string;
      coach_id: string | null;
      programs: { id: string; name: string; logo_url: string | null; description: string | null } | null;
    }>;
    if (!rows.length) return { programs: [] };

    const programIds = rows.map((r) => r.program_id);

    const [{ data: assignments }, { data: announcements }, { data: events }, { data: coaches }] =
      await Promise.all([
        supabase
          .from("program_kpi_assignments")
          .select(
            "id, program_id, current_value, completed_at, updated_at, program_kpis(id, title, description, target_value, unit, due_date)",
          )
          .eq("startup_id", data.startupId)
          .in("program_id", programIds),
        supabase
          .from("program_announcements")
          .select("id, program_id, title, body, is_pinned, published_at")
          .in("program_id", programIds)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(20),
        supabase
          .from("program_events")
          .select("id, program_id, title, description, starts_at, location, url")
          .in("program_id", programIds)
          .gte("starts_at", new Date(Date.now() - 86400000).toISOString())
          .order("starts_at", { ascending: true })
          .limit(20),
        supabase
          .from("program_coaches")
          .select("id, program_id, name, email, expertise, photo_url")
          .in("program_id", programIds),
      ]);

    const coachList = (coaches ?? []) as Array<{
      id: string;
      program_id: string;
      name: string;
      email: string | null;
      expertise: string[] | null;
      photo_url: string | null;
    }>;

    return {
      programs: rows.map((r) => ({
        id: r.program_id,
        name: r.programs?.name ?? "Program",
        logoUrl: r.programs?.logo_url ?? null,
        description: r.programs?.description ?? null,
        coach: coachList.find((c) => c.id === r.coach_id) ?? null,
        kpis: (assignments ?? []).filter(
          (a) => (a as { program_id: string }).program_id === r.program_id,
        ),
        announcements: (announcements ?? []).filter(
          (a) => (a as { program_id: string }).program_id === r.program_id,
        ),
        events: (events ?? []).filter(
          (e) => (e as { program_id: string }).program_id === r.program_id,
        ),
      })),
    };
  });

export const reportFounderKpiValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        value: z.number().min(0).max(1_000_000_000),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: assignment, error: aErr } = await supabase
      .from("program_kpi_assignments")
      .select("id, program_kpis(target_value)")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!assignment) throw new Error("Not found");

    const target = Number(
      (assignment as unknown as { program_kpis?: { target_value: number } }).program_kpis
        ?.target_value ?? 0,
    );

    const { error: eErr } = await supabase.from("program_kpi_entries").insert({
      assignment_id: data.assignmentId,
      value: data.value,
      note: data.note || null,
      recorded_by_label: "Founder",
    });
    if (eErr) throw new Error(eErr.message);

    // Only the lead's approval completes the challenge, not hitting the target.
    const { error } = await supabase
      .from("program_kpi_assignments")
      .update({ current_value: data.value })
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

