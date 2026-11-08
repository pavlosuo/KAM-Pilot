import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Handshake, Loader2, Plus, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { InfoHint } from "@/design-system/ventura-6bef42/components/program-content/InfoHint";
import {
  addConnection,
  matchConnectionsWithCohort,
  removeConnection,
} from "@/design-system/ventura-6bef42/lib/program-connections.functions";
import { fireCelebrationConfetti } from "@/design-system/ventura-6bef42/lib/celebrate";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export type ProgramConnection = {
  id: string;
  kind: "mentor" | "investor";
  name: string;
  headline: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  expertise: string[] | null;
  location: string | null;
  summary: string | null;
};

export type ConnectionMatch = {
  id: string;
  connection_id: string;
  startup_id: string;
  kind: "mentor" | "investor";
  points: string[] | null;
  reason: string | null;
  source: string;
};

function Avatar({ src, name, size = 44 }: { src: string | null; name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const url = safeSrc(src ?? undefined);
  return url ? (
    <img
      src={url}
      alt={name}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border border-border/60 object-cover"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-xs font-medium text-muted-foreground"
    >
      {initials}
    </div>
  );
}

export function ConnectionsCard({
  slug,
  kind,
  connections,
  matches,
  startupName,
  hasStartups,
  onChanged,
}: {
  slug: string;
  kind: "mentor" | "investor";
  connections: ProgramConnection[];
  matches: ConnectionMatch[];
  startupName: (id: string) => string;
  hasStartups: boolean;
  onChanged: () => void;
}) {
  const add = useServerFn(addConnection);
  const remove = useServerFn(removeConnection);
  const matchCohort = useServerFn(matchConnectionsWithCohort);

  const [url, setUrl] = useState("");
  const [noStartups, setNoStartups] = useState(false);
  const [detail, setDetail] = useState<{
    person: ProgramConnection;
    match: ConnectionMatch;
  } | null>(null);

  const label = kind === "mentor" ? "Mentor" : "Investor";
  const Icon = kind === "mentor" ? Users : Handshake;

  const addMutation = useMutation({
    mutationFn: async () => add({ data: { slug, kind, linkedinUrl: url.trim() } }),
    onSuccess: (res) => {
      setUrl("");
      toast.success(`${res.person.name} added to your ${kind}s`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || `Could not add this ${kind}`),
  });

  const matchMutation = useMutation({
    mutationFn: async () => matchCohort({ data: { slug, kind } }),
    onSuccess: () => {
      fireCelebrationConfetti();
      toast.success(`${label}s matched across the cohort`);
      onChanged();
    },
    onError: (e: Error) => {
      if ((e.message || "").includes("NO_COHORT_STARTUPS")) {
        setNoStartups(true);
        return;
      }
      toast.error(e.message || "Matching failed");
    },
  });

  const matchesFor = (connectionId: string) =>
    matches.filter((m) => m.kind === kind && m.connection_id === connectionId);


  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-b from-card to-muted/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            {label} connections
          </CardTitle>
          <InfoHint
            text={`Paste the LinkedIn profile of every ${kind} in your network. Ventura researches them and stores them here. When your cohort is set, one click distributes them across your startups — each startup gets a ${kind}, and nobody is spread thin.`}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={`linkedin.com/in/… or /company/…`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim() && !addMutation.isPending) addMutation.mutate();
            }}
          />
          <Button
            className="cursor-pointer sm:w-32"
            disabled={!url.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add
          </Button>
        </div>

        {connections.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No {kind}s yet. Paste a LinkedIn profile above — we fetch their photo, role history and
            expertise automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {connections.map((person) => {
              const personMatches = matchesFor(person.id);
              return (
                <div
                  key={person.id}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3 transition-all hover:border-primary/30 hover:bg-accent/30 sm:flex-row sm:items-center"
                >

                  <div className="flex w-full min-w-0 items-center gap-3">
                    {person.linkedin_url ? (
                      <a
                        href={person.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <Avatar src={person.photo_url} name={person.name} />
                      </a>
                    ) : (
                      <Avatar src={person.photo_url} name={person.name} />
                    )}
                    <div className="min-w-0 flex-1">
                      {person.linkedin_url ? (
                        <a
                          href={person.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {person.name}
                        </a>
                      ) : (
                        <p className="truncate text-sm font-medium">{person.name}</p>
                      )}
                      {person.headline ? (
                        <p className="max-w-full truncate text-xs text-muted-foreground">
                          {person.headline}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex w-full flex-1 flex-col items-start gap-1 sm:items-end">
                    {personMatches.length ? (
                      <>
                        {personMatches.map((m) => (
                          <Badge
                            key={m.startup_id}
                            variant="secondary"
                            className="cursor-pointer truncate max-w-full hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail({ person, match: m });
                            }}
                          >
                            Matched with {startupName(m.startup_id)}
                          </Badge>
                        ))}
                      </>
                    ) : null}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-destructive sm:h-9 sm:w-9 sm:justify-center sm:p-0"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await remove({ data: { slug, id: person.id } });
                      onChanged();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sm:hidden">Delete</span>
                  </Button>
                </div>
              );
            })}

            <Button
              variant="outline"
              className="w-full cursor-pointer border-border/60 bg-gradient-to-r from-muted/40 to-transparent transition-all hover:border-primary/40 hover:from-primary/10"
              disabled={matchMutation.isPending}
              onClick={() => {
                if (!hasStartups) {
                  setNoStartups(true);
                  return;
                }
                matchMutation.mutate();
              }}
            >
              {matchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Match {kind}s with cohort startups
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {detail ? `Matched with ${startupName(detail.match.startup_id)}` : "Match details"}
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="custom-scrollbar custom-scrollbar-fade min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-3">
                <Avatar src={detail.person.photo_url} name={detail.person.name} size={56} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{detail.person.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {detail.person.headline ?? ""}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium">
                Matched with {startupName(detail.match.startup_id)}
              </p>
              <ul className="space-y-2">
                {(detail.match.points ?? []).map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              {detail.match.reason ? (
                <p className="text-sm text-muted-foreground">{detail.match.reason}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button className="cursor-pointer" onClick={() => setDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noStartups} onOpenChange={setNoStartups}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No startups in the cohort yet</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Invite startups to your program first — then Ventura can match your {kind}s with them.
          </p>
          <DialogFooter>
            <Button asChild className="cursor-pointer">
              <Link to="/program/$slug/approvals" params={{ slug }}>
                Open Invites
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
