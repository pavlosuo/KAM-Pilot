import { fireCelebrationConfetti } from "@/design-system/ventura-6bef42/lib/celebrate";
"use client";

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { VoiceChat } from "@/design-system/ventura-6bef42/components/ui/ia-siri-chat";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { GlassTextHolder } from "@/design-system/ventura-6bef42/components/ui/glass-text-holder";
import { MessageLoading } from "@/design-system/ventura-6bef42/components/ui/message-loading";
import { LiquidMetalButton } from "@/design-system/ventura-6bef42/components/ui/liquid-metal-button";

import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { AttachFilesButton } from "@/design-system/ventura-6bef42/components/startup-updates/AttachFilesButton";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
// weekly-updates draft creation removed — drafts are only saved via finalize
import { createScribeToken } from "@/design-system/ventura-6bef42/lib/scribe-token.functions";
import { generateUpdateQuestion } from "@/design-system/ventura-6bef42/lib/update-questions.functions";
import { speakText } from "@/design-system/ventura-6bef42/lib/tts.functions";
import TypewriterTitle from "@/design-system/ventura-6bef42/components/ui/typewriter-title";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

import { finalizeWeeklyUpdate } from "@/design-system/ventura-6bef42/lib/finalize-update.functions";
import {
  publishWeeklyUpdate,
  getCurrentWeekState,
  saveWeeklyUpdateDraft,
} from "@/design-system/ventura-6bef42/lib/weekly-updates.functions";
import { finalizeWeeklyGoals } from "@/design-system/ventura-6bef42/lib/weekly-goals.functions";
import { generateProgressionCards } from "@/design-system/ventura-6bef42/lib/progression-cards.functions";
import { replaceProgressionCards } from "@/design-system/ventura-6bef42/lib/progression-cards-replace.functions";
import { getLatestPublishedCards } from "@/design-system/ventura-6bef42/lib/progression-cards-latest.functions";
import {
  ProgressionCardsGrid,
  type ProgressionCard,
} from "@/design-system/ventura-6bef42/components/startup-updates/ProgressionCards";
import { toast } from "sonner";
import { celebrateAchievements } from "@/design-system/ventura-6bef42/components/startup-updates/AchievementCelebration";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/design-system/ventura-6bef42/components/ui/alert-dialog";

interface Props {
  startupId: string;
  onStageChange?: (stage: "record" | "summary" | "cards-first") => void;
  conversationsReady?: boolean;
  onBack?: () => void;
}

type Phase = "idle" | "recording" | "processing" | "saved";

export function RecorderStage({ startupId, onStageChange, conversationsReady = true, onBack }: Props) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draftId, setDraftId] = useState<string | null>(null);

  const [committedText, setCommittedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [editedTranscript, setEditedTranscript] = useState<string | null>(null);

  const FORCED_QUESTIONS = [
    "This week, what did you build, test, or improve?",
    "What did you learn from customers, users, or the market?",
    "What is your biggest blocker or uncertainty, and what is your next step to solve it?",
  ];
  const [forcedStep, setForcedStep] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [introMerging, setIntroMerging] = useState(false);

  const [recorderKey, setRecorderKey] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stage, setStage] = useState<"record" | "summary">("record");
  const [hasPreviousCards, setHasPreviousCards] = useState(false);
  const [previousCardsChecked, setPreviousCardsChecked] = useState(false);
  const [cardsCompleted, setCardsCompleted] = useState(false);
  const [cards, setCards] = useState<ProgressionCard[]>([]);
  const [attachOpen, setAttachOpen] = useState(true);
  const MAX_CARDS = 6;

  const tokenFn = useServerFn(createScribeToken);
  const questionFn = useServerFn(generateUpdateQuestion);
  const ttsFn = useServerFn(speakText);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenRef = useRef<string>("");

  const speak = async (text: string) => {
    const key = text.trim();
    if (!key || spokenRef.current === key) return;
    spokenRef.current = key;
    try {
      const res = await ttsFn({ data: { text: key } });
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { /* ignore */ }
      }
      const audio = new Audio(`data:${res.mime};base64,${res.audio}`);
      audioRef.current = audio;
      await audio.play().catch(() => { /* autoplay blocked */ });
    } catch {
      // ignore TTS errors
    }
  };

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data: { text: string }) => {
      setPartialText(data.text ?? "");
    },
    onCommittedTranscript: (data: { text: string }) => {
      setCommittedText((prev) => (prev ? prev + " " + data.text : data.text));
      setPartialText("");
    },
  });

  const liveTranscript =
    committedText + (partialText ? (committedText ? " " : "") + partialText : "");
  const displayedTranscript =
    editedTranscript !== null ? editedTranscript : liveTranscript;

  const qc = useQueryClient();
  const finalizeFn = useServerFn(finalizeWeeklyUpdate);
  const cardsFn = useServerFn(generateProgressionCards);
  const replaceCardsFn = useServerFn(replaceProgressionCards);
  const latestCardsFn = useServerFn(getLatestPublishedCards);
  const publishFn = useServerFn(publishWeeklyUpdate);
  const weekStateFn = useServerFn(getCurrentWeekState);
  const saveDraftFn = useServerFn(saveWeeklyUpdateDraft);
  const finalizeGoalsFn = useServerFn(finalizeWeeklyGoals);

  const awardGoalsXp = async (): Promise<string[]> => {
    try {
      const res = await weekStateFn({ data: { startupId } });
      if (res.weekStart) {
        const r = await finalizeGoalsFn({ data: { startupId, weekOf: res.weekStart } });
        if (r.xpAwarded > 0) toast.success(`+${r.xpAwarded} XP from goals!`);
        return r.newBadges ?? [];
      }
    } catch {
      // silent: goals are optional
    }
    return [];
  };

  // Detect consequent updates and prefill cards from latest published update.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await latestCardsFn({ data: { startupId } });
        if (cancelled) return;
        if (res.hasPrevious && res.cards.length > 0) {
          setHasPreviousCards(true);
          setCards(
            res.cards.map((c) => ({
              label: c.label,
              value: c.value ?? "",
              icon_name: c.icon_name,
              image_url: c.image_url ?? null,
              description: c.description ?? null,
            })),
          );
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setPreviousCardsChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupId]);

  const showCardsFirst =
    stage === "record" && conversationsReady && hasPreviousCards && !cardsCompleted;
  const reportedStage: "record" | "summary" | "cards-first" = showCardsFirst
    ? "cards-first"
    : stage;

  // Load current-week draft on mount and prefill the transcript field.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await weekStateFn({ data: { startupId } });
        if (cancelled) return;
        const draft = res.draft as { id: string; transcript: string | null } | null;
        if (draft) {
          setDraftId(draft.id);
          if (draft.transcript) {
            setCommittedText(draft.transcript);
            setEditedTranscript(draft.transcript);
          }
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error
              ? `Couldn't load your draft: ${e.message}`
              : "Couldn't load your draft",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupId]);

  useEffect(() => {
    if (stage === "record" && !previousCardsChecked) return;
    onStageChange?.(reportedStage);
  }, [reportedStage, onStageChange, stage, previousCardsChecked]);

  const saveDraft = useMutation({
    mutationFn: () =>
      saveDraftFn({
        data: { startupId, transcript: displayedTranscript },
      }),
    onSuccess: (res) => {
      setDraftId(res.id);
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["weekly-updates", startupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateCards = useMutation({
    mutationFn: (vars: { updateId: string; summary: string }) =>
      cardsFn({
        data: { startupId, updateId: vars.updateId, summary: vars.summary },
      }),
    onSuccess: (res) => {
      const capped = (res.cards as ProgressionCard[]).slice(0, MAX_CARDS);
      setCards(capped);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishCards = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error("No draft to publish");
      await replaceCardsFn({
        data: {
          startupId,
          updateId: draftId,
          cards: cards.map((c) => ({
            label: c.label,
            value: c.value ?? "",
            icon_name: c.image_url ? null : (c.icon_name ?? "circle"),
            image_url: c.image_url ?? null,
            description: c.description ?? null,
          })),
        },
      });
      const res = await publishFn({ data: { id: draftId } });
      return (res as { newBadges?: string[] } | undefined)?.newBadges ?? [];
    },
    onSuccess: async (publishBadges: string[]) => {
      fireCelebrationConfetti();
      toast.success("Cards published to your startup profile.");
      const goalBadges = await awardGoalsXp();
      celebrateAchievements([...publishBadges, ...goalBadges]);
      qc.invalidateQueries({ queryKey: ["startup-progression-cards", startupId] });
      qc.invalidateQueries({ queryKey: ["weekly-updates", startupId] });
      qc.invalidateQueries({ queryKey: ["weekly-updates"] });
      qc.invalidateQueries({ queryKey: ["weekly-goals", startupId] });
      setStage("record");
      setCards([]);
      setDraftId(null);
      setCommittedText("");
      setPartialText("");
      setEditedTranscript(null);
      setQuestions([]);
      setAnswers([]);
      setCurrentQuestion("");
      setHasStarted(false);
      navigate({ to: "/startups" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalize = useMutation({
    mutationFn: () =>
      finalizeFn({
        data: {
          startupId,
          updateId: draftId,
          transcript: displayedTranscript.trim(),
        },
      }),
    onSuccess: (res) => {
      setDraftId(res.id);
      toast.success("Update finalized and saved.");
      qc.invalidateQueries({ queryKey: ["weekly-updates", startupId] });
      if (hasPreviousCards) {
        // Consequent update: cards were already edited in the cards-first step.
        // Skip AI regeneration and publish directly with the current cards.
        publishCardsForUpdate.mutate({ updateId: res.id });
      } else {
        setStage("summary");
        if (res.id) {
          generateCards.mutate({ updateId: res.id, summary: res.summary });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishCardsForUpdate = useMutation({
    mutationFn: async ({ updateId }: { updateId: string }) => {
      await replaceCardsFn({
        data: {
          startupId,
          updateId,
          cards: cards.map((c) => ({
            label: c.label,
            value: c.value ?? "",
            icon_name: c.image_url ? null : (c.icon_name ?? "circle"),
            image_url: c.image_url ?? null,
            description: c.description ?? null,
          })),
        },
      });
      const res = await publishFn({ data: { id: updateId } });
      return (res as { newBadges?: string[] } | undefined)?.newBadges ?? [];
    },
    onSuccess: async (publishBadges: string[]) => {
      fireCelebrationConfetti();
      toast.success("Update published to your startup profile.");
      const goalBadges = await awardGoalsXp();
      celebrateAchievements([...publishBadges, ...goalBadges]);
      qc.invalidateQueries({ queryKey: ["startup-progression-cards", startupId] });
      qc.invalidateQueries({ queryKey: ["weekly-updates", startupId] });
      qc.invalidateQueries({ queryKey: ["weekly-updates"] });
      qc.invalidateQueries({ queryKey: ["weekly-goals", startupId] });
      navigate({ to: "/startups" });
    },
    onError: (e: Error) => toast.error(e.message),
  });




  const fetchQuestion = async (
    prevQuestions: string[],
    prevAnswers: string[],
  ) => {
    setLoadingQuestion(true);
    try {
      const res = await questionFn({
        data: {
          startupId,
          previousQuestions: prevQuestions,
          previousAnswers: prevAnswers,
        },
      });
      setCurrentQuestion(res.question);
      setQuestions((q) => [...q, res.question]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate question";
      toast.error(msg);
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    return () => {
      try {
        scribe.disconnect();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-voice each question once it's shown.
  useEffect(() => {
    if (!conversationsReady) return;
    if (!previousCardsChecked) return;
    if (showCardsFirst) return;
    const forcedActive = forcedStep < FORCED_QUESTIONS.length;
    if (forcedActive) {
      // The first question is voiced together with the intro typing animation.
      if (!hasStarted && !(forcedStep === 0 && stage === "record" && !introDone)) return;
      speak(FORCED_QUESTIONS[forcedStep]);
    } else if (currentQuestion) {
      speak(currentQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedStep, currentQuestion, conversationsReady, showCardsFirst, previousCardsChecked, hasStarted, introDone, stage]);

  const handleStartQuestions = async () => {
    setHasStarted(true);
    await fetchQuestion([], []);
  };

  const handleStart = async () => {
    if (!hasStarted) {
      setHasStarted(true);
      fetchQuestion([], []);
    }

    setPhase("recording");
    // Preserve any text already shown (previous recording or user edits)
    // by folding it into committedText so new chunks append rather than replace.
    const existing = displayedTranscript;
    setCommittedText(existing);
    setPartialText("");
    setEditedTranscript(null);

    try {
      const { token } = await tokenFn({});
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start transcription";
      toast.error(msg);
      setPhase("idle");
    }
  };

  // Stop the mic but keep the transcription connection open briefly so the
  // final committed transcript for the last sentence still arrives.
  const stopMicKeepTranscribing = () => {
    try {
      if (scribe.isConnected) {
        try { scribe.mute(); } catch { /* ignore */ }
        try { scribe.commit(); } catch { /* ignore */ }
        // Give the server time to flush the final committed transcript
        // before tearing down the socket.
        setTimeout(() => {
          try { scribe.disconnect(); } catch { /* ignore */ }
        }, 2500);
      }
    } catch {
      // ignore
    }
  };

  const handleStop = async (_duration: number) => {
    stopMicKeepTranscribing();
    setPhase("idle");
  };


  const handleNextQuestion = async () => {
    const currentAnswer = displayedTranscript.trim();
    const newAnswers = [...answers, currentAnswer];
    setAnswers(newAnswers);

    // If currently recording, stop the mic without saving a draft
    if (phase === "recording") {
      stopMicKeepTranscribing();
      setRecorderKey((k) => k + 1); // remount VoiceChat to reset its internal listening state
      setPhase("idle");
    }

    // Keep the existing transcript text on screen
    await fetchQuestion(questions, newAnswers);
  };

  const handleForcedNext = () => {
    const currentAnswer = displayedTranscript.trim();
    const forcedQ = FORCED_QUESTIONS[forcedStep];
    setQuestions((q) => [...q, forcedQ]);
    setAnswers((a) => [...a, currentAnswer]);

    if (phase === "recording") {
      stopMicKeepTranscribing();
      setRecorderKey((k) => k + 1);
      setPhase("idle");
    }

    setForcedStep((s) => s + 1);
  };

  const inForcedPhase = forcedStep < FORCED_QUESTIONS.length;
  const MAX_AI_QUESTIONS = 10;
  const aiQuestionsAsked = Math.max(0, questions.length - FORCED_QUESTIONS.length);
  const aiLimitReached = !inForcedPhase && hasStarted && aiQuestionsAsked >= MAX_AI_QUESTIONS;

  const hintText =
    phase === "processing"
      ? "Saving your update…"
      : phase === "saved"
        ? "Draft saved ✓"
        : inForcedPhase
          ? FORCED_QUESTIONS[forcedStep]
          : aiLimitReached
            ? "You've answered all the questions! Good job!"
            : !hasStarted
              ? "Ventura AI is here to assist you with pitching your update"
              : loadingQuestion && !currentQuestion
                ? "Thinking of a good question…"
                : currentQuestion || "Tap the mic to start your update";

  if (stage === "record" && !previousCardsChecked) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (stage === "record" && !showCardsFirst && !introDone) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background px-6">
        <div
          className={cn(
            "w-full max-w-3xl transition-all duration-[900ms] ease-[cubic-bezier(0.7,0,0.2,1)]",
            introMerging
              ? "-translate-y-[calc(50vh-15rem)] scale-[0.6] opacity-0 blur-[1px]"
              : "translate-y-0 scale-100 opacity-100",
          )}
        >
          <TypewriterTitle
            sequences={[{ text: FORCED_QUESTIONS[0], deleteAfter: false }]}
            typingSpeed={55}
            startDelay={250}
            autoLoop={false}
            pauseBeforeDelete={900}
            onComplete={() => {
              if (introMerging) return;
              setIntroMerging(true);
              setHasStarted(true);
              window.setTimeout(() => setIntroDone(true), 850);
            }}
          />
        </div>
      </div>
    );
  }



  if (showCardsFirst) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <p className="max-w-2xl text-center text-sm text-muted-foreground">
          Update your total numbers and biggest milestones over the whole startup journey. They will be visible in your startup profile for investors.
        </p>
        <ProgressionCardsGrid
          cards={cards}
          editable
          badgeVariant="summary"
          columns={2}
          onChange={(i, patch) =>
            setCards((prev) =>
              prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
            )
          }
          onDelete={(i) =>
            setCards((prev) => prev.filter((_, idx) => idx !== i))
          }
          onAdd={
            cards.length < MAX_CARDS
              ? () =>
                  setCards((prev) => [
                    ...prev,
                    { label: "", value: "", icon_name: "", image_url: null, description: "" },
                  ])
              : undefined
          }
        />
        {(() => {
          const incomplete = cards.some(
            (c) =>
              !c.label.trim() ||
              !(c.value ?? "").trim() ||
              (!c.image_url && !(c.icon_name ?? "").trim()),
          );
          return (
            <div className="flex flex-col items-center gap-2 pt-2">
              {incomplete && cards.length > 0 && (
                <p className="text-xs text-destructive">
                  Each card needs a label, a value, and an icon or photo.
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                {onBack && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={onBack}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                <LiquidMetalButton
                  onClick={() => {
                    if (incomplete) {
                      toast.error("Fill every card's label, value, and icon/photo before continuing.");
                      return;
                    }
                    setCardsCompleted(true);
                  }}
                  disabled={cards.length === 0 || incomplete}
                >
                  Continue to weekly update
                </LiquidMetalButton>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (stage === "summary") {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        {generateCards.isPending ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            Generating cards… <MessageLoading />
          </div>
        ) : (
          <>
            <ProgressionCardsGrid
              cards={cards}
              editable
              badgeVariant="summary"
              columns={2}
              onChange={(i, patch) =>
                setCards((prev) =>
                  prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
                )
              }
              onDelete={(i) =>
                setCards((prev) => prev.filter((_, idx) => idx !== i))
              }
              onAdd={
                cards.length < MAX_CARDS
                  ? () =>
                      setCards((prev) => [
                        ...prev,
                        { label: "", value: "", icon_name: "", image_url: null, description: "" },
                      ])
                  : undefined
              }
            />
            {(() => {
              const incomplete = cards.some(
                (c) =>
                  !c.label.trim() ||
                  !(c.value ?? "").trim() ||
                  (!c.image_url && !(c.icon_name ?? "").trim()),
              );
              return (
                <div className="flex flex-col items-center gap-2 pt-2">
                  {incomplete && cards.length > 0 && (
                    <p className="text-xs text-destructive">
                      Each card needs a label, a value, and an icon or photo before publishing.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() => setStage("record")}
                      disabled={publishCards.isPending}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <LiquidMetalButton
                      onClick={() => {
                        if (incomplete) {
                          toast.error("Fill every card's label, value, and icon/photo before publishing.");
                          return;
                        }
                        publishCards.mutate();
                      }}
                      disabled={publishCards.isPending || cards.length === 0 || incomplete}
                    >
                      {publishCards.isPending ? "Publishing…" : "Publish to startup profile"}
                    </LiquidMetalButton>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Full-width AI question */}
      <div
        className={cn(
          "col-span-full",
          introMerging && "motion-safe:animate-[intro-land_1.1s_cubic-bezier(0.2,0.8,0.2,1)_both]",
        )}
      >
        <GlassTextHolder
          size="lg"
          className="!block w-full rounded-3xl sm:rounded-full [&_.glass-holder]:rounded-3xl [&_.glass-holder]:sm:rounded-full [&_.glass-holder-shadow]:rounded-3xl [&_.glass-holder-shadow]:sm:rounded-full"
          contentClassName="!px-5 !py-4 sm:!px-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left"
        >
          <span className="flex min-w-0 items-center justify-center gap-3 text-base sm:text-lg">
            {hintText}
            {(phase === "processing" || loadingQuestion) && <MessageLoading />}
          </span>
          {!aiLimitReached && (
            <>
              <div className="hidden sm:block h-10 w-px shrink-0 bg-border" />

              <LiquidMetalButton
                className="w-auto shrink-0 self-center"
                onClick={inForcedPhase ? handleForcedNext : hasStarted ? handleNextQuestion : handleStartQuestions}
                disabled={loadingQuestion || phase === "recording" || phase === "processing"}

              >
                {loadingQuestion ? "Generating…" : inForcedPhase ? "Next" : hasStarted ? "Next question" : "Start"}
              </LiquidMetalButton>
            </>
          )}
        </GlassTextHolder>
      </div>

      {/* Left: recorder */}
      <div className="flex h-full flex-col items-center justify-between gap-6">
        <VoiceChat
          key={recorderKey}
          demoMode={false}
          onStart={handleStart}
          onStop={handleStop}
          className="!min-h-0 !bg-transparent pb-2 justify-start"
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <LiquidMetalButton
            onClick={() => {
              if (displayedTranscript.trim().length < 200) {
                toast.error("Write at least 200 characters");
                return;
              }
              setShowConfirm(true);
            }}
            disabled={
              finalize.isPending ||
              phase === "recording" ||
              phase === "processing"
            }
          >
            {finalize.isPending ? "Finalizing…" : "Let Ventura AI finalize my update"}
          </LiquidMetalButton>
          <LiquidMetalButton
            onClick={() => {
              if (!displayedTranscript.trim()) {
                toast.error("Nothing to save yet");
                return;
              }
              saveDraft.mutate();
            }}
            disabled={saveDraft.isPending || phase === "recording" || phase === "processing"}
          >
            {saveDraft.isPending ? "Saving…" : "Save as a draft"}
          </LiquidMetalButton>
        </div>
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer text-muted-foreground"
            onClick={() => {
              if (hasPreviousCards && cardsCompleted) {
                setCardsCompleted(false);
                return;
              }
              onBack?.();
            }}
            disabled={
              finalize.isPending ||
              publishCards.isPending ||
              phase === "recording" ||
              phase === "processing"
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to previous step
          </Button>
        )}

      </div>

      {/* Right: editable transcript */}
      <div className="flex h-full flex-col gap-2 pb-[35vh] sm:pb-0">
        <label
          htmlFor="transcript-field"
          className="block w-full text-center text-sm font-medium text-foreground"
        >
          Live transcript
        </label>
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm focus-within:ring-2 focus-within:ring-primary">
          <Textarea
            id="transcript-field"
            value={displayedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
            placeholder="Speak or type here at least 200 characters. Answer the questions provided by AI, skip if they're not relevant at the moment or just say what you feel is important. At the end AI will structure your pitch so don't worry about grammar or punctuation."
            className="h-full resize-none overflow-auto !rounded-none border-0 bg-transparent p-5 pb-14 text-base leading-relaxed focus-visible:ring-0 custom-scrollbar"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-2">
            <div className="pointer-events-auto">
              {attachOpen ? (
                <div className="flex items-center gap-1 rounded-full border border-border bg-background/95 pl-0 pr-1 py-0 shadow-sm backdrop-blur">
                  <AttachFilesButton startupId={startupId} />
                  <button
                    type="button"
                    onClick={() => setAttachOpen(false)}
                    aria-label="Hide attach button"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAttachOpen(true)}
                  aria-label="Show attach button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm backdrop-blur hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Before you finalize</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure the names of the people and organizations you mentioned want to be visible on your update or that your update follows GDPR principles?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirm(false)}>
              Check again
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                finalize.mutate();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
