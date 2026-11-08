import { Link } from "@tanstack/react-router";
import { Bookmark, Crown, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { StartupMatch } from "@/design-system/ventura-6bef42/lib/role-home.functions";

export function StartupMatchPodium({ matches, onSave, onMessage, savingId }: { matches: StartupMatch[]; onSave: (match: StartupMatch) => void; onMessage: (match: StartupMatch) => void; savingId: string | null }) {
  const sorted = [...matches].sort((a, b) => a.rank - b.rank);
  const order = [sorted[1], sorted[0], sorted[2]].filter(Boolean) as StartupMatch[];
  return (
    <div className="grid items-end gap-4 lg:grid-cols-3">
      {order.map((match) => {
        const first = match.rank === 1;
        const logo = safeSrc(match.logoUrl ?? undefined);
        return (
          <article key={match.id} className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-transform hover:-translate-y-1", first ? "border-primary/50 lg:min-h-[390px]" : "border-border/70 lg:min-h-[360px]") }>
            {first ? <div className="flex items-center justify-center gap-2 border-b border-primary/20 bg-primary/10 py-2 text-xs font-semibold uppercase text-primary"><Crown className="h-4 w-4" /> Best match</div> : <div className="border-b py-2 text-center text-xs font-medium text-muted-foreground">Match #{match.rank}</div>}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start gap-3">
                {logo ? <img src={logo} alt={`${match.name} logo`} className="h-14 w-14 rounded-lg border bg-background object-contain p-1" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-muted text-xl font-semibold">{match.name.charAt(0).toUpperCase()}</div>}
                <div className="min-w-0 flex-1"><h3 className="truncate text-lg font-semibold">{match.name}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{match.tagline || "View the startup profile to learn more."}</p></div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{match.score}%</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">{[match.stage, match.industry, ...match.industryTags].filter(Boolean).slice(0, 4).map((tag) => <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>)}</div>
              {match.location ? <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{match.location}</p> : null}
              <ul className="mt-5 flex-1 space-y-2">{match.reasons.map((reason) => <li key={reason} className="flex gap-2 text-sm leading-relaxed"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{reason}</span></li>)}</ul>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button asChild className="col-span-2 cursor-pointer"><Link to="/startup/$slug" params={{ slug: match.slug }}>Open profile</Link></Button>
                <Button variant="outline" className="cursor-pointer" disabled={savingId === match.startupId} onClick={() => onSave(match)}><Bookmark className={cn("mr-1.5 h-4 w-4", match.saved && "fill-current")} />{match.saved ? "Saved" : "Save"}</Button>
                <Button variant="outline" className="cursor-pointer" onClick={() => onMessage(match)}><MessageCircle className="mr-1.5 h-4 w-4" />Message</Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function StartupMatchPodiumSkeleton() {
  return <div className="grid items-end gap-4 lg:grid-cols-3">{[2, 1, 3].map((rank) => <div key={rank} className={cn("animate-pulse rounded-lg border bg-card p-5", rank === 1 ? "h-[390px]" : "h-[360px]")}><div className="h-14 w-14 rounded-lg bg-muted" /><div className="mt-5 h-5 w-2/3 rounded bg-muted" /><div className="mt-3 h-4 w-full rounded bg-muted" /><div className="mt-8 space-y-3"><div className="h-4 rounded bg-muted" /><div className="h-4 rounded bg-muted" /><div className="h-4 w-4/5 rounded bg-muted" /></div></div>)}</div>;
}