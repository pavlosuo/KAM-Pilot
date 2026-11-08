"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Loader2, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card } from "@/design-system/ventura-6bef42/components/ui/card";
import { Slider } from "@/design-system/ventura-6bef42/components/ui/slider";
import { ProofDialog } from "@/design-system/ventura-6bef42/components/program-content/ChallengesBlock";
import { useProgramWorkspace, type ProgramWorkspaceItem } from "@/design-system/ventura-6bef42/hooks/use-program-workspace";
import { KPI_STATUS_LABEL, kpiStatus, kpiStatusClass } from "@/design-system/ventura-6bef42/lib/program-kpi-status";
import { updateChallengeProgress } from "@/design-system/ventura-6bef42/lib/program-content.functions";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

type Challenge = ProgramWorkspaceItem["challenges"][number];

/**
 * Program challenges rendered inside the Weekly update "Goals" step — same
 * pull-bar behaviour as /program-content, styled for the weekly update flow.
 */
export function ChallengeGoalsCard({ startupId }: { startupId: string }) {
  const qc = useQueryClient();
  const { items } = useProgramWorkspace();
  const save = useServerFn(updateChallengeProgress);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [proofFor, setProofFor] = useState<Challenge | null>(null);

  const item = items.find((i) => i.startupId === startupId);
  const challenges = (item?.challenges ?? []).filter(
    (c) => !c.completedAt && !c.declinedAt && !c.expired,
  );
  if (!item || challenges.length === 0) return null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["program-workspace"] });

  const saveValue = async (challenge: Challenge, next: number) => {
    const value = Number(next);
    if (!Number.isFinite(value) || value < 0) return;
    setSavingId(challenge.id);
    try {
      await save({ data: { assignmentId: challenge.id, value } });
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Trophy className="h-4 w-4 text-primary" />
        Challenges from {item.programName}
      </div>
      {challenges.map((c) => {
        const status = kpiStatus(c.currentValue, c.targetValue, c.dueDate, c.completedAt);
        const pending = c.submissions.filter((s) => (s.reviewStatus ?? "pending") === "pending");
        const max = c.targetValue > 0 ? c.targetValue : 1;
        const step = max <= 1 ? 1 : Math.max(1, Math.round(max / 100));
        const value = Math.min(Number(drafts[c.id] ?? c.currentValue), max);
        return (
          <Card key={c.id} className="border-primary/30 bg-primary/5 p-4 animate-fade-in">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.title}</div>
                {c.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  kpiStatusClass(status),
                )}
              >
                {KPI_STATUS_LABEL[status]}
              </span>
            </div>

            <Slider
              value={[value]}
              min={0}
              max={max}
              step={step}
              disabled={savingId === c.id}
              onValueChange={(v) => setDrafts((d) => ({ ...d, [c.id]: String(v[0]) }))}
              onValueCommit={(v) => void saveValue(c, v[0])}
              className="mt-4 cursor-pointer"
            />

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {value} / {max}
                {c.unit ? ` ${c.unit}` : ""}
                {c.targetValue > 0 ? "" : " (done)"}
              </span>
              {savingId === c.id && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                </span>
              )}
              {c.dueDate && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Due {c.dueDate}
                </span>
              )}
              {pending.length > 0 && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" /> {pending.length} submitted for check
                </span>
              )}
            </div>

            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => setProofFor(c)}
                disabled={value < 1}
                data-particles="true"
                className="cursor-pointer"
              >
                Submit for check
              </Button>
            </div>
          </Card>
        );
      })}

      <ProofDialog
        challenge={proofFor}
        onClose={() => setProofFor(null)}
        onSubmitted={() => void invalidate()}
      />
    </div>
  );
}
