import { cn } from "@/design-system/ventura-6bef42/lib/utils";

/** Compact segmented control in the Ventura control-bar style. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center rounded-lg bg-muted p-0.5", className)} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count != null && <span className="tabular-nums text-muted-foreground">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
