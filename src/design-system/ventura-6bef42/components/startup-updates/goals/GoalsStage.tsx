"use client";

import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWeeklyGoalsState } from "@/design-system/ventura-6bef42/lib/weekly-goals.functions";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { GoalsReviewStep } from "./GoalsReviewStep";
import { GoalsSetStep } from "./GoalsSetStep";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function GoalsStage({
  startupId,
  onComplete,
  onBack,
}: {
  startupId: string;
  onComplete: () => void;
  onBack?: () => void;
}) {
  const stateFn = useServerFn(getWeeklyGoalsState);
  const qc = useQueryClient();
  const [phase, setPhase] = useState<"review" | "set">("review");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["weekly-goals", startupId],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) throw new Error("Not signed in");
      return stateFn({ data: { startupId } });
    },
    staleTime: 0,
    retry: 1,
  });

  // Goals stay editable all week: even after the step was completed once, the
  // founder can reopen it, adjust the list and continue.
  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading goals…
      </div>
    );
  }


  if (phase === "review" && data.needsReview && data.lastWeekGoals.length > 0) {
    return (
      <GoalsReviewStep
        startupId={startupId}
        lastWeekGoals={data.lastWeekGoals}
        onBack={onBack}
        onDone={async () => {
          await refetch();
          qc.invalidateQueries({ queryKey: ["weekly-goals", startupId] });
          setPhase("set");
        }}
      />
    );
  }

  return (
    <GoalsSetStep
      startupId={startupId}
      existing={data.myThisWeekGoals}
      teammateGoals={data.teammateThisWeekGoals}
      challengeGoals={data.challengeThisWeekGoals}
      onBack={
        data.lastWeekGoals.length > 0
          ? () => setPhase("review")
          : onBack
      }
      onDone={() => {
        qc.invalidateQueries({ queryKey: ["weekly-goals", startupId] });
        onComplete();
      }}
    />
  );
}
