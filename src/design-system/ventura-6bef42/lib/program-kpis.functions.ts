import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listProgramKpis = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const [{ data: kpis }, { data: assignments }, { data: members }] = await Promise.all([
      supabaseAdmin
        .from("program_kpis")
        .select("id, title, description, target_value, unit, due_date, proof_required, created_at")
        .eq("program_id", programId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("program_kpi_assignments")
        .select(
          "id, kpi_id, startup_id, current_value, completed_at, updated_at, due_date_override, postpone_reason, postponed_at, declined_at",
        )
        .eq("program_id", programId),

      supabaseAdmin
        .from("program_startups")
        .select("startup_id")
        .eq("program_id", programId)
        .eq("status", "approved"),
    ]);

    const ids = ((members ?? []) as Array<{ startup_id: string }>).map((m) => m.startup_id);
    const { data: startups } = await supabaseAdmin
      .from("startups")
      .select("id, name, logo_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    return {
      kpis: kpis ?? [],
      assignments: assignments ?? [],
      startups: startups ?? [],
    };
  });

export const createProgramKpi = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().max(2000).optional().nullable(),
        targetValue: z.number().min(0).max(1_000_000_000).optional().nullable(),
        unit: z.string().trim().max(40).optional().nullable(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        proofRequired: z.boolean().default(true),
        startupIds: z.array(z.string().uuid()).optional(),
        assignAll: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: kpi, error } = await supabaseAdmin
      .from("program_kpis")
      .insert({
        program_id: programId,
        title: data.title,
        description: data.description || null,
        target_value: data.targetValue ?? null,
        unit: data.unit || null,
        due_date: data.dueDate || null,
        proof_required: data.proofRequired,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    let targets = data.startupIds ?? [];
    if (data.assignAll) {
      const { data: members } = await supabaseAdmin
        .from("program_startups")
        .select("startup_id")
        .eq("program_id", programId)
        .eq("status", "approved");
      targets = ((members ?? []) as Array<{ startup_id: string }>).map((m) => m.startup_id);
    }
    if (targets.length) {
      const { error: aErr } = await supabaseAdmin.from("program_kpi_assignments").insert(
        targets.map((sid) => ({ kpi_id: kpi.id, program_id: programId, startup_id: sid })),
      );
      if (aErr) throw new Error(aErr.message);

      // Email founders about the new challenge — at most one email per person,
      // per program, per day (dedupe via the day-scoped event id).
      try {
        const { sendProgramInboxEmails, startupTeamUserIds, programName } = await import(
          "@/design-system/ventura-6bef42/lib/inbox-email.server"
        );
        const teams = await Promise.all(targets.map((sid) => startupTeamUserIds(sid)));
        const userIds = Array.from(new Set(teams.flat()));
        const name = (await programName(programId)) ?? "Your program";
        const day = new Date().toISOString().slice(0, 10);
        await sendProgramInboxEmails(userIds, {
          eventId: `new-challenge:${programId}:${day}`,
          kindLabel: "New challenge",
          title: `${name} set a new challenge`,
          body: `“${data.title}”${data.dueDate ? ` — due ${data.dueDate}` : ""}. Open your program page to see the details and track your progress.`,
          context: name,
          linkUrl: "https://venturafund.eu/program-content",
          linkLabel: "View challenges",
        });
      } catch (e) {
        console.error("[new-challenge email] failed", e);
      }
    }
    return { id: kpi.id as string };
  });

export const updateProgramKpi = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().max(2000).nullable(),
        targetValue: z.number().min(0).max(1_000_000_000).nullable(),
        unit: z.string().trim().max(40).nullable(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        proofRequired: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_kpis")
      .update({
        title: data.title,
        description: data.description || null,
        target_value: data.targetValue ?? null,
        unit: data.unit || null,
        due_date: data.dueDate || null,
        proof_required: data.proofRequired,
      })
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProgramKpi = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { error } = await supabaseAdmin
      .from("program_kpis")
      .delete()
      .eq("program_id", programId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setProgramKpiAssignees = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        kpiId: z.string().uuid(),
        startupIds: z.array(z.string().uuid()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: existing } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("id, startup_id")
      .eq("program_id", programId)
      .eq("kpi_id", data.kpiId);

    const rows = (existing ?? []) as Array<{ id: string; startup_id: string }>;
    const keep = new Set(data.startupIds);
    const remove = rows.filter((r) => !keep.has(r.startup_id)).map((r) => r.id);
    const have = new Set(rows.map((r) => r.startup_id));
    const add = data.startupIds.filter((s) => !have.has(s));

    if (remove.length) {
      await supabaseAdmin.from("program_kpi_assignments").delete().in("id", remove);
    }
    if (add.length) {
      await supabaseAdmin
        .from("program_kpi_assignments")
        .insert(add.map((sid) => ({ kpi_id: data.kpiId, program_id: programId, startup_id: sid })));
    }
    return { ok: true };
  });

export const getStartupKpis = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), startupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: assignments } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select(
        "id, kpi_id, current_value, completed_at, updated_at, program_kpis(id, title, description, target_value, unit, due_date)",
      )
      .eq("program_id", programId)
      .eq("startup_id", data.startupId);

    const ids = ((assignments ?? []) as Array<{ id: string }>).map((a) => a.id);
    const { data: entries } = await supabaseAdmin
      .from("program_kpi_entries")
      .select(
        "id, assignment_id, value, note, recorded_by_label, created_at, submitted_for_check, review_status, proof_path, proof_file_name",
      )
      .in("assignment_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    // Signed download links for proof files awaiting review.
    const { PROOF_BUCKET, parseProofList } = await import("@/design-system/ventura-6bef42/lib/program-content.server");
    const rows = (entries ?? []) as Array<{
      id: string;
      proof_path: string | null;
      proof_file_name: string | null;
      review_status: string | null;
      submitted_for_check: boolean | null;
    }>;
    const proofFiles: Record<string, Array<{ name: string; url: string }>> = {};
    for (const r of rows) {
      const paths = parseProofList(r.proof_path);
      if (!paths.length) continue;
      const names = parseProofList(r.proof_file_name);
      const files: Array<{ name: string; url: string }> = [];
      for (let i = 0; i < paths.length; i++) {
        const { data: signed } = await supabaseAdmin.storage
          .from(PROOF_BUCKET)
          .createSignedUrl(paths[i], 60 * 60);
        if (signed?.signedUrl) {
          files.push({ name: names[i] ?? names[0] ?? "proof", url: signed.signedUrl });
        }
      }
      if (files.length) proofFiles[r.id] = files;
    }

    return { assignments: assignments ?? [], entries: entries ?? [], proofFiles };
  });

/** All challenge submissions awaiting the program lead's review, with proof links. */
export const listChallengeSubmissions = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: assignments } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("id, kpi_id, startup_id, due_date_override, program_kpis(title, unit, target_value, due_date)")
      .eq("program_id", programId);

    const aRows = (assignments ?? []) as unknown as Array<{
      id: string;
      kpi_id: string;
      startup_id: string;
      due_date_override: string | null;
      program_kpis?: {
        title: string;
        unit: string | null;
        target_value: number | null;
        due_date: string | null;
      } | null;
    }>;
    if (!aRows.length) return { submissions: [] };

    const { data: entries } = await supabaseAdmin
      .from("program_kpi_entries")
      .select("id, assignment_id, value, note, proof_path, proof_file_name, created_at")
      .in("assignment_id", aRows.map((a) => a.id))
      .eq("submitted_for_check", true)
      .eq("review_status", "pending")
      .order("created_at", { ascending: false });

    const eRows = (entries ?? []) as Array<{
      id: string;
      assignment_id: string;
      value: number;
      note: string | null;
      proof_path: string | null;
      proof_file_name: string | null;
      created_at: string;
    }>;
    if (!eRows.length) return { submissions: [] };

    // Only the most recent pending submission per challenge assignment is shown;
    // resubmissions replace the previous card in the review queue.
    const latestByAssignment = new Map<string, (typeof eRows)[number]>();
    for (const e of eRows) {
      const prev = latestByAssignment.get(e.assignment_id);
      if (!prev || new Date(e.created_at).getTime() > new Date(prev.created_at).getTime()) {
        latestByAssignment.set(e.assignment_id, e);
      }
    }
    const latestRows = [...latestByAssignment.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const startupIds = [...new Set(aRows.map((a) => a.startup_id))];
    const { data: startups } = await supabaseAdmin
      .from("startups")
      .select("id, name")
      .in("id", startupIds);
    const nameById = new Map(
      ((startups ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]),
    );

    const { PROOF_BUCKET, parseProofList } = await import("@/design-system/ventura-6bef42/lib/program-content.server");
    const out = [];
    for (const e of latestRows) {
      const a = aRows.find((x) => x.id === e.assignment_id);
      if (!a) continue;
      const paths = parseProofList(e.proof_path);
      const names = parseProofList(e.proof_file_name);
      const proofFiles: Array<{ name: string; url: string }> = [];
      for (let i = 0; i < paths.length; i++) {
        const { data: signed } = await supabaseAdmin.storage
          .from(PROOF_BUCKET)
          .createSignedUrl(paths[i], 60 * 60);
        if (signed?.signedUrl) {
          proofFiles.push({ name: names[i] ?? names[0] ?? "proof", url: signed.signedUrl });
        }
      }
      out.push({
        id: e.id,
        assignmentId: a.id,
        kpiId: a.kpi_id,
        startupName: nameById.get(a.startup_id) ?? "Startup",
        challengeTitle: a.program_kpis?.title ?? "Challenge",
        unit: a.program_kpis?.unit ?? null,
        targetValue: a.program_kpis?.target_value ?? null,
        dueDate: a.due_date_override ?? a.program_kpis?.due_date ?? null,
        value: Number(e.value),
        note: e.note,
        proofFiles,
        createdAt: e.created_at,
      });
    }
    return { submissions: out };
  });

/** Program lead approves, postpones or declines a founder's challenge submission. */
export const reviewChallengeSubmission = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        entryId: z.string().uuid(),
        decision: z.enum(["approved", "declined", "postponed"]),
        newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        reason: z.string().trim().max(1000).optional().nullable(),
      })
      .refine((v) => v.decision !== "postponed" || !!v.newDueDate, {
        message: "A new deadline is required when postponing",
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: entry } = await supabaseAdmin
      .from("program_kpi_entries")
      .select("id, assignment_id, value, recorded_by_user_id, review_status")
      .eq("id", data.entryId)
      .maybeSingle();
    if (!entry) throw new Error("Submission not found");
    const e = entry as {
      id: string;
      assignment_id: string;
      value: number;
      recorded_by_user_id: string | null;
      review_status: string | null;
    };

    const { data: assignment } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("id, startup_id, program_id, kpi_id, program_kpis(title)")
      .eq("id", e.assignment_id)
      .eq("program_id", programId)
      .maybeSingle();
    if (!assignment) throw new Error("Not found");
    const a = assignment as unknown as {
      id: string;
      startup_id: string;
      program_kpis?: { title: string } | null;
    };

    // Resolve every pending submission for this challenge, not just the reviewed
    // one: older resubmissions are superseded and must not reappear in the queue.
    const { error: upErr } = await supabaseAdmin
      .from("program_kpi_entries")
      .update({
        review_status: data.decision,
        reviewed_at: new Date().toISOString(),
      })
      .eq("assignment_id", e.assignment_id)
      .eq("submitted_for_check", true)
      .eq("review_status", "pending");
    if (upErr) throw new Error(upErr.message);


    if (data.decision === "declined") {
      await supabaseAdmin
        .from("program_kpi_assignments")
        .update({ declined_at: new Date().toISOString() })
        .eq("id", a.id);
      return { ok: true, xpAwarded: 0, newBadges: [] as string[] };
    }

    if (data.decision === "postponed") {
      await supabaseAdmin
        .from("program_kpi_assignments")
        .update({
          due_date_override: data.newDueDate,
          postpone_reason: data.reason || null,
          postponed_at: new Date().toISOString(),
          completed_at: null,
        })
        .eq("id", a.id);
      return { ok: true, xpAwarded: 0, newBadges: [] as string[] };
    }

    await supabaseAdmin
      .from("program_kpi_assignments")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", a.id);

    const { awardChallengeApprovedRewards } = await import("@/design-system/ventura-6bef42/lib/xp-awarder.server");
    const reward = await awardChallengeApprovedRewards({
      startupId: a.startup_id,
      assignmentId: a.id,
      userId: e.recorded_by_user_id,
      challengeTitle: a.program_kpis?.title ?? null,
    });

    return { ok: true, ...reward };
  });


export const recordProgramKpiValue = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        assignmentId: z.string().uuid(),
        value: z.number().min(0).max(1_000_000_000),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);

    const { data: assignment } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("id, kpi_id, program_kpis(target_value)")
      .eq("program_id", programId)
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (!assignment) throw new Error("Not found");

    const target = Number(
      (assignment as unknown as { program_kpis?: { target_value: number } }).program_kpis
        ?.target_value ?? 0,
    );

    await supabaseAdmin.from("program_kpi_entries").insert({
      assignment_id: data.assignmentId,
      value: data.value,
      note: data.note || null,
      recorded_by_label: "Program lead",
    });
    const { error } = await supabaseAdmin
      .from("program_kpi_assignments")
      .update({
        current_value: data.value,
        completed_at: target > 0 && data.value >= target ? new Date().toISOString() : null,
      })
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pending founder requests to extend expired challenges. */
export const listPostponeRequests = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("id, startup_id, due_date_override, postpone_request_reason, postpone_requested_at, program_kpis(title, due_date)")
      .eq("program_id", programId)
      .eq("postpone_request_status" as never, "pending")
      .order("postpone_requested_at" as never, { ascending: false });
    const list = (rows ?? []) as unknown as Array<{
      id: string;
      startup_id: string;
      due_date_override: string | null;
      postpone_request_reason: string | null;
      postpone_requested_at: string | null;
      program_kpis: { title: string; due_date: string | null } | null;
    }>;
    if (!list.length) return { requests: [] };
    const { data: startups } = await supabaseAdmin
      .from("startups")
      .select("id, name")
      .in("id", [...new Set(list.map((r) => r.startup_id))]);
    const names = new Map(((startups ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
    return {
      requests: list.map((r) => ({
        id: r.id,
        startupName: names.get(r.startup_id) ?? "Startup",
        challengeTitle: r.program_kpis?.title ?? "Challenge",
        dueDate: r.due_date_override ?? r.program_kpis?.due_date ?? null,
        reason: r.postpone_request_reason,
        requestedAt: r.postpone_requested_at,
      })),
    };
  });

/** Lead approves (with a new deadline) or declines a founder's postpone request. */
export const reviewPostponeRequest = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        assignmentId: z.string().uuid(),
        decision: z.enum(["approved", "declined"]),
        newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      })
      .refine((v) => v.decision !== "approved" || !!v.newDueDate, {
        message: "Choose a new deadline to approve",
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { data: row } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("id, postpone_request_reason")
      .eq("id", data.assignmentId)
      .eq("program_id", programId)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const r = row as unknown as { postpone_request_reason: string | null };
    const patch: Record<string, unknown> = { postpone_request_status: data.decision };
    if (data.decision === "approved") {
      patch.due_date_override = data.newDueDate;
      patch.postponed_at = new Date().toISOString();
      patch.postpone_reason = r.postpone_request_reason;
    }
    const { error } = await supabaseAdmin
      .from("program_kpi_assignments")
      .update(patch as never)
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
