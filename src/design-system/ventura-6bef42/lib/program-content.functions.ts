import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

type StartupRow = { id: string; name: string; logo_url: string | null };

/** Every startup of the signed-in user that belongs to at least one approved program. */
export const getProgramWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: owned }, { data: memberOf }] = await Promise.all([
      supabase.from("startups").select("id, name, logo_url").eq("owner_id", userId),
      supabase.from("startup_members").select("startup_id").eq("user_id", userId),
    ]);

    const memberIds = ((memberOf ?? []) as Array<{ startup_id: string }>).map((m) => m.startup_id);
    let startups = (owned ?? []) as StartupRow[];
    const missing = memberIds.filter((id) => !startups.some((s) => s.id === id));
    if (missing.length) {
      const { data: extra } = await supabase
        .from("startups")
        .select("id, name, logo_url")
        .in("id", missing);
      startups = [...startups, ...((extra ?? []) as StartupRow[])];
    }
    if (!startups.length) return { items: [] };

    const startupIds = startups.map((s) => s.id);
    const { data: memberships } = await supabase
      .from("program_startups")
      .select("program_id, startup_id, programs(id, name, logo_url, theme_color, background_mode, description, cohort_start_date)")
      .in("startup_id", startupIds)
      .eq("status", "approved");

    const rows = (memberships ?? []) as Array<{
      program_id: string;
      startup_id: string;
      programs: {
        id: string;
        name: string;
        logo_url: string | null;
        theme_color: string | null;
        background_mode: string | null;
        description: string | null;
        cohort_start_date: string | null;
      } | null;
    }>;
    if (!rows.length) return { items: [] };

    const { data: assignments } = await supabase
      .from("program_kpi_assignments")
      .select(
        "id, program_id, startup_id, current_value, completed_at, created_at, updated_at, due_date_override, postpone_reason, postponed_at, declined_at, postpone_request_reason, postpone_request_status, postpone_requested_at, program_kpis(id, title, description, target_value, unit, due_date, proof_required)",
      )
      .in("startup_id", startupIds)
      .order("created_at", { ascending: false });

    const today = new Date().toISOString().slice(0, 10);
    const allAssignments = (assignments ?? []) as unknown as Array<{
      id: string;
      program_id: string;
      startup_id: string;
      current_value: number;
      completed_at: string | null;
      created_at: string;
      due_date_override: string | null;
      postpone_reason: string | null;
      postponed_at: string | null;
      declined_at: string | null;
      postpone_request_reason: string | null;
      postpone_request_status: string | null;
      postpone_requested_at: string | null;
      program_kpis: {
        id: string;
        title: string;
        description: string | null;
        target_value: number | null;
        unit: string | null;
        due_date: string | null;
        proof_required: boolean | null;
      } | null;
    }>;
    // Founders see the 10 most recent challenges per startup+program, whatever their state.
    const perKey = new Map<string, number>();
    const assignmentRows = allAssignments.filter((a) => {
      const k = `${a.startup_id}:${a.program_id}`;
      const n = perKey.get(k) ?? 0;
      if (n >= 10) return false;
      perKey.set(k, n + 1);
      return true;
    });



    const assignmentIds = assignmentRows.map((a) => a.id);
    const { data: entries } = await supabase
      .from("program_kpi_entries")
      .select("id, assignment_id, value, note, proof_path, proof_file_name, submitted_for_check, review_status, created_at")
      .in("assignment_id", assignmentIds.length ? assignmentIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("submitted_for_check", true)
      .order("created_at", { ascending: false });

    const { parseProofList, PROOF_BUCKET } = await import("@/design-system/ventura-6bef42/lib/program-content.server");
    const proofRows = (entries ?? []) as Array<{
      id: string;
      assignment_id: string;
      value: number;
      note: string | null;
      proof_path: string | null;
      proof_file_name: string | null;
      review_status: string | null;
      created_at: string;
    }>;
    // Entries were read with the founder's own access, so only their team's proofs are signed.
    const proofFiles = new Map<string, Array<{ name: string; url: string }>>();
    const allPaths = proofRows.flatMap((p) => parseProofList(p.proof_path));
    if (allPaths.length) {
      const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage.from(PROOF_BUCKET).createSignedUrls(allPaths, 60 * 60);
      const urlByPath = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
      for (const p of proofRows) {
        const paths = parseProofList(p.proof_path);
        const names = parseProofList(p.proof_file_name);
        const files = paths
          .map((path, i) => ({ name: names[i] ?? names[0] ?? "proof", url: urlByPath.get(path) ?? "" }))
          .filter((f) => f.url);
        if (files.length) proofFiles.set(p.id, files);
      }
    }

    return {
      items: rows.map((r) => {
        const startup = startups.find((s) => s.id === r.startup_id)!;
        return {
          key: `${r.startup_id}:${r.program_id}`,
          startupId: r.startup_id,
          startupName: startup?.name ?? "Startup",
          startupLogoUrl: startup?.logo_url ?? null,
          programId: r.program_id,
          programName: r.programs?.name ?? "Program",
          programLogoUrl: r.programs?.logo_url ?? null,
          programThemeColor: r.programs?.theme_color ?? null,
          programStartDate: r.programs?.cohort_start_date ?? null,
          programBackgroundMode: (r.programs?.background_mode === "dark" ? "dark" : "light") as "dark" | "light",
          programDescription: r.programs?.description ?? null,
          challenges: assignmentRows
            .filter((a) => a.startup_id === r.startup_id && a.program_id === r.program_id)
            .map((a) => ({
              id: a.id,
              currentValue: Number(a.current_value ?? 0),
              completedAt: a.completed_at,
              title: a.program_kpis?.title ?? "Challenge",
              description: a.program_kpis?.description ?? null,
              targetValue: Number(a.program_kpis?.target_value ?? 0),
              unit: a.program_kpis?.unit ?? null,
              dueDate: a.due_date_override ?? a.program_kpis?.due_date ?? null,
              proofRequired: a.program_kpis?.proof_required ?? true,
              postponeReason: a.postpone_reason,
              postponedAt: a.postponed_at,
              declinedAt: a.declined_at,
              expired: (() => {
                const due = a.due_date_override ?? a.program_kpis?.due_date ?? null;
                return !!due && due < today;
              })(),
              postponeRequestStatus: a.postpone_request_status as
                | "pending"
                | "approved"
                | "declined"
                | null,
              postponeRequestReason: a.postpone_request_reason,


              submissions: proofRows
                .filter((p) => p.assignment_id === a.id)
                .map((p) => ({
                  id: p.id,
                  value: Number(p.value),
                  note: p.note,
                  fileNames: parseProofList(p.proof_file_name),
                  files: proofFiles.get(p.id) ?? [],
                  reviewStatus: p.review_status,
                  createdAt: p.created_at,
                })),
            })),
        };
      }),
    };
  });

/** Live progress update by a founder; no proof required. */
export const updateChallengeProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        value: z.number().min(0).max(1_000_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { resolveTeamAssignment } = await import("@/design-system/ventura-6bef42/lib/program-content.server");
    // RLS on program_kpi_assignments limits SELECT to the startup team.
    const { target } = await resolveTeamAssignment(supabase as never, data.assignmentId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    // Completion is decided only by the program lead's approval — reaching the
    // target value never auto-completes the challenge.
    const { error } = await supabaseAdmin
      .from("program_kpi_assignments")
      .update({ current_value: data.value })
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Founder submits current progress for the program lead to check, with proof files when required. */
export const submitChallengeProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        value: z.number().min(0).max(1_000_000_000),
        note: z.string().trim().max(1000).optional().nullable(),
        files: z
          .array(
            z.object({
              fileName: z.string().trim().min(1).max(200),
              mimeType: z.string().trim().min(1).max(120),
              fileBase64: z.string().min(1),
            }),
          )
          .max(3),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveTeamAssignment, proofStoragePath, PROOF_BUCKET, MAX_PROOF_BYTES } = await import(
      "@/design-system/ventura-6bef42/lib/program-content.server"
    );
    const { startupId, proofRequired } = await resolveTeamAssignment(supabase as never, data.assignmentId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");

    if (proofRequired && data.files.length === 0) throw new Error("Attach a proof file");

    const binaries = data.files.map((f) => Buffer.from(f.fileBase64, "base64"));
    let total = 0;
    for (const b of binaries) {
      if (b.byteLength === 0) throw new Error("Proof file is empty");
      total += b.byteLength;
    }
    if (total > MAX_PROOF_BYTES) throw new Error("Proof files must total under 10MB");

    const paths: string[] = [];
    const names: string[] = [];
    for (let i = 0; i < data.files.length; i++) {
      const { safeName, path } = proofStoragePath(startupId, data.assignmentId, data.files[i].fileName);
      const { error: upErr } = await supabaseAdmin.storage
        .from(PROOF_BUCKET)
        .upload(path, binaries[i], { contentType: data.files[i].mimeType, upsert: false });
      if (upErr) throw new Error(upErr.message);
      paths.push(path);
      names.push(safeName);
    }

    const { error } = await supabaseAdmin.from("program_kpi_entries").insert({
      assignment_id: data.assignmentId,
      value: data.value,
      note: data.note || null,
      recorded_by_user_id: userId,
      recorded_by_label: "Founder",
      proof_path: paths.length === 1 ? paths[0] : JSON.stringify(paths),
      proof_file_name: names.length === 1 ? names[0] : JSON.stringify(names),
      submitted_for_check: true,
      review_status: "pending",
    });
    if (error) throw new Error(error.message);

    // Only the lead's approval completes the challenge, not hitting the target.
    await supabaseAdmin
      .from("program_kpi_assignments")
      .update({ current_value: data.value })
      .eq("id", data.assignmentId);

    return { ok: true };
  });

/** Founder asks the program lead to extend a challenge whose deadline has passed. */
export const requestChallengePostpone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ assignmentId: z.string().uuid(), reason: z.string().trim().min(3).max(1000) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveTeamAssignment } = await import("@/design-system/ventura-6bef42/lib/program-content.server");
    await resolveTeamAssignment(supabase as never, data.assignmentId);
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("program_kpi_assignments")
      .select("completed_at, declined_at, postpone_request_status")
      .eq("id", data.assignmentId)
      .maybeSingle();
    const r = row as unknown as { completed_at: string | null; declined_at: string | null; postpone_request_status: string | null } | null;
    if (!r) throw new Error("Challenge not found");
    if (r.completed_at || r.declined_at) throw new Error("This challenge is already closed");
    if (r.postpone_request_status === "pending") throw new Error("A postpone request is already pending");
    const { error } = await supabaseAdmin
      .from("program_kpi_assignments")
      .update({
        postpone_request_reason: data.reason,
        postpone_request_status: "pending",
        postpone_requested_at: new Date().toISOString(),
        postpone_requested_by: userId,
      } as never)
      .eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
