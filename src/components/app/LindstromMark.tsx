import { cn } from "@/design-system/ventura-6bef42/lib/utils";

/**
 * Lindström wordmark: the red emblem (Logo.dev favicon copy saved in /public)
 * followed by the name set in the brand's dark blue, as on lindstromgroup.com.
 */
export function LindstromMark({ className, inverted = false, label = "Lindström" }: { className?: string; inverted?: boolean; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/favicon.png" alt="" className="h-7 w-7 shrink-0 rounded-full object-contain" />
      <span className={cn("text-xl font-bold tracking-tight", inverted ? "text-white" : "text-lind-navy")}>{label}</span>
    </span>
  );
}
