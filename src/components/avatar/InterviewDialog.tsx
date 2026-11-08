import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Circle, Globe2, Loader2, Plus, RotateCcw, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import AITextLoading from "@/design-system/ventura-6bef42/components/ui/ai-text-loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { ScrollArea } from "@/design-system/ventura-6bef42/components/ui/scroll-area";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/design-system/ventura-6bef42/components/ai-elements/prompt-input";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import orbLogoAsset from "@/design-system/ventura-6bef42/assets/ventura-orb-logo.png.asset.json";
import { runInterviewTurn } from "@/lib/avatar/interview.functions";
import { EMPTY_DRAFT, MAX_INTERVIEW_QUESTIONS, REQUIRED_PARAMS, missingParams, shouldAutoSave, type InterviewDraft, type InterviewMessage, type RequiredParam } from "@/lib/avatar/interview-types";
import { draftToAvatar, interviewCompanies, researchCountry } from "@/lib/avatar/build";
import { ROLE_ARCHETYPES, type Avatar } from "@/lib/engine/avatars";
import { rankPriorities } from "@/lib/engine/priorities";
import { briefItems, briefSources } from "@/lib/regulation/types";
import { useDataset } from "@/lib/state/dataset-store";
import { usePreferences } from "@/lib/state/preferences-store";
import { AvatarBadge } from "@/components/review/AvatarBadge";
import { PriorityChips } from "@/components/review/PriorityChips";
import { AvatarCard } from "./AvatarCard";
import { ResearchProgress } from "./ResearchProgress";
import { useResearch } from "./useResearch";

type Phase = "interview" | "research" | "saved";

const ROLE_SUGGESTIONS = ["CFO", "Head of Sustainability", "Operations director", "Quality & hygiene lead", "Procurement manager", "Managing director"];

const INTRO =
  "Hi! I'll build a stakeholder avatar so the dashboard, insights and exported review speak this person's language. I only ask what I can't look up - **country rules, carbon prices, tax incentives and public company targets I research on the web myself** afterwards.";

function paramValue(d: InterviewDraft, k: RequiredParam, companyName: (id: string | null) => string | null): string | null {
  switch (k) {
    case "company":
      return companyName(d.customerId);
    case "role":
      return d.role ? `${d.role}${d.personName ? ` · ${d.personName}` : ""}` : null;
    case "location":
      return d.country === "ALL" ? "All countries" : d.country;
    case "decisions":
      return d.decisions.length ? d.decisions.join(", ") : null;
    case "goals":
      return d.goals.length ? d.goals.join(", ") : null;
  }
}

/**
 * "Add a new avatar": an AI interview that asks only what cannot be looked up,
 * then researches the person's country rules on the web and saves the avatar.
 */
export function InterviewDialog({
  open,
  onOpenChange,
  presetCustomerId,
  researchAvatar,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetCustomerId?: string | null;
  /** Re-run the research for an existing avatar instead of interviewing. */
  researchAvatar?: Avatar | null;
  onSaved?: (a: Avatar) => void;
}) {
  const { dataset } = useDataset();
  const prefs = usePreferences();
  const interview = useServerFn(runInterviewTurn);
  const research = useResearch();
  const companies = useMemo(() => (dataset ? interviewCompanies(dataset) : []), [dataset]);
  const companyName = useCallback((id: string | null) => companies.find((c) => c.id === id)?.name ?? null, [companies]);

  const [phase, setPhase] = useState<Phase>("interview");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [quick, setQuick] = useState<string[]>([]);
  const [draft, setDraft] = useState<InterviewDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState<Avatar | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);

  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const handedOff = useRef(false);

  /** Saves the avatar, researches its country rules, then hands it to the report step. */
  const startResearch = useCallback(
    async (avatar: Avatar, only?: Parameters<typeof research.run>[2]) => {
      if (!dataset) return;
      handedOff.current = false;
      setSaved(avatar);
      setPhase("research");
      prefs.upsertAvatar(avatar);
      let result = avatar;
      try {
        const brief = await research.run(avatar, dataset, only);
        if (brief) {
          result = { ...avatar, brief };
          prefs.upsertAvatar(result);
          setSaved(result);
          const failed = brief.topics.filter((t) => t.status === "failed").length;
          if (failed) toast.warning(`${failed} research topic${failed === 1 ? "" : "s"} could not be completed`, { description: "You can retry them from the avatar." });
          else toast.success(`${result.name} is ready`, { description: `${briefItems(brief).length} country rules found for ${brief.country}` });
        }
      } catch (e) {
        console.error(e);
        toast.error("Research stopped unexpectedly. The avatar is saved - you can retry the research.");
      }
      setPhase("saved");
      if (!handedOff.current) {
        handedOff.current = true;
        onSavedRef.current?.(result);
        onOpenChangeRef.current(false);
      }
    },
    [dataset, prefs, research],
  );

  // Fresh state each time the dialog opens.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setError(null);
      setInput("");
      if (researchAvatar) {
        setMessages([]);
        void startResearch(researchAvatar);
      } else if (!research.running) {
        research.reset();
        setPicked([]);
        setCustom([]);
        setAdding(false);
        const preset = presetCustomerId ? companies.find((c) => c.id === presetCustomerId) : companies.length === 1 ? companies[0] : null;
        const d: InterviewDraft = { ...EMPTY_DRAFT, customerId: preset?.id ?? null, country: preset && preset.countries.length === 1 ? preset.countries[0].name : null };
        setDraft(d);
        setSaved(null);
        setPhase("interview");
        if (preset) {
          setMessages([{ role: "assistant", text: `${INTRO}\n\nThis avatar is for **${preset.name}**. What is the person's **role**? Add their name too, if you want it on the report.` }]);
          setQuick(ROLE_SUGGESTIONS);
        } else {
          setMessages([{ role: "assistant", text: `${INTRO}\n\nFirst: **which company is this person at?**` }]);
          setQuick(companies.map((c) => c.name).slice(0, 6));
        }
      }
    }
    wasOpen.current = open;
  }, [open, researchAvatar, presetCustomerId, companies, research, startResearch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy, error]);

  const answered = messages.filter((m) => m.role === "user").length;
  const options = [...quick, ...custom.filter((c) => !quick.some((q) => q.toLowerCase() === c.toLowerCase()))];

  const togglePick = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  const addCustom = () => {
    const v = addText.trim().slice(0, 60);
    if (v) {
      setCustom((c) => (c.includes(v) ? c : [...c, v]));
      setPicked((p) => (p.includes(v) ? p : [...p, v]));
    }
    setAddText("");
    setAdding(false);
  };

  /** Combines the selected options with anything typed in the answer box. */
  const send = (text: string) => {
    const parts = [...picked, text.trim()].filter(Boolean);
    return sendFrom(messages, parts.join("; "));
  };

  /** Sends `text` after the given history (retry passes the history without the failed turn). */
  const sendFrom = async (history: InterviewMessage[], text: string) => {
    const t = text.trim();
    if (!t || busy || !dataset) return;
    const next: InterviewMessage[] = [...history, { role: "user", text: t }];
    setMessages(next);
    setInput("");
    setQuick([]);
    setPicked([]);
    setCustom([]);
    setAdding(false);
    setError(null);
    setBusy(true);
    try {
      const res = await interview({ data: { messages: next, companies, draft, today: new Date().toISOString().slice(0, 10) } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(res.draft);
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      const userAnswers = next.filter((m) => m.role === "user").length;
      if (shouldAutoSave(res.draft, userAnswers)) {
        setQuick([]);
        void startResearch(draftToAvatar(res.draft));
        return;
      }
      setQuick(res.quickReplies);
    } catch (e) {
      console.error(e);
      setError("The interviewer could not be reached. Check your connection and try again.");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const retry = () => {
    const idx = messages.map((m) => m.role).lastIndexOf("user");
    if (idx < 0) return;
    void sendFrom(messages.slice(0, idx), messages[idx].text);
  };

  const missing = missingParams(draft);
  const ready = missing.length === 0;
  const country = saved && dataset ? researchCountry(saved, dataset) : draft.country && draft.country !== "ALL" ? draft.country : (companies.find((c) => c.id === draft.customerId)?.hqCountry ?? "");
  const weights = draft.weights ?? ROLE_ARCHETYPES[draft.archetype ?? "kam-balanced"].weights;

  const finish = () => {
    if (saved) onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">{researchAvatar ? "Research country rules" : "Add a new avatar"}</DialogTitle>
        <DialogDescription className="sr-only">An AI interview that builds a stakeholder avatar and researches the rules of their country.</DialogDescription>
        <div className="flex h-[84vh] max-h-[760px]">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b px-5 py-3">
              <img src={orbLogoAsset.url} alt="" className="program-ai-logo h-5 w-5 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{researchAvatar ? `Country research · ${researchAvatar.name}` : "New avatar interview"}</p>
                {!researchAvatar && phase === "interview" && (
                  <p className="text-xs text-muted-foreground">
                    Question {Math.min(answered + 1, MAX_INTERVIEW_QUESTIONS)} of up to {MAX_INTERVIEW_QUESTIONS}
                  </p>
                )}
              </div>
              <ol className="ml-auto mr-8 hidden items-center gap-1 text-[11px] font-semibold uppercase tracking-wider sm:flex" aria-label="Progress">
                {(["interview", "research", "saved"] as Phase[]).map((p, i) => {
                  const order = { interview: 0, research: 1, saved: 2 }[phase];
                  return (
                    <li key={p} className="flex items-center gap-1">
                      {i > 0 && <span className="h-px w-4 bg-border" />}
                      <span className={cn("rounded-full px-2 py-0.5", i === order ? "bg-primary text-primary-foreground" : i < order ? "bg-muted text-foreground" : "text-muted-foreground")}>
                        {["Interview", "Research", "Saved"][i]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </header>

            {phase === "interview" ? (
              <>
                <ScrollArea className="flex-1 px-5 py-4 scrollbar-stylish">
                  <div className="space-y-4">
                    {messages.map((m, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                        {m.role === "user" ? (
                          <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{m.text}</div>
                        ) : (
                          <div className="flex max-w-[92%] gap-2.5">
                            <img src={orbLogoAsset.url} alt="" className="program-ai-logo mt-0.5 h-6 w-6 shrink-0 object-contain" />
                            <div className="min-w-0">
                              <ChatMarkdown>{m.text}</ChatMarkdown>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {busy && <AITextLoading className="justify-start pl-8" texts={["Reading your answer…", "Updating the avatar…", "Choosing the next question…"]} />}
                    {error && (
                      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {error}
                        <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={retry}>
                          <RotateCcw className="h-3.5 w-3.5" /> Try again
                        </Button>
                      </div>
                    )}
                    {!busy && !error && answered < MAX_INTERVIEW_QUESTIONS && messages.length > 0 && (
                      <div className="space-y-2 pl-8">
                        <p className="text-xs text-muted-foreground">Select one or more, or add your own</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Answer options">
                          <AnimatePresence>
                            {options.map((q, i) => {
                              const on = picked.includes(q);
                              return (
                                <motion.button
                                  key={q}
                                  type="button"
                                  aria-pressed={on}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.04 }}
                                  onClick={() => togglePick(q)}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40 hover:bg-accent",
                                  )}
                                >
                                  {on && <Check className="h-3.5 w-3.5" />}
                                  {q}
                                </motion.button>
                              );
                            })}
                          </AnimatePresence>
                          {adding ? (
                            <form
                              className="flex items-center gap-1 rounded-full border border-primary/60 bg-background py-0.5 pl-3 pr-0.5"
                              onSubmit={(e) => {
                                e.preventDefault();
                                addCustom();
                              }}
                            >
                              <input
                                autoFocus
                                value={addText}
                                onChange={(e) => setAddText(e.target.value)}
                                onBlur={addCustom}
                                onKeyDown={(e) => e.key === "Escape" && (setAddText(""), setAdding(false))}
                                maxLength={60}
                                placeholder="New option…"
                                aria-label="New option"
                                className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                              />
                              <Button type="submit" size="sm" variant="ghost" aria-label="Add option">
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAdding(true)}
                              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-primary/50 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-accent"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add new option
                            </button>
                          )}
                        </div>
                        {picked.length > 0 && (
                          <Button size="sm" className="gap-1.5" onClick={() => void send(input)}>
                            Continue with {picked.length} selected <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>
                <div className="border-t p-3">
                  <div className="mb-2 flex items-center gap-2 md:hidden">
                    <span className="text-xs text-muted-foreground">
                      {REQUIRED_PARAMS.length - missing.length}/{REQUIRED_PARAMS.length} captured
                    </span>
                    <Button size="sm" className="ml-auto gap-1.5" disabled={!draft.customerId || busy} onClick={() => void startResearch(draftToAvatar(draft))}>
                      <Globe2 className="h-3.5 w-3.5" /> Save & create report
                    </Button>
                  </div>
                  <PromptInput onSubmit={() => void send(input)} className="overflow-hidden rounded-xl ring-1 ring-primary focus-within:ring-2 focus-within:ring-primary">
                    <PromptInputTextarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      rows={1}
                      maxLength={2000}
                      placeholder="Type your answer…"
                      className="min-h-12 max-h-32 px-4 pb-2 pt-3 leading-6 scrollbar-stylish"
                      aria-label="Your answer"
                    />
                    <PromptInputFooter className="justify-end gap-2 px-2 pb-2 pt-0">
                      <PromptInputSubmit status={busy ? "submitted" : "ready"} disabled={busy || (!input.trim() && picked.length === 0)} className="h-9 w-9 shrink-0 rounded-lg" aria-label="Send answer">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -translate-x-0.5" />}
                      </PromptInputSubmit>
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </>
            ) : (
              <ScrollArea className="flex-1 px-5 py-5 scrollbar-stylish">
                <div className="mx-auto max-w-2xl space-y-5">
                  {phase === "saved" && saved && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lind-green/30 bg-lind-green/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Check className="h-4 w-4 text-lind-green" /> {saved.name} is saved
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {briefItems(saved.brief).length} rules and {briefSources(saved.brief).length} sources for {country} now shape what this avatar sees first.
                      </p>
                    </motion.div>
                  )}
                  <ResearchProgress progress={research.progress} country={country} running={research.running} />
                </div>
              </ScrollArea>
            )}

            {phase !== "interview" && (
              <footer className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                {phase === "research" ? (
                  <>
                    <p className="text-xs text-muted-foreground">The avatar is already saved. You can close this window - research keeps running.</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        handedOff.current = true;
                        if (saved) onSaved?.(saved);
                        onOpenChange(false);
                      }}
                    >
                      Continue in background
                    </Button>
                  </>
                ) : (
                  <>
                    {saved?.brief?.topics.some((t) => t.status === "failed") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => saved && void startResearch(saved, saved.brief!.topics.filter((t) => t.status === "failed").map((t) => t.topic))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry failed topics
                      </Button>
                    )}
                    <Button className="ml-auto gap-1.5" onClick={finish}>
                      Use {saved?.name ?? "avatar"} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </footer>
            )}
          </div>

          <aside className="hidden w-80 shrink-0 flex-col border-l bg-muted/30 md:flex">
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-stylish">
              <div className="space-y-4 p-4">
                {phase === "interview" ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avatar being built</p>
                    <div className="flex items-center gap-3 rounded-xl bg-background p-3 shadow-sm">
                      <AvatarBadge avatar={{}} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{draft.personName || draft.role || "New stakeholder"}</p>
                        <p className="truncate text-xs text-muted-foreground">{[draft.personName ? draft.role : null, companyName(draft.customerId)].filter(Boolean).join(" · ") || "Answer the questions on the left"}</p>
                      </div>
                    </div>
                    <ul className="space-y-2" aria-label="Required answers">
                      {REQUIRED_PARAMS.map((p) => {
                        const v = paramValue(draft, p.key, companyName);
                        return (
                          <li key={p.key} className="flex gap-2 text-sm">
                            {v ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-lind-green" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />}
                            <span className="min-w-0">
                              <span className={cn("block text-xs font-semibold", v ? "text-foreground" : "text-muted-foreground")}>{p.label}</span>
                              {v && <span className="line-clamp-2 block text-xs text-muted-foreground">{v}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {(draft.reporting.length > 0 || draft.moments.length > 0 || draft.avoid.length > 0) && (
                      <dl className="space-y-1.5 border-t pt-3 text-xs">
                        {draft.reporting.length > 0 && (
                          <div>
                            <dt className="font-semibold">Reporting duties</dt>
                            <dd className="text-muted-foreground">{draft.reporting.join(", ")}</dd>
                          </div>
                        )}
                        {draft.moments.length > 0 && (
                          <div>
                            <dt className="font-semibold">Upcoming</dt>
                            <dd className="text-muted-foreground">{draft.moments.join(", ")}</dd>
                          </div>
                        )}
                        {draft.avoid.length > 0 && (
                          <div>
                            <dt className="font-semibold">Avoid</dt>
                            <dd className="text-muted-foreground">{draft.avoid.join(", ")}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    {draft.weights && (
                      <div className="border-t pt-3">
                        <p className="mb-1.5 text-xs font-semibold">What they value most</p>
                        <PriorityChips ranked={rankPriorities(weights)} weights={weights} max={4} />
                      </div>
                    )}
                    {draft.lookups.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                          <Globe2 className="h-3.5 w-3.5 text-primary" /> I'll look up on the web
                        </p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {draft.lookups.map((l) => (
                            <li key={l} className="flex gap-1.5">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> {l}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  saved && <AvatarCard avatar={saved} companyName={companyName(saved.customerId ?? null) ?? undefined} />
                )}
              </div>
            </div>
            {phase === "interview" && (
              <div className="space-y-2 border-t p-4">
                <Button className="w-full gap-1.5" disabled={!draft.customerId || busy} onClick={() => void startResearch(draftToAvatar(draft))}>
                  <Globe2 className="h-4 w-4" /> Save & create report
                </Button>
                <p className="text-center text-[11px] leading-snug text-muted-foreground">
                  {ready
                    ? "Everything is captured - saving now."
                    : draft.customerId
                      ? "Saves automatically after the last answer. Unanswered items use role defaults."
                      : "Pick the company first."}
                </p>
              </div>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
