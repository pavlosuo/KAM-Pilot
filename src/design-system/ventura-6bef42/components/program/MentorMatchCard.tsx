import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Linkedin,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
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
import {
  matchMentorToCohort,
  saveMentorMatch,
  type CohortMentorMatch,
} from "@/design-system/ventura-6bef42/lib/program-mentor-match.functions";
import { fireCelebrationConfetti } from "@/design-system/ventura-6bef42/lib/celebrate";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export type NetworkCoach = {
  id: string;
  name: string;
  email: string | null;
  expertise: string[] | null;
  photo_url: string | null;
  linkedin_url?: string | null;
  headline?: string | null;
  matched_startup_id?: string | null;
  match_points?: string[] | null;
  match_reason?: string | null;
};

const STEPS = [
  { title: "Research the profile", body: "We pull their roles, expertise and photo from the web." },
  { title: "Compare with your cohort", body: "Profiles, weekly updates and current goals." },
  { title: "Get the best match", body: "One startup, with the reasoning spelled out." },
];

function MentorAvatar({ src, name, size = 64 }: { src: string | null; name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "M";
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
      className="flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-sm font-medium text-muted-foreground"
    >
      {initials}
    </div>
  );
}

export function MentorMatchCard({
  slug,
  coaches,
  startupName,
  onChanged,
  onAddManual,
  onRemoveCoach,
}: {
  slug: string;
  coaches: NetworkCoach[];
  startupName: (id: string) => string;
  onChanged: () => void;
  onAddManual: () => void;
  onRemoveCoach: (id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CohortMentorMatch | null>(null);
  const [details, setDetails] = useState<NetworkCoach | null>(null);
  const [tried, setTried] = useState<string[]>([]);
  const runMatch = useServerFn(matchMentorToCohort);
  const persist = useServerFn(saveMentorMatch);

  const match = useMutation({
    mutationFn: (vars: { linkedinUrl: string; exclude: string[] }) =>
      runMatch({ data: { slug, linkedinUrl: vars.linkedinUrl, excludeStartupIds: vars.exclude } }),
    onSuccess: (data) => {
      setResult(data);
      setTried((prev) => (prev.includes(data.startup.id) ? prev : [...prev, data.startup.id]));
      window.setTimeout(() => fireCelebrationConfetti(), 300);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not match this mentor."),
  });

  const save = useMutation({
    mutationFn: (m: CohortMentorMatch) =>
      persist({
        data: {
          slug,
          name: m.mentor.name,
          headline: m.mentor.headline,
          linkedinUrl: m.mentor.linkedin_url,
          photoUrl: m.mentor.photo_url,
          expertise: m.mentor.expertise,
          summary: m.mentor.summary,
          startupId: m.startup.id,
          points: m.points,
          reason: m.reason,
          assign: true,
        },
      }),
    onSuccess: () => {
      toast.success("Mentor saved and assigned.");
      setResult(null);
      setTried([]);
      setUrl("");
      onChanged();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save this mentor."),
  });

  const running = match.isPending;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              AI mentor matching
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a mentor&apos;s LinkedIn profile. We research them and find the startup they can
              help most.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer text-xs text-muted-foreground"
            onClick={onAddManual}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add manually
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!url.trim() || running) return;
              setTried([]);
              match.mutate({ linkedinUrl: url.trim(), exclude: [] });
            }}
          >
            <div className="relative flex-1">
              <Linkedin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="linkedin.com/in/mentor-handle"
                className="pl-9"
                disabled={running}
              />
            </div>
            <Button type="submit" className="cursor-pointer" disabled={running || !url.trim()}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching…
                </>
              ) : (
                "Find best match"
              )}
            </Button>
          </form>

          {coaches.length === 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <p className="text-xs font-medium">{s.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          )}

          {coaches.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" /> Mentors
              </p>
              {coaches.map((c) => {
                const li = safeSrc(c.linkedin_url ?? undefined);
                return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-all"
                >

                  {li ? (
                    <a href={li} target="_blank" rel="noreferrer" aria-label={`Open ${c.name} on LinkedIn`} onClick={(e) => e.stopPropagation()}>
                      <MentorAvatar src={c.photo_url} name={c.name} size={40} />
                    </a>
                  ) : (
                    <MentorAvatar src={c.photo_url} name={c.name} size={40} />
                  )}
                  <div className="min-w-0 flex-1">
                    {li ? (
                      <a
                        href={li}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate text-sm font-medium transition-colors hover:text-primary"
                      >
                        {c.name}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-medium">{c.name}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {c.headline || c.email || "Mentor"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(c.expertise ?? []).slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {c.matched_startup_id ? (
                    <Badge
                      variant="secondary"
                      className="hidden pointer-events-none text-xs sm:inline-flex"
                    >
                      Matched with {startupName(c.matched_startup_id)}
                    </Badge>
                  ) : null}
                  {c.linkedin_url ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer text-xs"
                      disabled={running}
                      onClick={(e) => {
                        e.stopPropagation();
                        const exclude = c.matched_startup_id ? [c.matched_startup_id] : [];
                        setTried(exclude);
                        setUrl(c.linkedin_url!);
                        match.mutate({ linkedinUrl: c.linkedin_url!, exclude });
                      }}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Match with another startup
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCoach(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                );
              })}
            </div>
          ) : null}

        </CardContent>
      </Card>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Best match found
            </DialogTitle>
          </DialogHeader>
          {result ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <MentorAvatar src={result.mentor.photo_url} name={result.mentor.name} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{result.mentor.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {result.mentor.headline}
                  </p>
                  <a
                    href={result.mentor.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn profile
                  </a>
                </div>
              </div>

              {result.mentor.expertise.length ? (
                <div className="flex flex-wrap gap-1">
                  {result.mentor.expertise.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Best match
                </p>
                <div className="mt-1.5 flex items-center gap-3">
                  {safeSrc(result.startup.logo_url ?? undefined) ? (
                    <img
                      src={safeSrc(result.startup.logo_url ?? undefined)!}
                      alt={result.startup.name}
                      className="h-9 w-9 rounded-lg border border-border/60 object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{result.startup.name}</p>
                    {result.startup.stage ? (
                      <p className="text-xs text-muted-foreground">{result.startup.stage}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <ul className="space-y-2">
                {result.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm">
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              {result.reason ? (
                <p className="text-sm text-muted-foreground">{result.reason}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="cursor-pointer" onClick={() => setResult(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={running || !result}
              onClick={() =>
                result &&
                match.mutate({ linkedinUrl: result.mentor.linkedin_url, exclude: tried })
              }
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rematching…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Show next best match
                </>
              )}
            </Button>
            <Button
              className="cursor-pointer"
              disabled={save.isPending}
              onClick={() => result && save.mutate(result)}
            >
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save & assign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden border border-border bg-background">

          <DialogHeader>
            <DialogTitle className="text-base">
              {details?.matched_startup_id ? `Matched with ${startupName(details.matched_startup_id)}` : "Why this match"}
            </DialogTitle>
          </DialogHeader>
          {details ? (
            <div className="-mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar custom-scrollbar-fade">


              <div className="flex items-center gap-4">
                <MentorAvatar src={details.photo_url} name={details.name} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{details.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {details.headline || details.email || "Mentor"}
                  </p>
                  {details.matched_startup_id ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Matched with {startupName(details.matched_startup_id)}
                    </p>
                  ) : null}
                </div>
              </div>

              {(details.match_points ?? []).length ? (
                <ul className="space-y-2">
                  {(details.match_points ?? []).map((p) => (
                    <li key={p} className="flex gap-2 text-sm">
                      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {details.match_reason ? (
                <p className="text-sm text-muted-foreground">{details.match_reason}</p>
              ) : null}

              {!(details.match_points ?? []).length && !details.match_reason ? (
                <p className="text-sm text-muted-foreground">
                  No saved reasoning for this match yet.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="ghost" className="cursor-pointer" onClick={() => setDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>

  );
}
