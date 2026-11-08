import { createFileRoute, Link } from "@tanstack/react-router";
import { audienceLabel } from "@/lib/engine/avatars";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  Flag,
  Info,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  Play,
  Plus,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { RehearsalScorecard } from "@/components/rehearsal/RehearsalScorecard";
import AITextLoading from "@/design-system/ventura-6bef42/components/ui/ai-text-loading";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Slider } from "@/design-system/ventura-6bef42/components/ui/slider";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { AvatarBadge } from "@/components/review/AvatarBadge";
import { SectionCard } from "@/components/review/SectionCard";
import { Segmented } from "@/components/review/Segmented";
import { useDictation, useSpeaker } from "@/components/rehearsal/useSpeech";
import { buildAiContext } from "@/lib/ai/context";
import { chatErrorMessage, messageText } from "@/lib/ai/chat-errors";
import { DEBRIEF_TRIGGER, type RehearsalConfig } from "@/lib/ai/rehearsal-prompts";
import { averageScores, splitPersonaTurn, type CoachFeedback } from "@/lib/ai/rehearsal-parse";
import { orderedKpis } from "@/lib/ui/kpis";

export const Route = createFileRoute("/account/$account/rehearsal")({
  head: () => ({
    meta: [
      { title: "Boardroom rehearsal - Lindström customer value review" },
      { name: "description", content: "Practise the annual review against an AI stakeholder who challenges your numbers, with live credibility coaching." },
      { property: "og:title", content: "Boardroom rehearsal - Lindström customer value review" },
      { property: "og:description", content: "Practise the review against an AI stakeholder with live credibility coaching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RehearsalPage,
});

const START_TEXT = "[[START]] Please open the meeting.";
const MEETINGS = ["Annual value review", "Steering committee", "Contract renewal"] as const;
const TOUGHNESS = ["", "Friendly", "Curious", "Probing", "Sceptical", "Tough"];

function RehearsalPage() {
  const a = useAccount();
  const [personaId, setPersonaId] = useState(a.avatar.id);
  const persona = a.avatars.find((x) => x.id === personaId) ?? a.avatar;
  const [meeting, setMeeting] = useState<(typeof MEETINGS)[number]>("Annual value review");
  const [toughness, setToughness] = useState(persona.skepticism);
  const [started, setStarted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [input, setInput] = useState("");
  const [factsOpen, setFactsOpen] = useState(true);
  const speaker = useSpeaker();
  const dictation = useDictation((t, final) => {
    setInput(t);
    if (final && t.trim()) inputRef.current?.focus();
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setToughness(persona.skepticism), [persona.skepticism]);

  const config: RehearsalConfig = useMemo(
    () => ({
      avatarName: audienceLabel(persona),
      role: persona.role,
      skepticism: toughness,
      concerns: persona.concerns,
      meeting,
      customerName: a.customer.name,
    }),
    [persona, toughness, meeting, a.customer.name],
  );
  const ref = useRef({ context: buildAiContext(a), config });
  ref.current = { context: buildAiContext(a), config };

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/assistant", body: () => ({ mode: "rehearsal", context: ref.current.context, rehearsal: ref.current.config }) }),
    [],
  );
  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: `rehearsal-${a.customer.id}`,
    transport,
    onError: (e) => toast.error(chatErrorMessage(e)),
  });
  const busy = status === "submitted" || status === "streaming";

  // Pair each persona turn with the KAM answer it evaluates.
  const turns = useMemo(() => {
    const out: Array<{ id: string; role: "persona" | "kam" | "debrief"; text: string; coach: CoachFeedback | null; coachPending: boolean }> = [];
    let afterDebrief = false;
    for (const m of messages as UIMessage[]) {
      const text = messageText(m.parts as never);
      if (m.role === "user") {
        if (text === START_TEXT) continue;
        if (text === DEBRIEF_TRIGGER) {
          afterDebrief = true;
          continue;
        }
        out.push({ id: m.id, role: "kam", text, coach: null, coachPending: false });
      } else if (m.role === "assistant") {
        if (afterDebrief) {
          out.push({ id: m.id, role: "debrief", text, coach: null, coachPending: false });
          continue;
        }
        const { spoken, coach, coachPending } = splitPersonaTurn(text);
        const prevKam = [...out].reverse().find((t) => t.role === "kam");
        if (prevKam && !prevKam.coach) {
          prevKam.coach = coach;
          prevKam.coachPending = coachPending || (status === "streaming" && !coach && m.id === messages[messages.length - 1]?.id);
        }
        out.push({ id: m.id, role: "persona", text: spoken, coach: null, coachPending: false });
      }
    }
    return out;
  }, [messages, status]);

  const scored = turns.filter((t) => t.role === "kam").map((t) => t.coach);
  const avg = averageScores(scored);
  const latestCoach = [...scored].reverse().find((c) => c && c.credibility != null) ?? null;
  const debrief = turns.find((t) => t.role === "debrief");
  const answered = turns.filter((t) => t.role === "kam").length;

  // Speak each completed persona line.
  const spokenIds = useRef(new Set<string>());
  useEffect(() => {
    if (!voiceOn || status !== "ready") return;
    const last = [...turns].reverse().find((t) => t.role === "persona");
    if (last && !spokenIds.current.has(last.id) && last.text) {
      spokenIds.current.add(last.id);
      void speaker.speak(last.text);
    }
  }, [turns, status, voiceOn, speaker, toughness]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, status]);

  const start = () => {
    setMessages([]);
    spokenIds.current.clear();
    setStarted(true);
    void sendMessage({ text: START_TEXT });
  };
  const reset = () => {
    void stop();
    speaker.stop();
    setMessages([]);
    setStarted(false);
    setInput("");
  };
  const queuedRef = useRef<string | null>(null);
  const submit = () => {
    const t = input.trim();
    if (!t) return;
    if (dictation.listening) dictation.stop();
    speaker.stop();
    setInput("");
    // If the persona is still answering, queue the answer and send it the moment it finishes.
    if (busy) {
      queuedRef.current = t;
      return;
    }
    void sendMessage({ text: t });
  };
  useEffect(() => {
    if (busy || !queuedRef.current) return;
    const t = queuedRef.current;
    queuedRef.current = null;
    void sendMessage({ text: t });
  }, [busy, sendMessage]);
  const facts = orderedKpis(a)
    .slice(0, 8)
    .map((k) => {
      const v = k.compute(a);
      const range = v.range ? ` (range ${v.range.low}–${v.range.high})` : "";
      return { id: k.id, label: k.label, text: `${k.label}: ${v.value}${v.unit ? ` ${v.unit}` : ""}${range}` };
    });

  if (!started) {
    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-lind-pink/10 via-transparent to-lind-purple/10" />
          <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-lind-pink">Boardroom rehearsal</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight md:text-4xl">Practise the meeting before it happens.</h1>
              
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Flag className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> Catches invented numbers and missing baselines before the customer does.
                </li>
                <li className="flex gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-lind-orange" /> Ends with a debrief: what landed, weak spots, evidence to bring.
                </li>
                <li className="flex gap-2">
                  <Mic className="mt-0.5 h-4 w-4 shrink-0 text-lind-blue" /> Answer by voice and hear the stakeholder speak, where the browser supports it.
                </li>
              </ul>
            </div>
            <div className="space-y-5 rounded-2xl border border-border/60 bg-background/80 p-5 backdrop-blur-sm">
              <div className="space-y-2">
                <Label>Who is across the table?</Label>
                {a.avatars.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    No avatars for {a.customer.name} yet - you will rehearse with a neutral reviewer.{" "}
                    <Link to="/account/$account/stakeholders" params={{ account: a.slug }} className="font-medium text-primary hover:underline">
                      Add a new avatar
                    </Link>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {a.avatars.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setPersonaId(av.id)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-left transition-colors",
                        av.id === persona.id ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-muted/40",
                      )}
                    >
                      <AvatarBadge avatar={av} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{audienceLabel(av)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{av.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Label className="block">Meeting</Label>
                <Segmented label="Meeting type" value={meeting} onChange={setMeeting} options={MEETINGS.map((m) => ({ value: m, label: m }))} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Toughness</Label>
                  <span className="text-xs font-medium text-muted-foreground">{TOUGHNESS[toughness]}</span>
                </div>
                <Slider value={[toughness]} min={1} max={5} step={1} onValueChange={([v]) => setToughness(v)} aria-label="Toughness" />
              </div>
              <Button className="w-full gap-2" size="lg" onClick={start}>
                <Play className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">Start rehearsal with {persona.role}</span>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <motion.div animate={speaker.speaking ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.9, repeat: speaker.speaking ? Infinity : 0 }}>
            <AvatarBadge avatar={persona} size="md" />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {persona.role} · {a.customer.name}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="info" size="icon-sm" aria-label="Meeting details">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end">
              <p className="text-sm leading-relaxed">{meeting} · {TOUGHNESS[toughness].toLowerCase()} · {answered} answer{answered === 1 ? "" : "s"}</p>
            </PopoverContent>
          </Popover>
          {speaker.supported && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (voiceOn) {
                  speaker.stop();
                  setVoiceOn(false);
                  return;
                }
                // Start playback in the click gesture, and replay the current
                // line even if it was already spoken before muting.
                const last = [...turns].reverse().find((t) => t.role === "persona" && t.text);
                if (last && status === "ready") {
                  spokenIds.current.add(last.id);
                  void speaker.speak(last.text);
                }
                setVoiceOn(true);
              }}
              aria-label={voiceOn ? "Mute stakeholder voice" : "Hear the stakeholder"}
              title={speaker.loading ? "Loading ElevenLabs voice" : voiceOn ? "Mute stakeholder voice" : "Hear the stakeholder"}
              aria-busy={speaker.loading}
            >
              {speaker.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 scrollbar-stylish">
          {turns.map((t) =>
            t.role === "persona" ? (
              t.text ? (
                <div key={t.id} className="flex gap-3">
                  <AvatarBadge avatar={persona} size="sm" className="mt-1" />
                  <div className="min-w-0 flex-1 break-words rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3 text-sm leading-relaxed"><ChatMarkdown>{t.text}</ChatMarkdown></div>
                </div>
              ) : null
            ) : t.role === "kam" ? (
              <div key={t.id} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{t.text}</div>
                </div>
                <CoachNote coach={t.coach} pending={t.coachPending} />
              </div>
            ) : (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-lind-green/30 bg-lind-green/5 p-5"
              >
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-lind-green">
                  <BookOpenCheck className="h-4 w-4" /> Debrief
                </p>
                <ChatMarkdown>{t.text}</ChatMarkdown>
              </motion.div>
            ),
          )}
          {busy && (!turns.length || turns[turns.length - 1].role === "kam" || !turns[turns.length - 1].text) && (
            <AITextLoading className="justify-start" texts={[`${persona.role} is thinking…`, "Checking your numbers…", "Preparing a follow-up…"]} />
          )}
          <div ref={bottomRef} />
        </div>

        {!debrief ? (
          <div className="border-t p-3">
            <div className="overflow-hidden rounded-xl ring-1 ring-primary focus-within:ring-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder={dictation.listening ? "Listening…" : "Answer as you would in the meeting…"}
                className="resize-none border-none shadow-none focus-visible:ring-0"
              />
              <div className="flex items-center gap-2 px-2 pb-2">
                {dictation.supported && (
                  <Button
                    variant={dictation.listening ? "destructive" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                    aria-label={dictation.listening ? "Stop dictation" : "Answer by voice"}
                  >
                    {dictation.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
                <Button size="icon" className="ml-auto" onClick={submit} disabled={!input.trim()} aria-label="Send answer">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 border-t p-3">
            <Button variant="outline" onClick={reset} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> New rehearsal
            </Button>
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <SectionCard icon={BookOpenCheck} title="Your scorecard" tone="emerald" subtitle={avg.credibility == null ? "Scores appear after your first answer" : "Average over your answers"}>
          <RehearsalScorecard credibility={avg.credibility ?? 0} clarity={avg.clarity ?? 0} customerFocus={avg.customerFocus ?? 0} />
          {latestCoach?.overclaim && (
            <div className="mt-3 flex gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <ChatMarkdown className="min-w-0 break-words">{latestCoach.overclaim}</ChatMarkdown>
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={Lightbulb}
          title="Evidence at hand"
          tone="amber"
          subtitle="Click to drop a figure into your answer"
          action={
            <button type="button" onClick={() => setFactsOpen(!factsOpen)} className="cursor-pointer text-muted-foreground" aria-label="Toggle evidence">
              <ChevronDown className={cn("h-4 w-4 transition-transform", !factsOpen && "-rotate-90")} />
            </button>
          }
        >
          {factsOpen && (
            <ul className="space-y-1.5">
              {facts.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setInput((v) => (v ? `${v.trimEnd()} ${f.text}.` : `${f.text}.`));
                      inputRef.current?.focus();
                    }}
                    className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                  >
                    <Plus className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span>{f.text}</span>
                  </button>
                </li>
              ))}
              <li className="px-2 pt-1 text-[11px] text-muted-foreground">Compared with {a.baseline.name.toLowerCase()} · uploaded data</li>
            </ul>
          )}
        </SectionCard>
      </aside>
    </div>
  );
}

function CoachNote({ coach, pending }: { coach: CoachFeedback | null; pending: boolean }) {
  const [open, setOpen] = useState(false);
  if (!coach) {
    return pending ? (
      <p className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Coach is scoring…
      </p>
    ) : null;
  }
  const score = coach.credibility;
  const tone = score == null ? "text-muted-foreground" : score >= 75 ? "text-lind-green" : score >= 50 ? "text-lind-orange" : "text-destructive";
  return (
    <div className="ml-auto max-w-[85%] rounded-xl border border-dashed border-border bg-background p-2.5 text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center gap-2 text-left">
        <span className={cn("font-bold tabular-nums", tone)}>{score ?? "-"}</span>
        <span className="text-muted-foreground">credibility</span>
        {coach.overclaim && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" /> overclaim
          </span>
        )}
        {coach.evidenceUsed.slice(0, 2).map((e) => (
          <span key={e} className="hidden truncate rounded-full bg-lind-green/10 px-1.5 py-0.5 text-[10px] text-lind-green sm:inline dark:text-lind-green">
            {e}
          </span>
        ))}
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-t pt-2">
          {coach.overclaim && <ChatMarkdown className="break-words text-destructive">{coach.overclaim}</ChatMarkdown>}
          {coach.betterAnswer && (
            <div>
              <p className="font-semibold">Stronger answer:</p>
              <ChatMarkdown className="break-words">{coach.betterAnswer}</ChatMarkdown>
            </div>
          )}
          <p className="text-muted-foreground">
            Clarity {coach.clarity ?? "-"} · customer focus {coach.customerFocus ?? "-"}
          </p>
        </div>
      )}
    </div>
  );
}
