"use client";

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/design-system/ventura-6bef42/components/ui/card";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { LiquidMetalButton } from "@/design-system/ventura-6bef42/components/ui/liquid-metal-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ventura-6bef42/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getThisWeekCustomerConversations,
  saveThisWeekCustomerConversations,
} from "@/design-system/ventura-6bef42/lib/customer-conversations.functions";
import {
  TRACKED_QUESTION_OPTIONS,
  DEFAULT_TRACKED_QUESTION,
} from "@/design-system/ventura-6bef42/lib/tracked-questions";

export function MetricsStage({
  startupId,
  onComplete,
}: {
  startupId: string;
  onComplete: () => void;
}) {
  const getFn = useServerFn(getThisWeekCustomerConversations);
  const saveFn = useServerFn(saveThisWeekCustomerConversations);
  const queryClient = useQueryClient();
  const [bootstrapQuestion, setBootstrapQuestion] = useState<string>("");
  const [values, setValues] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-customer-conversations", startupId],
    queryFn: () => getFn({ data: { startupId } }),
  });

  const options = useMemo(() => {
    const base =
      (data?.options as readonly string[] | undefined) ?? TRACKED_QUESTION_OPTIONS;
    return Array.from(new Set(base));
  }, [data]);

  const slots = data?.slots ?? [];
  const needsBootstrap = data?.needsBootstrap ?? false;

  useEffect(() => {
    if (needsBootstrap && !bootstrapQuestion) {
      setBootstrapQuestion(DEFAULT_TRACKED_QUESTION);
    }
  }, [needsBootstrap, bootstrapQuestion]);

  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };
      for (const s of slots) {
        if (next[s.slot] == null || next[s.slot] === "") {
          const teammate = (s as { teammateCount?: number | null }).teammateCount;
          next[s.slot] =
            s.count != null ? String(s.count) : teammate != null ? String(teammate) : "";
        }
      }
      return next;
    });
  }, [slots]);


  const save = useMutation({
    mutationFn: (payload: {
      entries: Array<{ slot: number; count: number }>;
      bootstrapQuestion?: string;
    }) => saveFn({ data: { startupId, ...payload } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-conv-series", startupId] });
      queryClient.invalidateQueries({
        queryKey: ["weekly-customer-conversations", startupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["startup-tracked-questions", startupId],
      });
      onComplete();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (needsBootstrap) {
      if (!bootstrapQuestion) {
        toast.error("Please choose a question to track");
        return;
      }
      const n = Number(values[1] ?? "");
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Please enter a positive whole number");
        return;
      }
      save.mutate({ entries: [{ slot: 1, count: n }], bootstrapQuestion });
      return;
    }

    const entries: Array<{ slot: number; count: number }> = [];
    for (const s of slots) {
      const raw = values[s.slot] ?? "";
      const n = Number(raw);
      if (raw === "" || !Number.isInteger(n) || n < 0) {
        toast.error("Please enter a positive whole number for every question");
        return;
      }
      entries.push({ slot: s.slot, count: n });
    }
    save.mutate({ entries });
  };

  const canSubmit = needsBootstrap
    ? !!bootstrapQuestion && (values[1] ?? "") !== ""
    : slots.length > 0 && slots.every((s) => (values[s.slot] ?? "") !== "");

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your metrics…
      </div>
    );
  }

  const numberProps = (slot: number) => ({
    type: "number" as const,
    inputMode: "numeric" as const,
    min: 0,
    step: 1,
    placeholder: "e.g. 5",
    value: values[slot] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === "" || /^\d+$/.test(v)) setValues((prev) => ({ ...prev, [slot]: v }));
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
      if (e.key === "Enter") handleSubmit();
    },
  });

  return (
    <div className="w-full max-w-2xl space-y-6 animate-fade-in">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold">
          {needsBootstrap ? "Pick the metric you'll track" : "Quick weekly numbers"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {needsBootstrap
            ? "Choose the metric you want to track from now on, then enter this week's number. You can add more (up to 3) or reset it from Edit startup profile."
            : data.hasTeammateNumbers
              ? `${data.teammateName ?? "Your teammate"} already reported these numbers this week. Confirm or update them with yours!`
              : "Enter this week's number for each tracked metric."}
        </p>
      </div>

      <div className="space-y-3">
        {needsBootstrap ? (
          <Card className="space-y-3 p-4">
            <Select value={bootstrapQuestion} onValueChange={setBootstrapQuestion}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a question…" />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh]">
                {options.map((q) => (
                  <SelectItem key={q} value={q} className="whitespace-normal">
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input autoFocus {...numberProps(1)} />
          </Card>
        ) : (
          slots.map((s, i) => (
            <Card
              key={s.slot}
              className="space-y-2 p-4 animate-fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <Label className="text-sm font-medium leading-snug">{s.question}</Label>
              <Input autoFocus={i === 0} {...numberProps(s.slot)} />
            </Card>
          ))
        )}
      </div>

      <div className="flex justify-center">
        <LiquidMetalButton disabled={save.isPending || !canSubmit} onClick={handleSubmit}>
          {save.isPending ? "Saving…" : "Save & continue"}
        </LiquidMetalButton>
      </div>
    </div>
  );
}
