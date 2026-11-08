import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Loader2, ShieldCheck, Target, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import { InfoHint } from "@/design-system/ventura-6bef42/components/program-content/InfoHint";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Slider } from "@/design-system/ventura-6bef42/components/ui/slider";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { formatBytes } from "@/design-system/ventura-6bef42/components/ui/file-upload";
import { KPI_STATUS_LABEL, kpiStatus, kpiStatusClass } from "@/design-system/ventura-6bef42/lib/program-kpi-status";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import {
  requestChallengePostpone,
  submitChallengeProof,
  updateChallengeProgress,
} from "@/design-system/ventura-6bef42/lib/program-content.functions";
import type { ProgramWorkspaceItem } from "@/design-system/ventura-6bef42/hooks/use-program-workspace";

type Challenge = ProgramWorkspaceItem["challenges"][number];

/** Challenges shown at once before the arrows move to the next page. */
const CHALLENGES_PAGE_SIZE = 5;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function ChallengesBlock({ item }: { item: ProgramWorkspaceItem }) {
  const qc = useQueryClient();
  const save = useServerFn(updateChallengeProgress);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [proofFor, setProofFor] = useState<Challenge | null>(null);
  const [postponeFor, setPostponeFor] = useState<Challenge | null>(null);
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(item.challenges.length / CHALLENGES_PAGE_SIZE);
  const pageSafe = Math.min(page, Math.max(0, pageCount - 1));
  const visibleChallenges = item.challenges.slice(
    pageSafe * CHALLENGES_PAGE_SIZE,
    pageSafe * CHALLENGES_PAGE_SIZE + CHALLENGES_PAGE_SIZE,
  );

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
    <Card className="flex h-full min-h-0 flex-col lg:absolute lg:inset-0">
      <CardHeader className="min-h-[68px] justify-center pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-muted-foreground" />
          Challenges from {item.programName}
          <InfoHint text="Keep your numbers live at any time. When you are ready for the program lead to verify a milestone, submit it for check with a proof file." />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {item.challenges.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No challenges assigned yet. Your program lead will set them from their dashboard.
          </p>
        ) : (
          <>
          <div className="custom-scrollbar max-h-[30vh] space-y-4 overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
            {visibleChallenges.map((c) => {
            const base = kpiStatus(c.currentValue, c.targetValue, c.dueDate, c.completedAt);
            const closed = !!c.completedAt || !!c.declinedAt || c.expired;
            const pending = c.submissions.filter((s) => (s.reviewStatus ?? "pending") === "pending");
            const submitted = !c.declinedAt && pending.length > 0;
            const label = c.completedAt || submitted
              ? "Completed"
              : c.declinedAt
                ? "Canceled"
                : c.expired
                  ? c.postponeRequestStatus === "pending"
                    ? "Postpone requested"
                    : "Deadline passed"
                  : c.postponedAt
                    ? "Postponed"
                    : KPI_STATUS_LABEL[base];
            const labelClass = c.completedAt || submitted
              ? kpiStatusClass("completed")
              : c.declinedAt
                ? "border-transparent bg-muted text-muted-foreground line-through"
                : c.expired
                  ? kpiStatusClass("overdue")
                  : c.postponedAt
                    ? kpiStatusClass("behind")
                    : kpiStatusClass(base);
            const max = c.targetValue > 0 ? c.targetValue : 1;
            const step = max <= 1 ? 1 : Math.max(1, Math.round(max / 100));
            const value = Math.min(Number(drafts[c.id] ?? c.currentValue), max);
            return (
              <div key={c.id} className={cn("rounded-xl border p-4", closed && "opacity-80")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{c.title}</p>
                    {c.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    {(c.postponeReason || c.postponedAt) && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        {c.postponeReason
                          ? `Postponed by the program lead: ${c.postponeReason}`
                          : "Postponed by a lead"}
                      </p>
                    )}


                  </div>
                  <Badge variant="outline" className={cn("text-xs", labelClass)}>
                    {label}
                  </Badge>
                </div>

                <div className="mt-4">
                  <Slider
                    value={[value]}
                    min={0}
                    max={max}
                    step={step}
                    disabled={savingId === c.id || closed}
                    onValueChange={(v) => setDrafts((d) => ({ ...d, [c.id]: String(v[0]) }))}
                    onValueCommit={(v) => void saveValue(c, v[0])}
                    className="cursor-pointer"
                  />
                </div>

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
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {pending.length} submitted for check
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {!closed && (
                    <Button
                      onClick={() => setProofFor(c)}
                      disabled={value < 1}
                      data-particles="true"
                    >
                      Submit for check
                    </Button>
                  )}
                  {c.expired && !c.completedAt && !c.declinedAt && (
                    <Button
                      variant="outline"
                      disabled={c.postponeRequestStatus === "pending"}
                      onClick={() => setPostponeFor(c)}
                      className="cursor-pointer"
                    >
                      <CalendarClock className="mr-1.5 h-4 w-4" />
                      {c.postponeRequestStatus === "pending" ? "Postpone requested" : "Request a postpone"}
                    </Button>
                  )}
                  {c.expired && c.postponeRequestStatus === "declined" && (
                    <span className="text-xs text-muted-foreground">
                      The program lead declined your last postpone request.
                    </span>
                  )}
                </div>


                {c.submissions.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    {c.submissions.slice(0, 3).map((s) => (
                      <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 truncate">
                          {s.value}
                          {c.unit ? ` ${c.unit}` : ""} ·{" "}
                          {s.files?.length
                            ? s.files.map((f, fi) => (
                                <span key={fi}>
                                  {fi > 0 && ", "}
                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                                    {f.name}
                                  </a>
                                </span>
                              ))
                            : s.fileNames?.length ? s.fileNames.join(", ") : "proof"}{" "}
                          ·{" "}
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                        <span className="shrink-0 capitalize">{s.reviewStatus ?? "pending"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          </div>
          {pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                disabled={pageSafe === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous challenges"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {pageSafe + 1} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                disabled={pageSafe >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                aria-label="Next challenges"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          </>
        )}
      </CardContent>

      <ProofDialog
        challenge={proofFor}
        onClose={() => setProofFor(null)}
        onSubmitted={() => void invalidate()}
      />
      <PostponeRequestDialog
        challenge={postponeFor}
        onClose={() => setPostponeFor(null)}
        onSubmitted={() => void invalidate()}
      />
    </Card>
  );
}

const MAX_PROOF_FILES = 3;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const PROOF_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx";

export function ProofDialog({
  challenge,
  onClose,
  onSubmitted,
}: {
  challenge: Challenge | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const submit = useServerFn(submitChallengeProof);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const required = challenge?.proofRequired ?? true;

  const close = () => {
    setFiles([]);
    setNote("");
    onClose();
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    setFiles((prev) => {
      const next = [...prev];
      let total = prev.reduce((sum, f) => sum + f.size, 0);
      for (const f of Array.from(incoming)) {
        if (next.length >= MAX_PROOF_FILES) {
          toast.error(`Up to ${MAX_PROOF_FILES} files per submission`);
          break;
        }
        if (total + f.size > MAX_TOTAL_BYTES) {
          toast.error("Total proof size must stay under 10MB");
          break;
        }
        total += f.size;
        next.push(f);
      }
      return next;
    });
  };

  const run = async () => {
    if (!challenge) return;
    if (required && files.length === 0) {
      toast.error("Attach a proof photo or document");
      return;
    }
    const numeric = Number(challenge.currentValue);
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast.error("Enter a valid number");
      return;
    }
    setBusy(true);
    try {
      const payloadFiles = await Promise.all(
        files.map(async (f) => ({
          fileName: f.name,
          mimeType: f.type || "application/octet-stream",
          fileBase64: await readAsBase64(f),
        })),
      );
      await submit({
        data: {
          assignmentId: challenge.id,
          value: numeric,
          note: note.trim() || null,
          files: payloadFiles,
        },
      });
      toast.success("Submitted for check");
      onSubmitted();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!challenge} onOpenChange={(v) => (!v ? close() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit “{challenge?.title}” for check</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Proof file {required ? "(required)" : "(optional)"}</Label>
              {files.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {files.length} of {MAX_PROOF_FILES} attached
                </span>
              )}
            </div>
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" title={f.name}>{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">Attached · {formatBytes(f.size)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                      className="shrink-0 cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      aria-label="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {files.length < MAX_PROOF_FILES && (
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors hover:border-primary/60 hover:bg-muted/40",
                  files.length ? "px-3 py-2" : "flex-col gap-1.5 px-4 py-5",
                  busy && "pointer-events-none opacity-70",
                )}
              >
                <input
                  type="file"
                  accept={PROOF_ACCEPT}
                  multiple={files.length + 1 < MAX_PROOF_FILES}
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <UploadCloud className={cn("text-primary", files.length ? "h-4 w-4" : "h-5 w-5")} />
                <span className="text-xs font-medium">
                  {files.length ? "Add another file (optional)" : "Choose files"}
                </span>
                {!files.length && (
                  <span className="text-[11px] text-muted-foreground">
                    {required ? "" : "Optional · "}
                    {`Up to ${MAX_PROOF_FILES} files, ${formatBytes(MAX_TOTAL_BYTES)} total`}
                  </span>
                )}
              </label>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proof-note">Note (optional)</Label>
            <Textarea
              id="proof-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the program lead should know about this milestone"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy} data-particles="true">
            Cancel
          </Button>
          <Button
            onClick={() => void run()}
            disabled={busy || (required && files.length === 0)}
            data-particles="true"
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Submit for check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostponeRequestDialog({
  challenge,
  onClose,
  onSubmitted,
}: {
  challenge: Challenge | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const send = useServerFn(requestChallengePostpone);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    setReason("");
    onClose();
  };
  const run = async () => {
    if (!challenge || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await send({ data: { assignmentId: challenge.id, reason: reason.trim() } });
      toast.success("Postpone request sent to the program lead");
      onSubmitted();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!challenge} onOpenChange={(v) => (!v ? close() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a postpone for “{challenge?.title}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="postpone-request-reason">Why do you need more time?</Label>
          <Textarea
            id="postpone-request-reason"
            rows={4}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what happened and what you still need to finish"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void run()} disabled={busy || reason.trim().length < 3}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
