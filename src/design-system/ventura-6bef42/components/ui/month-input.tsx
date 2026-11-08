import * as React from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { CalendarIcon } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type MonthInputProps = {
  value?: string; // "YYYY-MM"
  onChange?: (e: { target: { value: string } }) => void;
  min?: string; // "YYYY-MM"
  max?: string; // "YYYY-MM"
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

function parse(v?: string): { year: number; month: number } | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})/.exec(v);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

function toKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function formatLabel(v?: string): string {
  const p = parse(v);
  if (!p) return "";
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

/**
 * Cross-browser month picker. Safari does not support <input type="month">
 * reliably (renders as plain text and no picker), so we render a
 * Popover-based month/year selector with the same API as before:
 * value="YYYY-MM", onChange gets { target: { value } }.
 */
export const MonthInput = React.forwardRef<HTMLButtonElement, MonthInputProps>(
  ({ value, onChange, min, max, disabled, placeholder, className, id }, ref) => {
    const now = new Date();
    const parsed = parse(value);
    const initialYear = parsed?.year ?? now.getFullYear();
    const [viewYear, setViewYear] = React.useState(initialYear);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
      if (open) {
        const p = parse(value);
        setViewYear(p?.year ?? new Date().getFullYear());
      }
    }, [open, value]);

    const minP = parse(min);
    const maxP = parse(max);

    const isDisabled = (y: number, m: number) => {
      if (minP && (y < minP.year || (y === minP.year && m < minP.month))) return true;
      if (maxP && (y > maxP.year || (y === maxP.year && m > maxP.month))) return true;
      return false;
    };

    const emit = (v: string) => {
      onChange?.({ target: { value: v } });
    };

    const label = formatLabel(value);

    return (
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start px-3 py-1 font-normal text-sm shadow-sm",
              !label && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
            <span className="truncate">{label || placeholder || "Select month"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 pointer-events-auto" align="start">
          <div className="flex items-center justify-between pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewYear((y) => y - 1)}
            >
              ‹
            </Button>
            <div className="text-sm font-medium">{viewYear}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewYear((y) => y + 1)}
            >
              ›
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, idx) => {
              const m = idx + 1;
              const key = toKey(viewYear, m);
              const disabledCell = isDisabled(viewYear, m);
              const selected = value === key;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={selected ? "default" : "ghost"}
                  size="sm"
                  disabled={disabledCell}
                  className="h-8 text-xs"
                  onClick={() => {
                    emit(key);
                    setOpen(false);
                  }}
                >
                  {name.slice(0, 3)}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
MonthInput.displayName = "MonthInput";
