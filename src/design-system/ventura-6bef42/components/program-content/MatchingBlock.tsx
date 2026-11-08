import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Handshake, Users } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { InfoHint } from "@/design-system/ventura-6bef42/components/program-content/InfoHint";
import { FounderAiChat } from "@/design-system/ventura-6bef42/components/program-content/FounderAiChat";
import {
  Podium,
  PodiumSkeleton,
  type MatchKind,
  type MatchPerson,
} from "@/design-system/ventura-6bef42/components/program-content/MatchPodium";
import { getStartupMatchBoard, requestConnectionIntro } from "@/design-system/ventura-6bef42/lib/founder-match.functions";

export type { MatchPerson };

export function MatchingBlock({
  startupId,
  programId,
  startupName,
}: {
  startupId: string;
  programId: string;
  startupName: string;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getStartupMatchBoard);
  const askIntro = useServerFn(requestConnectionIntro);

  const { data, isLoading } = useQuery({
    queryKey: ["startup-match-board", startupId, programId],
    queryFn: () => load({ data: { startupId, programId } }),
  });

  const [chatMode, setChatMode] = useState<MatchKind | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [gate, setGate] = useState(false);
  const [askingId, setAskingId] = useState<string | null>(null);

  const refreshMatches = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["startup-match-board", startupId, programId] });
  }, [qc, startupId, programId]);

  const startMatching = (kind: MatchKind) => {
    if (!data?.postedThisWeek) {
      setGate(true);
      return;
    }
    setChatMode(kind);
    setPrompt(
      kind === "mentor"
        ? "I have a new problem and need a mentor. Start the matching conversation."
        : "Find three real investors who are the best match for us. Start the matching conversation.",
    );
    setNonce((n) => n + 1);
    setChatOpen(true);
  };

  const onAsk = async (person: MatchPerson) => {
    setAskingId(person.id);
    try {
      await askIntro({ data: { startupId, programId, suggestionId: person.id } });
      toast.success("Your program lead has been asked to connect you");
      await qc.invalidateQueries({ queryKey: ["startup-match-board", startupId, programId] });
    } catch {
      toast.error("Could not send the request");
    } finally {
      setAskingId(null);
    }
  };

  const half = (kind: MatchKind) => {
    const people = ((kind === "mentor" ? data?.mentor : data?.investor) ?? []) as MatchPerson[];
    const Icon = kind === "mentor" ? Users : Handshake;
    return (
      <div className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {kind === "mentor" ? "Mentors" : "Investors"}
          </p>
        </div>
        {isLoading ? (
          <PodiumSkeleton kind={kind} />
        ) : people.length ? (
          <Podium people={people} onAsk={onAsk} askingId={askingId} kind={kind} />
        ) : (
          <PodiumSkeleton kind={kind} />
        )}
        <Button
          variant="outline"
          className="h-auto min-h-10 w-full cursor-pointer whitespace-normal break-words px-3 py-2 text-xs sm:text-sm border-border/60 bg-gradient-to-r from-muted/40 to-transparent transition-all hover:border-primary/40 hover:from-primary/10"
          onClick={() => startMatching(kind)}
        >
          {kind === "mentor"
            ? "I got a new problem / need a new mentor"
            : "Find matching investors"}
        </Button>
      </div>
    );
  };

  return (
    <Card className="h-full overflow-hidden border-border/60 bg-gradient-to-b from-card to-muted/20 shadow-sm">
      <CardHeader className="min-h-[68px] justify-center pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Investor &amp; Mentor matching</CardTitle>
          <InfoHint text="Tell Ventura what you are stuck on or what you want to raise. It reads your profile, goals and weekly updates, asks a few sharp questions, then names the three people worth talking to — your program's own network first, then the best local matches outside it." />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {half("mentor")}
        {half("investor")}
      </CardContent>

      <Dialog open={gate} onOpenChange={setGate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this week's update first</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Matching uses your latest progress. Publish the weekly update for {startupName} to
            unlock mentor and investor matching for this week.
          </p>
          <DialogFooter>
            <Button className="cursor-pointer" onClick={() => setGate(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FounderAiChat
        startupId={startupId}
        programId={programId}
        startupName={startupName}
        open={chatOpen}
        mode={chatMode}
        onOpenChange={(v) => {
          setChatOpen(v);
          if (!v) {
            setPrompt(null);
            setChatMode(null);
            void qc.invalidateQueries({ queryKey: ["startup-match-board", startupId, programId] });
          }
        }}
        initialPrompt={prompt}
        promptNonce={nonce}
        onMatchesSaved={refreshMatches}
      />
    </Card>
  );
}
