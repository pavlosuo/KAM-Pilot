import { useEffect, useMemo, useRef, useState, type ReactNode, Children } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import { Loader2, Menu, Plus, Send, Trash2, X } from "lucide-react";
import orbLogoAsset from "@/design-system/ventura-6bef42/assets/ventura-orb-logo.png.asset.json";
import AITextLoading from "@/design-system/ventura-6bef42/components/ui/ai-text-loading";

import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/design-system/ventura-6bef42/components/ai-elements/prompt-input";
import { Dialog, DialogContent, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { ScrollArea } from "@/design-system/ventura-6bef42/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/design-system/ventura-6bef42/components/ui/sheet";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { ChatAttachButton, ChatFileChip } from "@/design-system/ventura-6bef42/components/chat/ChatAttachButton";
import { chatAttachmentToParts } from "@/design-system/ventura-6bef42/lib/chat-attachments";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { Podium, type MatchPerson } from "@/design-system/ventura-6bef42/components/program-content/MatchPodium";
import { requestConnectionIntro } from "@/design-system/ventura-6bef42/lib/founder-match.functions";
import {
  createFounderAiConversation,
  deleteFounderAiConversation,
  getFounderAiMessages,
  listFounderAiConversations,
} from "@/design-system/ventura-6bef42/lib/founder-ai.functions";

type Conversation = { id: string; title: string; updated_at: string };

const isMatchingTitle = (title: string) =>
  title === "Mentor matching" || title === "Investor matching";

const SUGGESTIONS = [
  "Reflect on our latest weekly update",
  "What are the 3 things we should focus on this week?",
  "Which commitments did we drop last week?",
  "How investor ready are we right now?",
];

export function FounderAiChat({
  startupId,
  programId,
  startupName,
  open,
  onOpenChange,
  initialPrompt,
  promptNonce,
  mode = null,
  onMatchesSaved,
}: {
  startupId: string;
  programId: string;
  startupName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPrompt?: string | null;
  promptNonce?: number;
  /** When set, the chat runs a mentor/investor matching session. */
  mode?: "mentor" | "investor" | null;
  onMatchesSaved?: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [booting, setBooting] = useState(true);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const pendingPrompt = useRef<string | null>(null);
  const pendingConversationId = useRef<string | null>(null);
  const freshIds = useRef<Set<string>>(new Set());
  const actionRequested = useRef(false);
  const handledActionNonce = useRef<number | undefined>(undefined);
  const actionSequence = useRef(0);
  const openRef = useRef(open);
  const askIntro = useServerFn(requestConnectionIntro);
  const [askingId, setAskingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const askLeadToConnect = async (person: MatchPerson) => {
    setAskingId(person.id);
    try {
      await askIntro({ data: { startupId, programId, suggestionId: person.id } });
      setRequestedIds((prev) => [...prev, person.id]);
      toast.success("Your program lead has been asked to connect you");
      onMatchesSaved?.();
    } catch {
      toast.error("Could not send the request");
    } finally {
      setAskingId(null);
    }
  };
  const reportedMatchSaves = useRef<Set<string>>(new Set());
  openRef.current = open;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/founder-chat",
        body: () => ({ startupId, programId, conversationId: activeId, mode }),
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },

      }),
    [startupId, programId, activeId, mode],
  );

  const [limitReached, setLimitReached] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: activeId ?? "none",
    messages: initialMessages,
    transport,
    onError: (e) => {
      const msg = e.message || "";
      if (msg.includes("AI_CREDITS_LIMIT_REACHED")) {
        toast.error("This month's Ventura AI credits for your program are used up. They reset on the 1st.");
        return;
      }
      if (msg.includes("DAILY_LIMIT_REACHED")) {
        setLimitReached(true);
        return;
      }
      if (msg.includes("AI_CREDITS_EXHAUSTED")) {
        toast.error("The AI workspace has run out of credits for today. Try again later.");
        return;
      }
      if (msg.includes("AI_RATE_LIMITED")) {
        toast.error("Too many requests right now. Give it a few seconds and ask again.");
        return;
      }
      toast.error(msg || "The co-founder hit an error");
    },

  });


  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    busy && (!lastMessage || lastMessage.role !== "assistant" || !hasVisibleContent(lastMessage));


  // Capture the requested action synchronously (before effects run) so the boot
  // path knows it must open a brand-new chat for it.
  const lastNonce = useRef<number | undefined>(undefined);
  if (open && initialPrompt && promptNonce !== lastNonce.current) {
    lastNonce.current = promptNonce;
    pendingPrompt.current = initialPrompt;
    pendingConversationId.current = null;
    actionRequested.current = true;
    actionSequence.current += 1;
  }



  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBooting(true);
    void (async () => {
      try {
        const res = await listFounderAiConversations({ data: { startupId, programId } });
        if (cancelled) return;
        const list = res.conversations as Conversation[];
        setConversations((current) => [
          ...current.filter((conversation) => !list.some((item) => item.id === conversation.id)),
          ...list,
        ]);
        if (actionRequested.current) {
          // The action effect owns conversation selection for search actions.
          return;
        } else if (list.some((c) => !isMatchingTitle(c.title))) {
          // Opening the co-founder chat directly must never resume a matching
          // session — matching only starts from the two matching buttons.
          const general = list.find((c) => !isMatchingTitle(c.title))!;
          setActiveId((cur) => cur ?? general.id);
        } else {
          const created = (await createFounderAiConversation({
            data: { startupId, programId },
          })) as Conversation;
          if (cancelled) return;
          freshIds.current.add(created.id);
          setConversations([created]);
          setActiveId(created.id);
        }

      } catch {
        toast.error("Could not load the AI co-founder");
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, startupId, programId, setMessages]);

  useEffect(() => {
    if (!open) {
      actionRequested.current = false;
      pendingPrompt.current = null;
      pendingConversationId.current = null;
      actionSequence.current += 1;
    }
  }, [open]);

  useEffect(() => {
    if (!open || booting || !activeId) return;
    // Newly created chats have no server history yet; fetching would race with
    // (and wipe) the message we are about to send.
    if (freshIds.current.has(activeId)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await getFounderAiMessages({ data: { conversationId: activeId } });
        if (cancelled) return;
        const loaded = (res.messages as Array<{ id: string; role: string; parts: unknown }>).map(
          (m) => ({ id: m.id, role: m.role, parts: m.parts }) as unknown as UIMessage,
        );
        setInitialMessages(loaded);
        setMessages(loaded);
      } catch {
        /* new conversation */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, booting, activeId, setMessages]);

  useEffect(() => {
    if (!open || !initialPrompt || promptNonce === handledActionNonce.current) return;
    handledActionNonce.current = promptNonce;
    const sequence = actionSequence.current;

    void (async () => {
      try {
        const created = (await createFounderAiConversation({
          data: { startupId, programId },
        })) as Conversation;
        if (!openRef.current || actionSequence.current !== sequence) return;
        freshIds.current.add(created.id);
        pendingConversationId.current = created.id;
        setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setInitialMessages([]);
        setMessages([]);
        setActiveId(created.id);
      } catch {
        pendingPrompt.current = null;
        actionRequested.current = false;
        toast.error("Could not start a new chat");
      }
    })();
  }, [open, initialPrompt, promptNonce, startupId, programId, setMessages]);

  useEffect(() => {
    if (!open || !activeId || busy) return;
    const p = pendingPrompt.current;
    if (!p || pendingConversationId.current !== activeId) return;
    pendingPrompt.current = null;
    pendingConversationId.current = null;
    actionRequested.current = false;
    void sendMessage({ text: p });
  }, [open, activeId, busy, sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  // Refresh the Program Hub as soon as the matching tool persists its result.
  // Waiting for the dialog to close left the podium stale while the chat stayed open.
  useEffect(() => {
    if (!onMatchesSaved) return;
    for (const message of messages) {
      const parts = (message.parts ?? []) as Array<Record<string, unknown>>;
      parts.forEach((part, index) => {
        if (part.type !== "tool-save_matches") return;
        const output = part.output as { saved?: boolean } | undefined;
        if (output?.saved !== true) return;
        const key = `${message.id}:${String(part.toolCallId ?? index)}`;
        if (reportedMatchSaves.current.has(key)) return;
        reportedMatchSaves.current.add(key);
        onMatchesSaved();
      });
    }
  }, [messages, onMatchesSaved]);

  // If a run ends without producing any visible answer, tell the founder
  // instead of leaving an empty bubble hanging there.
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && !hasVisibleContent(last)) {
      toast.error("The co-founder didn't manage to answer that. Try asking again.");
    }
  }, [status, messages]);



  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy, activeId]);

  const newChat = async () => {
    try {
      const created = (await createFounderAiConversation({
        data: { startupId, programId },
      })) as Conversation;
      freshIds.current.add(created.id);
      setConversations((c) => [created, ...c]);
      setInitialMessages([]);
      setMessages([]);
      setActiveId(created.id);

    } catch {
      toast.error("Could not start a new chat");
    }
  };

  const removeChat = async (id: string) => {
    try {
      await deleteFounderAiConversation({ data: { conversationId: id } });
      setConversations((c) => c.filter((x) => x.id !== id));
      if (activeId === id) {
        setMessages([]);
        setInitialMessages([]);
        setActiveId(null);
      }
    } catch {
      toast.error("Could not delete that chat");
    }
  };

  const submit = () => {
    const text = input.trim();
    if ((!text && !attachment) || busy || !activeId) return;
    setInput("");
    const file = attachment;
    setAttachment(null);
    void (async () => {
      const extra = file ? await chatAttachmentToParts(file) : [];
      await sendMessage({ parts: [...(text ? [{ type: "text" as const, text }] : []), ...extra] });
    })().catch(() => toast.error("Could not send that attachment"));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Ventura AI co-founder</DialogTitle>
        <div className="flex h-[78vh] overflow-hidden">
          <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
            <div className="flex items-center justify-between px-3 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Chats
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void newChat()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 px-2 pb-3 scrollbar-stylish">
              <ChatList
                conversations={conversations}
                activeId={activeId}
                onSelect={setActiveId}
                onDelete={(id) => void removeChat(id)}
              />
            </ScrollArea>
          </aside>

          <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-hidden">
            <header className="flex items-center gap-2 border-b px-5 py-3">
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="-ml-2 h-8 w-8 shrink-0 md:hidden"
                    aria-label="Chat history"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" hideClose className="w-72 p-0">
                  <SheetHeader className="flex-row items-center justify-between space-y-0 px-4 py-3">
                    <SheetTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Chats
                    </SheetTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label="New chat"
                        onClick={() => {
                          setHistoryOpen(false);
                          void newChat();
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <SheetClose asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label="Close chat history"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </SheetClose>
                    </div>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-4rem)] px-2 pb-4 scrollbar-stylish">
                    <ChatList
                      conversations={conversations}
                      activeId={activeId}
                      onSelect={(id) => {
                        setActiveId(id);
                        setHistoryOpen(false);
                      }}
                      onDelete={(id) => void removeChat(id)}
                    />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              <div className="text-sm font-semibold">AI co-founder · {startupName}</div>
            </header>


            <ScrollArea className="flex-1 px-5 py-4 scrollbar-stylish">
              {booting ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyState onPick={(q) => void sendMessage({ text: q })} />
              ) : (
                <div className="space-y-5">
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      onAsk={askLeadToConnect}
                      askingId={askingId}
                      requestedIds={requestedIds}
                      mode={mode}
                    />
                  ))}
                  {showThinking && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2">
                        <AITextLoading
                          className="justify-start"
                          texts={[
                            "Thinking...",
                            "Reading your updates...",
                            "Analyzing...",
                            "Connecting the dots...",
                            "Almost there...",
                          ]}
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}

              <div ref={bottomRef} />
            </ScrollArea>

            <div className="min-w-0 border-t p-3">
              <PromptInput
                onSubmit={() => submit()}
                className="overflow-hidden rounded-xl ring-1 ring-primary focus-within:ring-2 focus-within:ring-primary"
              >
                <PromptInputTextarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  placeholder="Ask about your progress, priorities, metrics or next steps…"
                  className="min-h-12 max-h-32 px-4 pb-2 pt-3 leading-6 scrollbar-stylish"
                />
                <PromptInputFooter className="justify-between gap-2 px-2 pb-2 pt-0">
                  <ChatAttachButton file={attachment} onSelect={setAttachment} disabled={busy} />
                  <PromptInputSubmit
                    status={status}
                    disabled={busy || (!input.trim() && !attachment)}
                    className="h-9 w-9 shrink-0 rounded-lg"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 translate-x-px" />
                    )}
                  </PromptInputSubmit>
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={limitReached} onOpenChange={setLimitReached}>
      <DialogContent className="max-w-sm">
        <DialogTitle>You've reached today's limit</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Your AI co-founder is taking a short break. You've used all of your questions for today —
          it will be ready again tomorrow.
        </p>
        <Button className="mt-2 w-full" onClick={() => setLimitReached(false)}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}


function ChatList({
  conversations,
  activeId,
  onSelect,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {conversations.map((c) => (
        <div
          key={c.id}
          className={cn(
            "group grid w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_2rem] items-center gap-1 rounded-lg py-1 pl-2 pr-1 text-sm",
            activeId === c.id ? "bg-background shadow-sm" : "hover:bg-background/60",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className="block h-8 min-w-0 cursor-pointer truncate text-left"
            title={c.title}
          >
            {c.title}
          </button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(c.id);
            }}
            className="h-8 w-8 shrink-0 bg-background text-foreground shadow-sm hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete chat"
            title="Delete chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
       <img src={orbLogoAsset.url} alt="Ventura" className="program-ai-logo mx-auto mb-3 h-12 w-12 object-contain" />
      <h3 className="text-base font-semibold">Your AI co-founder</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        It reads your weekly updates, goals, numbers and program challenges — then tells you
        straight what to do next.
      </p>
      <div className="mt-5 space-y-2 text-left">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="w-full cursor-pointer rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}



function hasVisibleContent(message: UIMessage) {
  const parts = (message.parts ?? []) as Array<Record<string, unknown>>;
  return parts.some((p) => {
    const type = String(p.type ?? "");
    if (type === "text") return String(p.text ?? "").trim().length > 0;
    return false;
  });
}

function isStandaloneStrong(children: ReactNode): boolean {
  const items = Children.toArray(children).filter((c) => {
    if (!c) return false;
    if (typeof c === "string") return c.trim().length > 0;
    if (typeof c === "number" || typeof c === "bigint") return true;
    return true;
  });
  return (
    items.length === 1 &&
    typeof items[0] === "object" &&
    (items[0] as { type?: unknown }).type === "strong"
  );
}

function spaceHeadlines(text: string): string {
  // Ensure standalone bold paragraph headlines are separated by blank lines,
  // and turn the plain sentences that follow them into a bulleted list.
  const lines = text.split("\n");
  const out: string[] = [];
  const isHeadlineLine = (l: string) => /^\*\*[^*]+(\*\*)?(?::\*\*)?$/.test(l.trim());
  const isListLike = (l: string) =>
    /^\s*([-*+]\s|\d+[.)]\s|>|#{1,6}\s|\||```)/.test(l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeadlineLine(line)) {
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push(line);
      out.push("");
      // Collect the following block of plain sentences into list items
      let j = i + 1;
      const block: string[] = [];
      while (j < lines.length && lines[j].trim() !== "" && !isHeadlineLine(lines[j])) {
        block.push(lines[j]);
        j++;
      }
      if (block.length > 0 && block.every((l) => !isListLike(l))) {
        for (const b of block) out.push(`- ${b.trim()}`);
        i = j - 1;
      }
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}


function MessageBubble({
  message,
  onAsk,
  askingId,
  requestedIds,
  mode = null,
}: {
  message: UIMessage;
  onAsk: (person: MatchPerson) => void;
  askingId: string | null;
  requestedIds: string[];
  mode?: "mentor" | "investor" | null;
}) {

  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as Array<Record<string, unknown>>;

  if (!isUser && !hasVisibleContent(message)) return null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "min-w-0 max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted/60",
        )}
      >

        {parts.map((part, i) => {
          const type = String(part.type ?? "");

          if (type === "text") {
            const text = spaceHeadlines(String(part.text ?? ""));
            return (
              <ChatMarkdown key={i}>{text}</ChatMarkdown>
            );
          }

          if (type === "file") {
            return <ChatFileChip key={i} filename={(part as { filename?: string }).filename} />;
          }

          if (type === "tool-save_matches") {
            const output = (part as {
              output?: { people?: Array<Omit<MatchPerson, "from_program">> };
            }).output;
            const people = (output?.people ?? []).map((p) => ({
              ...p,
              from_program: !!p.connection_id,
              source: p.source ?? (p.connection_id ? "program" : "web"),
              ventura_handle: p.ventura_handle ?? null,
              intro_requested: p.intro_requested || requestedIds.includes(p.id),
            }));
            if (!people.length) return null;
            return (
              <div key={i} className="w-full min-w-0 py-2">
                <Podium people={people} onAsk={onAsk} askingId={askingId} kind={mode ?? "mentor"} />
              </div>
            );
          }

          if (type.startsWith("tool-")) {
            // Hide tool-loading chips entirely (including "Reading weekly updates" /
            // "Reading startup profile") so the unified loading animation is the only
            // loading indicator visible.
            return null;
          }

          return null;
        })}
      </div>
    </div>
  );
}
