import { useEffect, useRef, useState } from "react";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
};

export function SuggestInput({ id, value, onChange, suggestions, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q.length === 0
    ? []
    : suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(e.target.value.trim().length > 0);
        }}
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {filtered.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                s.toLowerCase() === q && "bg-accent",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
