export type KpiStatus = "completed" | "overdue" | "behind" | "on_track";

export function kpiStatus(
  current: number,
  target: number,
  dueDate: string | null,
  completedAt?: string | null,
): KpiStatus {
  if (completedAt || (target > 0 && current >= target)) return "completed";
  if (dueDate) {
    const due = new Date(dueDate + "T23:59:59Z").getTime();
    if (Date.now() > due) return "overdue";
    // "behind" when less than half done with under a third of the window left
    const pct = target > 0 ? current / target : 0;
    const daysLeft = Math.ceil((due - Date.now()) / 86400000);
    if (daysLeft <= 7 && pct < 0.5) return "behind";
  }
  return "on_track";
}

export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  completed: "Completed",
  overdue: "Overdue",
  behind: "Behind",
  on_track: "On track",
};

export function kpiStatusClass(status: KpiStatus): string {
  switch (status) {
    case "completed":
      return "border-transparent bg-primary/10 text-primary";
    case "overdue":
      return "border-transparent bg-destructive/10 text-destructive";
    case "behind":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function kpiPercent(current: number, target: number): number {
  if (!target || target <= 0) return current > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export type ChallengeOutcome = KpiStatus | "declined" | "ignored";

/** Lead-facing status of an assigned challenge, including review outcomes. */
export function challengeOutcome(a: {
  current_value: number;
  completed_at: string | null;
  declined_at?: string | null;
  due_date_override?: string | null;
}, kpi: { target_value: number | null; due_date: string | null }): ChallengeOutcome {
  if (a.declined_at) return "declined";
  if (a.completed_at) return "completed";
  const due = a.due_date_override ?? kpi.due_date ?? null;
  if (due && new Date(due + "T23:59:59Z").getTime() < Date.now()) return "ignored";
  return kpiStatus(a.current_value, kpi.target_value ?? 0, due, a.completed_at);
}

export const CHALLENGE_OUTCOME_LABEL: Record<ChallengeOutcome, string> = {
  ...KPI_STATUS_LABEL,
  declined: "Declined",
  ignored: "Ignored",
};

export function challengeOutcomeClass(status: ChallengeOutcome): string {
  if (status === "declined") return "border-transparent bg-muted text-muted-foreground line-through";
  if (status === "ignored") return "border-transparent bg-muted text-muted-foreground";
  return kpiStatusClass(status);
}
