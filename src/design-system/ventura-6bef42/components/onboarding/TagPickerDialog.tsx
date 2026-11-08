import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export type TagCategory = { category: string; tags: string[] };

/**
 * Categorised tag picker — same interaction as the founder "Skills" picker,
 * reusable for investor / coach onboarding questions.
 */
export function TagPickerDialog({
  open,
  onOpenChange,
  categories,
  value,
  onConfirm,
  title = "Choose tags",
  description = "Browse by category and tap to add.",
  max,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TagCategory[];
  value: string[];
  onConfirm: (next: string[]) => void;
  title?: string;
  description?: string;
  max?: number;
}) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.category ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(value));

  const existing = useMemo(() => new Set(value), [value]);

  // Re-seed selection whenever the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(new Set(value));
  }

  const atMax = typeof max === "number" && selected.size >= max;

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else if (!atMax) next.add(tag);
      return next;
    });
  };

  const active = categories.find((c) => c.category === activeCategory) ?? categories[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 flex flex-col max-h-[85dvh] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}{" "}
            {typeof max === "number"
              ? `${selected.size}/${max} selected.`
              : selected.size > 0
                ? `${selected.size} selected.`
                : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <div className="md:w-56 shrink-0 md:border-r border-b md:border-b-0 overflow-x-auto md:overflow-y-auto">
            <div className="flex md:flex-col gap-1 p-2">
              {categories.map((c) => (
              <button
                  key={c.category}
                  type="button"
                  onClick={() => setActiveCategory(c.category)}
                  className={cn(
                    "cursor-pointer whitespace-nowrap md:whitespace-normal text-left rounded-lg px-3 py-2 text-sm transition-colors shrink-0",
                    active?.category === c.category
                      ? "bg-foreground text-background"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.category}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="flex flex-wrap gap-2">
              {(active?.tags ?? []).map((tag) => {
                const isSelected = selected.has(tag);
                const disabled = !isSelected && atMax;
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(tag)}
                    className={cn(
                      "group cursor-pointer rounded-full border px-4 py-2 text-sm transition-all duration-200 flex items-center gap-1.5",
                      disabled
                        ? "border-dashed border-muted-foreground/30 text-muted-foreground/50 cursor-not-allowed"
                        : isSelected
                          ? "border-foreground bg-foreground text-background scale-105 shadow-sm"
                          : "border-border hover:border-foreground/40 hover:scale-105",
                      existing.has(tag) && !isSelected ? "" : "",
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="px-6 py-3 border-t shrink-0 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).map((s) => (
                <Badge key={s} variant="secondary" className="rounded-full pr-1">
                  {s}
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    className="cursor-pointer ml-1 rounded-full p-0.5 hover:bg-foreground/10"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(Array.from(selected));
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Trigger + selected-tag list, the pattern used across the new onboarding steps. */
export function TagPickerField({
  label,
  hint,
  categories,
  value,
  onChange,
  max,
}: {
  label: string;
  hint?: string;
  categories: TagCategory[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {value.length > 0 ? `${value.length} selected — edit` : "Choose from the list"}
      </Button>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="rounded-full pr-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="cursor-pointer ml-1 rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <TagPickerDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        value={value}
        onConfirm={onChange}
        title={label}
        max={max}
      />
    </div>
  );
}
