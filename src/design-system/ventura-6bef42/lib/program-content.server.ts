export const PROOF_BUCKET = "program-documents";
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;

type MinimalClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> };
    };
  };
};

/**
 * Resolves an assignment through an RLS-scoped client, so it only succeeds
 * for members of the startup the challenge belongs to.
 */
export async function resolveTeamAssignment(client: MinimalClient, assignmentId: string) {
  const { data } = await client
    .from("program_kpi_assignments")
    .select("id, startup_id, program_kpis(target_value, proof_required)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!data) throw new Error("Challenge not found");
  const row = data as {
    startup_id: string;
    program_kpis?: { target_value: number | null; proof_required: boolean | null } | null;
  };
  return {
    startupId: row.startup_id,
    target: Number(row.program_kpis?.target_value ?? 0),
    proofRequired: row.program_kpis?.proof_required ?? true,
  };
}

export function proofStoragePath(startupId: string, assignmentId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return { safeName, path: `challenge-proofs/${startupId}/${assignmentId}/${Date.now()}-${safeName}` };
}

/**
 * Proof paths/names are stored as a plain string (single file, legacy) or a
 * JSON string array (up to 3 files). Tolerates both formats.
 */
export function parseProofList(value: string | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      // fall through to plain-string handling
    }
  }
  return [trimmed];
}
