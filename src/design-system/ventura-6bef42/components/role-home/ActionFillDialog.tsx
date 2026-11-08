import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";

/** Returns the placeholder names inside a quick action label, e.g. ["startup", "goal"]. */
export function actionPlaceholders(label: string): string[] {
  return Array.from(label.matchAll(/\[([^\]]+)\]/g)).map((match) => match[1]);
}

const HINTS: Record<string, string> = {
  startup: "Acme",
  goal: "100 customer calls",
  area: "B2B pricing",
};

type NameState = "idle" | "checking" | "found" | "missing";

/**
 * Generic pop-up that asks the user to fill the [bracketed] gaps of a quick
 * action before the sentence is sent to the assistant. Startup names are
 * checked against the startups that actually exist on the platform.
 */
export function ActionFillDialog({
  label,
  open,
  onOpenChange,
  onSubmit,
}: {
  label: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (sentence: string) => void;
}) {
  const fields = useMemo(() => (label ? actionPlaceholders(label) : []), [label]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [nameState, setNameState] = useState<NameState>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const checkedRef = useRef("");

  const startupField = fields.find((field) => field.toLowerCase().includes("startup"));
  const startupValue = startupField ? (values[startupField] ?? "").trim() : "";

  useEffect(() => {
    if (!open) {
      setValues({});
      setNameState("idle");
      setSuggestions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !startupField) return;
    if (startupValue.length < 2) {
      setNameState("idle");
      setSuggestions([]);
      return;
    }
    const query = startupValue;
    checkedRef.current = query;
    setNameState("checking");
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("startups")
        .select("name")
        .eq("is_published", true)
        .ilike("name", `%${query.replace(/[%_]/g, "")}%`)
        .limit(5);
      if (checkedRef.current !== query) return;
      const names = (data ?? []).map((row) => row.name).filter((name): name is string => Boolean(name));
      const exact = names.some((name) => name.toLowerCase() === query.toLowerCase());
      setSuggestions(exact ? [] : names);
      setNameState(names.length ? (exact ? "found" : "missing") : "missing");
    }, 300);
    return () => clearTimeout(timer);
  }, [open, startupField, startupValue]);

  const filled = fields.every((field) => (values[field] ?? "").trim());
  const complete = filled && (!startupField || nameState === "found");

  const submit = () => {
    if (!label || !complete) return;
    const sentence = label.replace(/\[([^\]]+)\]/g, (_, name: string) => (values[name] ?? "").trim());
    onOpenChange(false);
    onSubmit(sentence);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Fill in the details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {fields.map((field) => {
            const isStartup = field === startupField;
            return (
              <div key={field} className="space-y-2">
                <Label htmlFor={`action-field-${field}`} className="capitalize">{field}</Label>
                <div className="relative">
                  <Input
                    id={`action-field-${field}`}
                    autoFocus={field === fields[0]}
                    value={values[field] ?? ""}
                    placeholder={HINTS[field] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                    onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
                    className={isStartup ? "pr-9" : undefined}
                  />
                  {isStartup && nameState === "checking" ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                  {isStartup && nameState === "found" ? (
                    <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
                  ) : null}
                  {isStartup && nameState === "missing" ? (
                    <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                  ) : null}
                </div>
                {isStartup && nameState === "missing" ? (
                  <p className="text-xs text-muted-foreground">
                    {suggestions.length ? "No exact match. Did you mean:" : "We couldn't find a startup with that name on the platform."}
                  </p>
                ) : null}
                {isStartup && suggestions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                        onClick={() => setValues((current) => ({ ...current, [field]: name }))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-full" disabled={!complete} onClick={submit}>Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
