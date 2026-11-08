import { Check, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

/** Large, plainly labelled toggle chip (multi-select). */
export function Chip({
  selected,
  onClick,
  children,
  meta,
  onRemove,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  meta?: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex">
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={onClick}
        className={cn(
          "inline-flex h-11 cursor-pointer items-center gap-3 rounded-full border-2 px-4 text-base font-semibold transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary",
          onRemove && "rounded-r-none border-r-0 pr-3",
        )}
      >
        {selected && <Check className="h-4 w-4 shrink-0" />}
        {children}
        {meta ? <span className={cn("text-sm font-normal", selected ? "text-primary-foreground" : "text-muted-foreground")}>{meta}</span> : null}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === "string" ? children : "option"}`}
          className={cn(
            "inline-flex h-11 cursor-pointer items-center rounded-r-full border-2 border-l-0 pl-1 pr-3 transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </span>
  );
}

/** "+ Add your own …" chip that opens a small inline input. */
export function AddOwnChip({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-dashed border-border bg-card px-4 text-base font-semibold text-primary transition-colors hover:border-primary"
      >
        <Plus className="h-4 w-4" /> {label}
      </button>
    );
  }
  return (
    <form
      className="inline-flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={80}
      />
      <Button type="submit" disabled={!value.trim()}>
        Add
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
