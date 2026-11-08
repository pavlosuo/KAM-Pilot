import { type ReactNode, useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/design-system/ventura-6bef42/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/design-system/ventura-6bef42/components/ui/dialog";

type Props = {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  renderOption?: (opt: string, selected: boolean) => ReactNode;
  pinnedOption?: string;
  modal?: boolean;
  modalTitle?: string;
};

export function MultiSelectCombobox({
  options,
  values,
  onChange,
  placeholder = "Select...",
  emptyText = "No results.",
  renderOption,
  pinnedOption,
  modal = false,
  modalTitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeValue, setActiveValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleOptions = useMemo(
    () => options.filter((o) => o !== pinnedOption),
    [options, pinnedOption],
  );
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleOptions;

    return visibleOptions.filter((option) => option.toLowerCase().includes(query));
  }, [search, visibleOptions]);

  useEffect(() => {
    if (modal && open) {
      const timer = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [modal, open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    setActiveValue(filteredOptions[0] ?? pinnedOption ?? "");
    listRef.current?.scrollTo({ top: 0 });
  }, [filteredOptions, open, pinnedOption, search]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, search]);

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full justify-between font-normal h-11"
      onClick={() => setOpen(!open)}
    >
      <span className={cn("truncate", values.length === 0 && "text-muted-foreground")}>
        {values.length === 0
          ? placeholder
          : `${values.length} selected`}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const listContent = (
    <>
      <div className="border-b px-1">
        <CommandInput
          ref={searchRef}
          value={search}
          onValueChange={setSearch}
          placeholder="Search programs..."
          className="h-11"
        />
      </div>
      {pinnedOption && (
        <div className="p-1.5 pb-0">
          {(() => {
            const opt = pinnedOption;
            const selected = values.includes(opt);
            return (
              <div
                onClick={() => toggle(opt)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-2 py-2 my-0.5 cursor-pointer transition-colors",
                  "border border-dashed border-muted-foreground/30",
                  selected && "bg-primary/5 hover:bg-primary/10",
                )}
              >
                <div className="flex-1 min-w-0">
                  {renderOption ? (
                    renderOption(opt, selected)
                  ) : (
                    <span className="truncate text-sm">{opt}</span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                    selected
                      ? "bg-primary border-primary text-primary-foreground scale-100"
                      : "border-muted-foreground/30 scale-90 opacity-60 group-hover:opacity-100",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3 w-3 transition-opacity",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                    strokeWidth={3}
                  />
                </div>
              </div>
            );
          })()}
          <div className="border-b border-border/50 my-1" />
        </div>
      )}
      <CommandList ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-mt-0">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Search className="h-5 w-5 opacity-50" />
            <span className="text-sm">{emptyText}</span>
          </div>
        </CommandEmpty>
        <CommandGroup className="p-1.5">
          {filteredOptions.map((opt) => {
              const selected = values.includes(opt);
              return (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => toggle(opt)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2 py-2 my-0.5 cursor-pointer transition-colors",
                    "data-[selected=true]:bg-muted/60",
                    selected && "bg-primary/5 hover:bg-primary/10",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    {renderOption ? (
                      renderOption(opt, selected)
                    ) : (
                      <span className="truncate text-sm">{opt}</span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                      selected
                        ? "bg-primary border-primary text-primary-foreground scale-100"
                        : "border-muted-foreground/30 scale-90 opacity-60 group-hover:opacity-100",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3 w-3 transition-opacity",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                      strokeWidth={3}
                    />
                  </div>
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
    </>
  );

  return (
    <div className="space-y-2">
      {modal ? (
        <Dialog open={open} onOpenChange={setOpen}>
          {trigger}
          <DialogContent className="sm:max-w-md p-0 gap-0 flex flex-col max-h-[85dvh] overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle>{modalTitle || placeholder}</DialogTitle>
              <DialogDescription>
                Search and select one or more programs.
              </DialogDescription>
            </DialogHeader>
            <Command shouldFilter={false} value={activeValue} onValueChange={setActiveValue} className="bg-popover flex-1 min-h-0 overflow-hidden">
              {listContent}
            </Command>
            <div className="px-6 pb-6 pt-2 flex justify-end shrink-0">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {trigger}
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border shadow-lg"
            align="start"
            side="bottom"
            avoidCollisions={false}
            sideOffset={6}
          >
            <Command shouldFilter={false} value={activeValue} onValueChange={setActiveValue} className="bg-popover">
              {listContent}
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
