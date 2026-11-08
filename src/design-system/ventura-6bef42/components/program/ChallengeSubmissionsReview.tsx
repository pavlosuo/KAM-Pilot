import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Download, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import { DatePicker } from "@/design-system/ventura-6bef42/components/ui/date-picker";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import {
  listChallengeSubmissions,
  reviewChallengeSubmission,
} from "@/design-system/ventura-6bef42/lib/program-kpis.functions";

type Submission = {
  id: string;
  startupName: string;
  challengeTitle: string;
  unit: string | null;
  targetValue: number | null;
  dueDate: string | null;
  value: number;
  note: string | null;
  proofFiles: Array<{ name: string; url: string }>;
  createdAt: string;
};

/** Program-lead review queue: approve, postpone or decline founder submissions. */
export function ChallengeSubmissionsReview({
  slug,
  onChanged,
}: {
  slug: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(listChallengeSubmissions);
  const review = useServerFn(reviewChallengeSubmission);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [postponing, setPostponing] = useState<Submission | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [reason, setReason] = useState("");

  const { data } = useQuery({
    queryKey: ["program-challenge-submissions", slug],
    queryFn: () => load({ data: { slug } }),
  });

  const submissions = (data?.submissions ?? []) as Submission[];

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["program-challenge-submissions", slug] });
    onChanged();
  };

  const decide = async (
    s: Submission,
    decision: "approved" | "declined" | "postponed",
    extra?: { newDueDate?: string; reason?: string },
  ) => {
    setBusyId(s.id);
    try {
      const res = await review({
        data: {
          slug,
          entryId: s.id,
          decision,
          newDueDate: extra?.newDueDate ?? null,
          reason: extra?.reason ?? null,
        },
      });
      toast.success(
        decision === "approved"
          ? `Approved${res.xpAwarded ? ` · +${res.xpAwarded} XP` : ""}`
          : decision === "postponed"
            ? "Postponed with a new deadline"
            : "Declined",
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the decision");
    } finally {
      setBusyId(null);
    }
  };

  if (submissions.length === 0) return null;

  return (
    <Card className="rounded-2xl border-amber-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Submissions awaiting review
          <Badge variant="outline" className="ml-1 rounded-full text-xs">
            {submissions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {submissions.map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-3 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {s.startupName} · {s.challengeTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.value}
                {s.targetValue != null ? ` / ${s.targetValue}` : ""}
                {s.unit ? ` ${s.unit}` : ""} · submitted{" "}
                {new Date(s.createdAt).toLocaleDateString()}
                {s.dueDate ? ` · due ${s.dueDate}` : ""}
              </p>
              {s.note ? <p className="mt-1 text-xs text-muted-foreground">“{s.note}”</p> : null}
              {s.proofFiles.length > 0 ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  {s.proofFiles.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" /> {f.name}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer rounded-full"
                disabled={busyId === s.id}
                onClick={() => void decide(s, "declined")}
              >
                Decline
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer rounded-full"
                disabled={busyId === s.id}
                onClick={() => {
                  setNewDueDate("");
                  setReason("");
                  setPostponing(s);
                }}
              >
                <CalendarClock className="mr-1.5 h-4 w-4" /> Postpone
              </Button>
              <Button
                size="sm"
                className="cursor-pointer rounded-full"
                disabled={busyId === s.id}
                onClick={() => void decide(s, "approved")}
              >
                {busyId === s.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Approve (+200 XP)"
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!postponing} onOpenChange={(v) => (!v ? setPostponing(null) : undefined)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Postpone “{postponing?.challengeTitle}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New deadline</Label>
              <DatePicker value={newDueDate} onChange={setNewDueDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postpone-reason">Why is it being postponed?</Label>
              <Textarea
                id="postpone-reason"
                rows={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what is still missing for this milestone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-full"
              onClick={() => setPostponing(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer rounded-full"
              disabled={!newDueDate || !postponing || busyId === postponing?.id}
              onClick={async () => {
                if (!postponing || !newDueDate) return;
                await decide(postponing, "postponed", { newDueDate, reason: reason.trim() });
                setPostponing(null);
              }}
            >
              Postpone challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
