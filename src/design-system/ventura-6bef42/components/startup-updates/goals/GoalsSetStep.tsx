"use client";

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { LiquidMetalButton } from "@/design-system/ventura-6bef42/components/ui/liquid-metal-button";
import { Card } from "@/design-system/ventura-6bef42/components/ui/card";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setThisWeekGoals, type WeeklyGoal } from "@/design-system/ventura-6bef42/lib/weekly-goals.functions";

type Draft = { id?: string; title: string; carriedFromGoalId?: string | null };

export function GoalsSetStep({
  startupId,
  existing,
  teammateGoals = [],
  challengeGoals = [],
  onBack,
  onDone,
}: {
  startupId: string;
  existing: WeeklyGoal[];
  teammateGoals?: Array<WeeklyGoal & { author_name?: string }>;
  challengeGoals?: WeeklyGoal[];
  onBack?: () => void;
  onDone: () => void;
}) {
  const setFn = useServerFn(setThisWeekGoals);
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    if (existing.length > 0) {
      return existing.map((g) => ({
        id: g.id,
        title: g.title,
        carriedFromGoalId: g.carried_from_goal_id,
      }));
    }
    return [{ title: "" }];
  });

  const save = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          startupId,
          goals: drafts
            .map((d, i) => ({
              id: d.id ?? null,
              title: d.title.trim(),
              orderIndex: i,
              carriedFromGoalId: d.carriedFromGoalId ?? null,
            }))
            .filter((g) => g.title.length > 0),
        },
      }),
    onSuccess: onDone,
    onError: (e: Error) => toast.error(e.message),
  });

  

  return (
    <div className="w-full max-w-2xl space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Set goals for the next week</h2>
        {teammateGoals.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Your teammate already set these goals. Complete the list with yours!
          </p>
        )}
      </div>

      {teammateGoals.length > 0 && (
        <div className="space-y-2">
          {teammateGoals.map((g, i) => (
            <Card
              key={g.id}
              className="flex items-center gap-3 bg-muted/40 p-3"
              title={`Set by ${g.author_name ?? "teammate"}`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {i + 1}
              </div>
              <Input value={g.title} readOnly disabled className="flex-1 opacity-90" />
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                {g.author_name ?? "Teammate"}
              </span>
            </Card>
          ))}
        </div>
      )}




      <div className="space-y-2">
        {drafts.map((d, i) => (
          <Card
            key={i}
            className="flex items-center gap-3 p-3 animate-fade-in"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {teammateGoals.length + challengeGoals.length + i + 1}
            </div>
            <Input
              autoFocus={i === 0 && !d.title}
              placeholder="e.g. Ship v2 landing page"
              value={d.title}
              maxLength={120}
              onChange={(e) =>
                setDrafts((p) => p.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))
              }
              className="flex-1"
            />
            {d.carriedFromGoalId && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                ↪ carried
              </span>
            )}
            <button
              className="cursor-pointer text-muted-foreground hover:text-destructive"
              onClick={() => setDrafts((p) => p.filter((_, idx) => idx !== i))}
              aria-label="Remove goal"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
        {drafts.length < 5 && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer w-full"
            onClick={() => setDrafts((p) => [...p, { title: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add goal ({drafts.length}/5)
          </Button>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={save.isPending}
            className="cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        )}
        <LiquidMetalButton
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save & continue"}
        </LiquidMetalButton>
      </div>
    </div>
  );
}
