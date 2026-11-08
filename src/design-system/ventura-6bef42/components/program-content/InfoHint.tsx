import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

/** Small round info button that reveals a card's description on hover/tap. */
export function InfoHint({ text, className }: { text: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className={cn(
            "inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
            className,
          )}
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="max-w-xs text-sm leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}
