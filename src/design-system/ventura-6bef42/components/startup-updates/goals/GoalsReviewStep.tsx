"use client";

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { LiquidMetalButton } from "@/design-system/ventura-6bef42/components/ui/liquid-metal-button";
import { Card } from "@/design-system/ventura-6bef42/components/ui/card";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { toast } from "sonner";
import { reviewLastWeekGoals, type WeeklyGoal } from "@/design-system/ventura-6bef42/lib/weekly-goals.functions";

type Decision = { status: "done" | "carried_over" | "dropped"; dropReason?: string };

export function GoalsReviewStep({
  startupId,
  lastWeekGoals,
  onBack,
  onDone,
}: {
  startupId: string;
  lastWeekGoals: WeeklyGoal[];
  onBack?: () => void;
  onDone: () => void;
}) {
  const reviewFn = useServerFn(reviewLastWeekGoals);
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() => {
    const initial: Record<string, Decision> = {};
    for (const g of lastWeekGoals) {
      if (g.status !== "pending") {
        initial[g.id] = { status: g.status as Decision["status"], dropReason: g.drop_reason ?? undefined };
      }
    }
    return initial;
  });

  const doneCount = useMemo(
    () => Object.values(decisions).filter((d) => d.status === "done").length,
    [decisions],
  );
  const total = lastWeekGoals.length;
  const allReviewed = Object.keys(decisions).length === total;

  const submit = useMutation({
    mutationFn: () =>
      reviewFn({
        data: {
          startupId,
          decisions: Object.entries(decisions).map(([goalId, d]) => ({
            goalId,
            status: d.status,
            dropReason: d.status === "dropped" ? (d.dropReason ?? null) : null,
          })),
        },
      }),
    onSuccess: onDone,
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="w-full max-w-2xl space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">How did last week's goals go?</h2>
        <p className="text-sm text-muted-foreground">
          Mark each goal. Honesty pays — you earn XP for completions and comebacks.
        </p>
      </div>

      {/* Progress ring */}
      <div className="mx-auto flex h-24 w-24 items-center justify-center">
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${pct * 3.6}deg, hsl(var(--muted)) 0deg)`,
          }}
        >
          <div className="flex h-[80%] w-[80%] flex-col items-center justify-center rounded-full bg-background">
            <div className="text-lg font-bold">
              {doneCount}/{total}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">done</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {lastWeekGoals.map((goal) => {
          const d = decisions[goal.id];
          return (
            <Card key={goal.id} className={cn("p-4 transition-all", d && "border-primary/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{goal.title}</div>
                  {goal.source_label && (
                    <div className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      {goal.source_label}
                    </div>
                  )}
                  {goal.carried_from_goal_id && (
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      ↪ carried over
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setDecisions((p) => ({ ...p, [goal.id]: { status: "done" } }))}
                    className={cn(
                      "cursor-pointer inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all",
                      d?.status === "done"
                        ? "border-green-500 bg-green-500 text-white scale-105"
                        : "hover:bg-green-500/10 hover:border-green-500/50",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" /> Done
                  </button>
                  <button
                    onClick={() =>
                      setDecisions((p) => ({ ...p, [goal.id]: { status: "carried_over" } }))
                    }
                    className={cn(
                      "cursor-pointer inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all",
                      d?.status === "carried_over"
                        ? "border-amber-500 bg-amber-500 text-white scale-105"
                        : "hover:bg-amber-500/10 hover:border-amber-500/50",
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Carry
                  </button>
                  <button
                    onClick={() =>
                      setDecisions((p) => ({
                        ...p,
                        [goal.id]: { status: "dropped", dropReason: p[goal.id]?.dropReason },
                      }))
                    }
                    className={cn(
                      "cursor-pointer inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all",
                      d?.status === "dropped"
                        ? "border-destructive bg-destructive text-white scale-105"
                        : "hover:bg-destructive/10 hover:border-destructive/50",
                    )}
                  >
                    <X className="h-3.5 w-3.5" /> Drop
                  </button>
                </div>
              </div>
              {d?.status === "dropped" && (
                <Input
                  className="mt-3 text-xs"
                  placeholder="Optional: why did you drop it?"
                  value={d.dropReason ?? ""}
                  onChange={(e) =>
                    setDecisions((p) => ({
                      ...p,
                      [goal.id]: { status: "dropped", dropReason: e.target.value },
                    }))
                  }
                />
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={submit.isPending}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        )}
        <LiquidMetalButton
          disabled={!allReviewed || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "Saving…" : "Save & Continue"}
        </LiquidMetalButton>
      </div>
    </div>
  );
}
