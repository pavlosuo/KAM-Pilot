// Monthly Ventura AI credit pools per program.
// Founder pool: 150 credits x founders in approved cohort startups (shared).
// Lead pool: 800 credits flat for program leads / admins.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiPool = "founder" | "lead";

export const AI_CREDIT_COSTS = {
  founder_short: 1,
  founder_long: 3,
  founder_gap_analysis: 3,
  founder_mentor_match: 15,
  founder_investor_match: 20,
  lead_short: 1,
  lead_tools: 3,
  lead_deep_dive: 4,
  lead_report: 6,
  lead_cohort_match: 25,
} as const;
export type AiAction = keyof typeof AI_CREDIT_COSTS;

export const FOUNDER_CREDITS_PER_SEAT = 150;
export const LEAD_POOL_CREDITS = 800;

export class AiCreditsExhaustedError extends Error {
  constructor() {
    super("AI_CREDITS_LIMIT_REACHED: This month's Ventura AI credits for your program are used up.");
  }
}

function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function nextMonthStart(): Date {
  const d = monthStart();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>;

async function countFounders(admin: Admin, programId: string): Promise<number> {
  const { data: ps } = await admin
    .from("program_startups")
    .select("startup_id")
    .eq("program_id", programId)
    .eq("status", "approved");
  const ids = ((ps ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id);
  if (!ids.length) return 0;
  const [{ data: owners }, { data: members }] = await Promise.all([
    admin.from("startups").select("owner_id").in("id", ids),
    admin.from("startup_members").select("user_id").in("startup_id", ids),
  ]);
  const set = new Set<string>();
  for (const o of (owners ?? []) as Array<{ owner_id: string | null }>) if (o.owner_id) set.add(o.owner_id);
  for (const m of (members ?? []) as Array<{ user_id: string }>) set.add(m.user_id);
  return set.size;
}

export type AiPoolStatus = { pool: AiPool; limit: number; used: number; remaining: number; resetsAt: string };

/** Lead pool is shared; founder credits are personal when userId is given (150 each),
 *  or the cohort total (150 x founders) when omitted (dashboard overview). */
export async function getAiPoolStatus(
  admin: Admin,
  programId: string,
  pool: AiPool,
  userId?: string | null,
): Promise<AiPoolStatus> {
  const limit =
    pool === "lead"
      ? LEAD_POOL_CREDITS
      : userId
        ? FOUNDER_CREDITS_PER_SEAT
        : FOUNDER_CREDITS_PER_SEAT * (await countFounders(admin, programId));
  let q = admin
    .from("ai_credit_usage")
    .select("credits")
    .eq("program_id", programId)
    .eq("pool", pool)
    .gte("created_at", monthStart().toISOString());
  if (pool === "founder" && userId) q = q.eq("user_id", userId);
  const { data } = await q;
  const used = ((data ?? []) as Array<{ credits: number }>).reduce((s, r) => s + (r.credits ?? 0), 0);
  return { pool, limit, used, remaining: Math.max(0, limit - used), resetsAt: nextMonthStart().toISOString() };
}

/** Throws AiCreditsExhaustedError if the pool can't cover the action; otherwise records the spend. */
export async function chargeAiCredits(
  admin: Admin,
  opts: { programId: string; action: AiAction; userId?: string | null; startupId?: string | null; credits?: number },
): Promise<void> {
  const pool: AiPool = opts.action.startsWith("lead_") ? "lead" : "founder";
  const credits = opts.credits ?? AI_CREDIT_COSTS[opts.action];
  const status = await getAiPoolStatus(
    admin,
    opts.programId,
    pool,
    pool === "founder" ? (opts.userId ?? null) : null,
  );
  if (status.remaining < credits) throw new AiCreditsExhaustedError();
  await admin.from("ai_credit_usage").insert({
    program_id: opts.programId,
    pool,
    user_id: opts.userId ?? null,
    startup_id: opts.startupId ?? null,
    action: opts.action,
    credits,
  });
}

/** Records extra spend without a limit check (for top-ups decided after a run, e.g. tool calls). */
export async function recordAiCredits(
  admin: Admin,
  opts: { programId: string; action: AiAction; credits: number; userId?: string | null; startupId?: string | null },
) {
  const pool: AiPool = opts.action.startsWith("lead_") ? "lead" : "founder";
  await admin.from("ai_credit_usage").insert({
    program_id: opts.programId,
    pool,
    user_id: opts.userId ?? null,
    startup_id: opts.startupId ?? null,
    action: opts.action,
    credits: opts.credits,
  });
}
