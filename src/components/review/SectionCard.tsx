import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

type Tone = "primary" | "destructive" | "emerald" | "amber" | "sky" | "violet" | "blue" | "rose" | "orange";

/** Tone names are kept for callers; each maps to a Lindström brand colour. */
const TONES: Record<Tone, string> = {
  primary: "bg-lind-navy/10 text-lind-navy",
  destructive: "bg-lind-red/10 text-lind-red",
  emerald: "bg-lind-green/10 text-lind-green",
  amber: "bg-lind-orange/10 text-lind-orange",
  sky: "bg-lind-blue/10 text-lind-blue",
  violet: "bg-lind-purple/10 text-lind-purple",
  blue: "bg-lind-blue/10 text-lind-blue",
  rose: "bg-lind-pink/10 text-lind-pink",
  orange: "bg-lind-orange/10 text-lind-orange",
};

/** White Lindström content card with a coloured icon and a dark-blue title. */
export function SectionCard({
  icon: Icon,
  title,
  tone = "primary",
  action,
  count,
  children,
  className,
  contentClassName,
  subtitle,
  id,
}: {
  /** Anchor that Recap links land on. */
  id?: string;
  icon: LucideIcon;
  title: ReactNode;
  tone?: Tone;
  action?: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  subtitle?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <Card id={id} data-deep-link={id ? "" : undefined} className={cn("relative overflow-hidden", className)}>
      <CardHeader className="relative pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", t)}>
            <Icon className="h-[1.1rem] w-[1.1rem]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{title}</span>
          </span>
          {count != null && count > 0 && <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-sm font-bold", t)}>{count}</span>}
          {action ? <span className="ml-auto shrink-0">{action}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("relative px-6 pb-6 pt-0", contentClassName)}>
        {children}
        {typeof subtitle === "string" && /illustrative|assumption|allocated|synthetic|stored in this browser|bundled challenge/i.test(subtitle) && (
          <aside className="mt-4 text-sm text-muted-foreground" aria-label="Methodology note">
            {subtitle}
          </aside>
        )}
      </CardContent>
    </Card>
  );
}
