import { Crown, Linkedin, Loader2, Network, Sparkles } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export type MatchKind = "mentor" | "investor";

export type MatchPerson = {
  id: string;
  rank: number;
  name: string;
  headline: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  reason: string | null;
  connection_id: string | null;
  intro_requested: boolean;
  from_program: boolean;
  source?: "program" | "ventura" | "web" | null;
  ventura_handle?: string | null;
};

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  const url = safeSrc(src ?? undefined);
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return url ? (
    <img
      src={url}
      alt={name}
      style={{ width: size, height: size }}
      className="rounded-full border border-border/60 object-cover"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full border border-border/60 bg-muted text-sm font-medium text-muted-foreground"
    >
      {initials}
    </div>
  );
}

export function PersonTile({
  person,
  top,
  onAsk,
  asking,
  kind = "mentor",
}: {
  person: MatchPerson;
  top: boolean;
  onAsk: (person: MatchPerson) => void;
  asking: boolean;
  kind?: "mentor" | "investor";
}) {
  const size = top ? 72 : 56;
  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5 text-center">
      <div className="relative">
        {top ? (
          <Crown className="absolute -top-4 left-1/2 h-4 w-4 -translate-x-1/2 text-yellow-500" />
        ) : null}
        <Avatar src={person.photo_url} name={person.name} size={size} />
      </div>
      <p className="w-full truncate text-xs font-medium">{person.name}</p>
      {person.from_program ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] leading-tight font-medium text-primary">
          <Network className="h-2.5 w-2.5" /> Program<span className="hidden sm:inline">&nbsp;network</span>
        </span>
      ) : person.source === "ventura" ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] leading-tight font-medium text-emerald-600 dark:text-emerald-400">
          <Sparkles className="h-2.5 w-2.5" /> Ventura<span className="hidden sm:inline">&nbsp;network</span>
        </span>
      ) : null}
      {person.source === "ventura" && person.ventura_handle ? (
        <Button asChild size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs">
          <a
            href={`/${kind === "mentor" ? "mentor" : "investor"}/${person.ventura_handle}`}
            target="_blank"
            rel="noreferrer"
          >
            Ventura profile
          </a>
        </Button>
      ) : null}
      {person.linkedin_url ? (
        <Button asChild size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs">
          <a href={person.linkedin_url} target="_blank" rel="noreferrer">
            <Linkedin className="mr-1 h-3 w-3" /> LinkedIn
          </a>
        </Button>
      ) : null}
      {person.from_program && !person.intro_requested ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={asking}
          className="h-7 cursor-pointer px-2 text-[11px] leading-tight whitespace-normal"
          onClick={() => onAsk(person)}
        >
          {asking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Ask lead to connect
        </Button>
      ) : null}
    </div>
  );
}

export function Podium({
  people,
  onAsk,
  askingId,
  kind = "mentor",
}: {
  people: MatchPerson[];
  onAsk: (person: MatchPerson) => void;
  askingId: string | null;
  kind?: MatchKind;
}) {
  const sorted = [...people].sort((a, b) => a.rank - b.rank);
  const [first, second, third] = sorted;
  const ordered = [second, first, third].filter(Boolean) as MatchPerson[];
  return (
    <div className="flex w-full max-w-full items-end justify-center gap-2 overflow-hidden sm:gap-3">
      {ordered.map((person) => (
        <PersonTile
          key={person.id}
          person={person}
          top={person.id === first?.id}
          onAsk={onAsk}
          asking={askingId === person.id}
          kind={kind}
        />
      ))}
    </div>
  );
}

export function PodiumSkeleton({ kind }: { kind: MatchKind }) {
  const label = kind === "mentor" ? "Mentor" : "Investor";
  const labels = [`${label} 2`, `${label} 1`, `${label} 3`];
  return (
    <div className="flex w-full max-w-full items-end justify-center gap-2 overflow-hidden sm:gap-3">
      {labels.map((l, i) => (
        <div key={l} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5">
          <div
            className={cn(
              "animate-pulse rounded-full bg-muted",
              i === 1 ? "h-[72px] w-[72px]" : "h-14 w-14",
            )}
          />
          <p className="text-xs text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  );
}
