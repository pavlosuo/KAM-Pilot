import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Gauge, Leaf, Lightbulb, MapPin, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { RecapLink, RecapTarget } from "@/lib/engine/recap";

/**
 * Recap → dashboard links. The Recap is the short story; these quiet
 * affordances let a reader open the detailed place behind any number, bar,
 * site or step. The engine names the place, this module maps it to a route.
 */

const SlugContext = createContext<string | null>(null);

export function DeepLinkProvider({ slug, children }: { slug: string; children: ReactNode }) {
  return <SlugContext.Provider value={slug}>{children}</SlugContext.Provider>;
}

const PAGE_ICON: Record<RecapTarget["page"], LucideIcon> = {
  overview: Gauge,
  sites: MapPin,
  site: MapPin,
  impact: Leaf,
  insights: Lightbulb,
  rules: Scale,
  trust: ShieldCheck,
};

interface TargetProps {
  target: RecapTarget;
  className?: string;
  title?: string;
  children: ReactNode;
  "aria-label"?: string;
}

/** Router link to a Recap target; renders its children plain when outside a dashboard. */
export function TargetLink({ target, className, children, ...rest }: TargetProps) {
  const account = useContext(SlugContext);
  if (!account) return <span className={className}>{children}</span>;
  const p = { className, ...rest };
  switch (target.page) {
    case "overview":
      return (
        <Link to="/account/$account" params={{ account }} hash={target.hash} {...p}>
          {children}
        </Link>
      );
    case "sites":
      return (
        <Link
          to="/account/$account/sites"
          params={{ account }}
          search={{ color: target.color, status: target.status, sort: target.sort }}
          hash={target.status || target.sort ? "compare" : target.color ? "map" : undefined}
          {...p}
        >
          {children}
        </Link>
      );
    case "site":
      return (
        <Link to="/account/$account/sites/$siteId" params={{ account, siteId: target.siteId }} {...p}>
          {children}
        </Link>
      );
    case "impact":
      return (
        <Link to="/account/$account/impact" params={{ account }} hash={target.hash} {...p}>
          {children}
        </Link>
      );
    case "insights":
      return (
        <Link to="/account/$account/insights" params={{ account }} hash={target.hash} {...p}>
          {children}
        </Link>
      );
    case "rules":
      return (
        <Link to="/account/$account/rules" params={{ account }} hash={target.hash} {...p}>
          {children}
        </Link>
      );
    case "trust":
      return (
        <Link to="/account/$account/trust" params={{ account }} hash={target.hash} {...p}>
          {children}
        </Link>
      );
  }
}

/** "See the detail" pill under an answer. */
export function BeatLink({ link, dark = false }: { link: RecapLink; dark?: boolean }) {
  const Icon = PAGE_ICON[link.to.page];
  return (
    <TargetLink
      target={link.to}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold shadow-lind transition-colors focus-visible:outline-2",
        dark ? "border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20" : "border-lind-line bg-card text-lind-blue hover:border-lind-blue hover:bg-lind-blue/5",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{link.label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </TargetLink>
  );
}

/**
 * Wraps a row of a visual (bar, legend entry, step…) so it opens its detail.
 * A faint chevron hints that it can be opened; hovering lifts the row.
 */
export function RowLink({ link, children, className }: { link?: RecapLink; children: ReactNode; className?: string }) {
  if (!link) return <div className={className}>{children}</div>;
  return (
    <TargetLink
      target={link.to}
      title={`Open ${link.label}`}
      className={cn("group relative -mx-2 flex items-center gap-2 rounded-lg px-2 transition-colors hover:bg-lind-blue/5 focus-visible:outline-2", className)}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight className="h-5 w-5 shrink-0 text-lind-blue opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
    </TargetLink>
  );
}
