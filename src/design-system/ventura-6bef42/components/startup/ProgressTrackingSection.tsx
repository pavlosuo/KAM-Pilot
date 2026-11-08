"use client";

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ventura-6bef42/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/alert-dialog";
import { Trash2, Plus, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  listStartupTrackedQuestions,
  resetStartupTracking,
  addTrackedQuestion,
  setTrackedQuestionHidden,
} from "@/design-system/ventura-6bef42/lib/customer-conversations.functions";
import { TRACKED_QUESTION_OPTIONS } from "@/design-system/ventura-6bef42/lib/tracked-questions";

export function ProgressTrackingSection({ startupId }: { startupId: string }) {
  const listFn = useServerFn(listStartupTrackedQuestions);
  const resetFn = useServerFn(resetStartupTracking);
  const addFn = useServerFn(addTrackedQuestion);
  const hideFn = useServerFn(setTrackedQuestionHidden);
  const queryClient = useQueryClient();

  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState<string>("");

  const { data } = useQuery({
    queryKey: ["startup-tracked-questions", startupId],
    queryFn: () => listFn({ data: { startupId } }),
  });

  const slots = data?.slots ?? [];
  const maxSlots = data?.maxSlots ?? 3;
  const canAdd = slots.length < maxSlots;

  const usedQuestions = useMemo(
    () => new Set(slots.map((s) => s.question)),
    [slots],
  );
  const availableOptions = useMemo(() => {
    const base = (data?.options as readonly string[] | undefined) ?? TRACKED_QUESTION_OPTIONS;
    return Array.from(new Set(base)).filter((q) => !usedQuestions.has(q));
  }, [data, usedQuestions]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["startup-tracked-questions", startupId] });
    queryClient.invalidateQueries({ queryKey: ["weekly-customer-conversations", startupId] });
    queryClient.invalidateQueries({ queryKey: ["customer-conv-series", startupId] });
  };

  const reset = useMutation({
    mutationFn: (slot: number) => resetFn({ data: { startupId, slot } }),
    onSuccess: () => {
      toast.success("Tracking removed. You can add a new question anytime.");
      invalidateAll();
      setConfirmSlot(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: (question: string) => addFn({ data: { startupId, question } }),
    onSuccess: () => {
      toast.success("Question added — you'll be asked for it each week.");
      invalidateAll();
      setAdding(false);
      setNewQuestion("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleHidden = useMutation({
    mutationFn: (v: { slot: number; hidden: boolean }) =>
      hideFn({ data: { startupId, slot: v.slot, hidden: v.hidden } }),
    onSuccess: (r) => {
      toast.success(
        r.hidden
          ? "Graph hidden. Your data is kept — you can resume it anytime."
          : "Graph is visible again on your full weekly update.",
      );
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentConfirm = slots.find((s) => s.slot === confirmSlot);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Progress tracking
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Track up to {maxSlots} metrics each week. Each one gets its own
              graph on your full weekly update.
            </p>
          </div>
        </div>

        {slots.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tracked metric yet. On your next weekly update you'll be asked to
            pick the metric you want to track. You can also add up to {maxSlots}
            {" "}questions here.
          </p>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => (
              <div
                key={s.slot}
                className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{s.question}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.entriesCount} weekly{" "}
                    {s.entriesCount === 1 ? "entry" : "entries"} recorded
                    {s.isHidden ? " · graph hidden" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">

                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    disabled={toggleHidden.isPending}
                    onClick={() =>
                      toggleHidden.mutate({ slot: s.slot, hidden: !s.isHidden })
                    }
                  >
                    {s.isHidden ? (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Resume the graph
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Hide the graph
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setConfirmSlot(s.slot)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Select value={newQuestion} onValueChange={setNewQuestion}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a question to track…" />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh]">
                {availableOptions.map((q) => (
                  <SelectItem key={q} value={q} className="whitespace-normal">
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setNewQuestion("");
                }}
                disabled={add.isPending}
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => newQuestion && add.mutate(newQuestion)}
                disabled={add.isPending || !newQuestion}
              >
                {add.isPending ? "Adding…" : "Add question"}
              </Button>
            </div>
          </div>
        ) : (
          canAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              disabled={availableOptions.length === 0}
            >
              <Plus className="h-3.5 w-3.5" /> Add question ({slots.length}/{maxSlots})
            </Button>
          )
        )}
      </CardContent>

      <AlertDialog
        open={confirmSlot !== null}
        onOpenChange={(o) => !o && setConfirmSlot(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this tracked question?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the graph and every weekly number recorded for
              "{currentConfirm?.question}". This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reset.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmSlot != null) reset.mutate(confirmSlot);
              }}
              disabled={reset.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reset.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
