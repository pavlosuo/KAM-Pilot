import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Calendar } from "@/design-system/ventura-6bef42/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";

function toDate(value: string, pattern: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, pattern, new Date());
  return isValid(d) ? d : undefined;
}

/** Date picker returning an ISO date string (yyyy-MM-dd). */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disablePast = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** When true, dates before today cannot be selected. */
  disablePast?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value, "yyyy-MM-dd");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full cursor-pointer justify-start gap-2 rounded-lg bg-background px-3 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{selected ? format(selected, "d MMM yyyy") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-xl p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={disablePast ? { before: new Date() } : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
          className={cn("pointer-events-auto p-3")}
        />
        {value ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full cursor-pointer rounded-lg text-xs"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Date + time picker returning a `yyyy-MM-ddTHH:mm` string. */
export function DateTimePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [datePart = "", timePart = ""] = value ? value.split("T") : ["", ""];

  return (
    <div className={cn("flex gap-2", className)}>
      <DatePicker
        value={datePart}
        onChange={(d) => onChange(d ? `${d}T${timePart || "09:00"}` : "")}
        className="flex-1"
      />
      <Input
        type="time"
        value={timePart}
        onChange={(e) => onChange(`${datePart || format(new Date(), "yyyy-MM-dd")}T${e.target.value}`)}
        className="w-32 rounded-lg bg-background"
      />
    </div>
  );
}
