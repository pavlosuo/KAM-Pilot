import { useState } from "react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function HandleEditor({
  value,
  prefix,
  onSave,
  minLength = 3,
}: {
  value: string;
  prefix: string;
  onSave: (next: string) => Promise<void>;
  minLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate">{prefix}{value}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label="Edit URL"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  async function commit() {
    const next = normalize(draft);
    if (next.length < minLength) {
      toast.error(`URL must be at least ${minLength} characters`);
      return;
    }
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update URL");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{prefix}</span>
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={saving}
        className="h-7 w-48 text-xs"
      />
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commit} disabled={saving} aria-label="Save URL">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancel">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
