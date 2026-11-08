import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { checkStartupExists, createGoalAlert } from "@/design-system/ventura-6bef42/lib/goal-alerts.functions";

/**
 * Collects a startup name and a goal, builds the full sentence
 * ("Send me an email when Acme reaches 100 customer calls.") and hands it to
 * the assistant once the weekly watch has been registered.
 */
export function GoalAlertDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sentence: string) => void;
}) {
  const create = useServerFn(createGoalAlert);
  const checkExists = useServerFn(checkStartupExists);
  const [startupName, setStartupName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStartupName("");
      setGoal("");
      setSaving(false);
      setChecking(false);
      setExists(null);
      setMatchedName(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = startupName.trim();
    if (!trimmed) {
      setExists(null);
      setMatchedName(null);
      return;
    }
    setChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkExists({ data: { startupName: trimmed } });
        setExists(result.exists);
        setMatchedName(result.name);
      } catch {
        setExists(false);
        setMatchedName(null);
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [startupName, checkExists]);

  const submit = async () => {
    if (!startupName.trim() || !goal.trim() || saving || exists === false) return;
    setSaving(true);
    try {
      const result = await create({ data: { startupName: startupName.trim(), goal: goal.trim() } });
      toast.success(`You'll be notified when ${result.startupName} reaches this goal.`);
      onOpenChange(false);
      onCreated(result.sentence);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set up this alert");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = startupName.trim() && goal.trim() && !saving && exists !== false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Email me when a goal is reached</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-alert-startup">Startup</Label>
            <Input
              id="goal-alert-startup"
              value={startupName}
              placeholder="Acme"
              onChange={(event) => setStartupName(event.target.value)}
              aria-invalid={exists === false ? "true" : undefined}
            />
            {checking ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />Checking startups…
              </p>
            ) : exists === true ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Found {matchedName ? `"${matchedName}"` : "a matching startup"} on Ventura
              </p>
            ) : exists === false ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                No active startup called "{startupName.trim()}" was found on Ventura
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-alert-goal">Goal</Label>
            <Input id="goal-alert-goal" value={goal} placeholder="100 customer calls" onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-full" disabled={!canSubmit} onClick={() => void submit()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Set up alert
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
