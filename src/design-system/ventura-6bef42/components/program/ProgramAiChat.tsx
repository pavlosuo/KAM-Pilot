import { useEffect, useMemo, useRef, useState, type ReactNode, Children } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import { Loader2, Plus, Send, Trash2, Check, FileDown, Menu, X } from "lucide-react";
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
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/design-system/ventura-6bef42/components/ui/sheet";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { ChatAttachButton, ChatFileChip } from "@/design-system/ventura-6bef42/components/chat/ChatAttachButton";
import { chatAttachmentToParts } from "@/design-system/ventura-6bef42/lib/chat-attachments";
import {
  createProgramAiConversation,
  deleteProgramAiConversation,
  executeProgramAiAction,
  getProgramAiMessages,
  listProgramAiConversations,
} from "@/design-system/ventura-6bef42/lib/program-ai.functions";
import { renderProgramAiPdf } from "@/design-system/ventura-6bef42/lib/program-pdf.functions";

type Conversation = { id: string; title: string; updated_at: string };

type Proposal = {
  proposal: true;
  label: string;
  summary: string;
  action: unknown;
};

type PdfReport = {
  pdfReport: true;
  title: string;
  subtitle: string | null;
  sections: Array<{ heading: string; paragraphs: string[]; bullets: string[] }>;
};

function isProposal(v: unknown): v is Proposal {
  return !!v && typeof v === "object" && (v as { proposal?: boolean }).proposal === true;
}

function isPdfReport(v: unknown): v is PdfReport {
  return !!v && typeof v === "object" && (v as { pdfReport?: boolean }).pdfReport === true;
}

type ChatListProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  showHeader?: boolean;
};

function ChatList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNewChat,
  showHeader = true,
}: ChatListProps) {
  return (
    <div className="flex h-full flex-col">
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Chats
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onNewChat()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1 px-2 pb-3 scrollbar-stylish">
        <div className="space-y-1">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-center gap-1 rounded-lg py-1 pl-2 pr-1 text-sm",
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
      </ScrollArea>
    </div>
  );
}

export function ProgramAiChat({
  slug,
  open,
  onOpenChange,
  initialPrompt,
  promptNonce,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPrompt?: string | null;
  promptNonce?: number;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

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
  openRef.current = open;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/program-chat",
        body: () => ({ slug, conversationId: activeId }),
      }),
    [slug, activeId],
  );

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
      if (msg.includes("AI_CREDITS_EXHAUSTED")) {
        toast.error("The AI workspace has run out of credits for today. Try again later.");
        return;
      }
      if (msg.includes("AI_RATE_LIMITED")) {
        toast.error("Too many requests right now. Give it a few seconds and ask again.");
        return;
      }
      toast.error(msg || "The assistant hit an error");
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const showThinking =
    busy && (!lastMessage || lastMessage.role !== "assistant" || !hasVisibleContent(lastMessage));

  // Capture the requested action synchronously so the boot path knows it must
  // open a brand-new chat for it.
  const lastNonce = useRef<number | undefined>(undefined);
  if (open && initialPrompt && promptNonce !== lastNonce.current) {
    lastNonce.current = promptNonce;
    pendingPrompt.current = initialPrompt;
    pendingConversationId.current = null;
    actionRequested.current = true;
    actionSequence.current += 1;
  }

  /* Load conversation list on open */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBooting(true);
    void (async () => {
      try {
        const res = await listProgramAiConversations({ data: { slug } });
        if (cancelled) return;
        const list = res.conversations as Conversation[];
        setConversations((current) => [
          ...current.filter((conversation) => !list.some((item) => item.id === conversation.id)),
          ...list,
        ]);
        if (actionRequested.current) {
          // The action effect owns conversation selection for search actions.
          return;
        } else if (list.length > 0) {
          setActiveId((cur) => cur ?? list[0].id);
        } else {
          const created = (await createProgramAiConversation({ data: { slug } })) as Conversation;
          if (cancelled) return;
          freshIds.current.add(created.id);
          setConversations([created]);
          setActiveId(created.id);
        }
      } catch {
        toast.error("Could not load the assistant");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  useEffect(() => {
    if (!open) {
      actionRequested.current = false;
      pendingPrompt.current = null;
      pendingConversationId.current = null;
      actionSequence.current += 1;
    }
  }, [open]);

  /* Load messages for the active conversation */
  useEffect(() => {
    if (!open || booting || !activeId) return;
    // Newly created chats have no server history yet; fetching would race with
    // (and wipe) the message we are about to send.
    if (freshIds.current.has(activeId)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await getProgramAiMessages({ data: { slug, conversationId: activeId } });
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
  }, [open, booting, activeId, slug, reloadNonce, setMessages]);

  /* A prompt from the orb bar always opens a fresh chat */
  useEffect(() => {
    if (!open || !initialPrompt || promptNonce === handledActionNonce.current) return;
    handledActionNonce.current = promptNonce;
    const sequence = actionSequence.current;

    void (async () => {
      try {
        const created = (await createProgramAiConversation({ data: { slug } })) as Conversation;
        if (!openRef.current || actionSequence.current !== sequence) return;
        freshIds.current.add(created.id);
        pendingConversationId.current = created.id;
        setConversations((current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ]);
        setInitialMessages([]);
        setMessages([]);
        setActiveId(created.id);
      } catch {
        pendingPrompt.current = null;
        actionRequested.current = false;
        toast.error("Could not start a new chat");
      }
    })();
  }, [open, initialPrompt, promptNonce, slug, setMessages]);

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

  // If a run ends without producing any visible answer, say so instead of
  // leaving an empty bubble hanging there.
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && !hasVisibleContent(last)) {
      toast.error("The assistant didn't manage to answer that. Try asking again.");
    }
  }, [status, messages]);

  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy, activeId]);

  const newChat = async () => {
    try {
      const created = (await createProgramAiConversation({ data: { slug } })) as Conversation;
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
      await deleteProgramAiConversation({ data: { slug, conversationId: id } });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Program assistant</DialogTitle>
        <div className="flex h-[78vh]">
          {/* Conversations - desktop */}
          <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
            <ChatList
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => {
                freshIds.current.delete(id);
                setActiveId(id);
                setReloadNonce((n) => n + 1);
              }}
              onDelete={(id) => void removeChat(id)}
              onNewChat={() => void newChat()}
            />
          </aside>

          {/* Thread */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b px-5 py-3">
              <Sheet open={mobileHistoryOpen} onOpenChange={setMobileHistoryOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer md:hidden"
                    aria-label="Chat history"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" hideClose className="w-3/4 p-0 sm:max-w-xs">
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b px-3 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Chats
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label="New chat"
                          onClick={() => {
                            void newChat();
                            setMobileHistoryOpen(false);
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
                    </div>
                    <ChatList
                      conversations={conversations}
                      activeId={activeId}
                      onSelect={(id) => {
                        freshIds.current.delete(id);
                        setActiveId(id);
                        setReloadNonce((n) => n + 1);
                        setMobileHistoryOpen(false);
                      }}
                      onDelete={(id) => void removeChat(id)}
                      onNewChat={() => {
                        void newChat();
                        setMobileHistoryOpen(false);
                      }}
                      showHeader={false}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="text-sm font-semibold">Program assistant</div>
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
                    <MessageBubble key={m.id} message={m} slug={slug} />
                  ))}
                  {showThinking && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2">
                        <AITextLoading
                          className="justify-start"
                          texts={[
                            "Thinking...",
                            "Reading the cohort...",
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

            <div className="border-t p-3">
              <PromptInput
                onSubmit={() => submit()}
                className="overflow-hidden rounded-xl ring-1 ring-primary focus-within:ring-2 focus-within:ring-primary"
              >
                <PromptInputTextarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  placeholder="Ask about the cohort, request a report, or propose an action…"
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
                      <Send className="h-4 w-4 -translate-x-0.5" />
                    )}
                  </PromptInputSubmit>
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SUGGESTIONS = [
  "Give me a summary of cohort progress this week",
  "Which startups are falling behind and why?",
  "Draft an announcement reminding everyone to post their weekly update",
  "Who hasn't been reviewed yet?",
];

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
       <img src={orbLogoAsset.url} alt="Ventura" className="program-ai-logo mx-auto mb-3 h-12 w-12 object-contain" />
      <h3 className="text-base font-semibold">Ask anything about your program</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Reports, progress, risks and advice — plus actions you confirm before they run.
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
    if (type.startsWith("tool-")) {
      return (
        String(p.state ?? "") === "output-available" &&
        (isProposal(p.output) || isPdfReport(p.output))
      );
    }
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
  const isListLike = (l: string) => /^\s*([-*+]\s|\d+[.)]\s|>|#{1,6}\s|\||```)/.test(l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeadlineLine(line)) {
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push(line);
      out.push("");
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

function MessageBubble({ message, slug }: { message: UIMessage; slug: string }) {
  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as Array<Record<string, unknown>>;

  if (!isUser && !hasVisibleContent(message)) return null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-sm",
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

          if (type.startsWith("tool-")) {
            const state = String(part.state ?? "");
            const output = part.output;
            if (state === "output-available" && isProposal(output)) {
              return <ProposalCard key={i} slug={slug} proposal={output} />;
            }
            if (state === "output-available" && isPdfReport(output)) {
              return <PdfReportCard key={i} slug={slug} report={output} />;
            }
            // Tool-loading chips stay hidden so the unified loading animation is
            // the only visible loading indicator.
            return null;
          }

          return null;
        })}
      </div>
    </div>
  );
}

function ProposalCard({ slug, proposal }: { slug: string; proposal: Proposal }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    try {
      const res = await executeProgramAiAction({ data: { slug, action: proposal.action } });
      setResult(res.message);
      setState("done");
      toast.success(res.message);
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-background/80 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">
        {proposal.label}
      </div>
      <p className="mt-1 text-sm text-foreground">{proposal.summary}</p>
      {state === "done" ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <Check className="h-3.5 w-3.5" /> {result}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => void run()} disabled={state === "running"}>
            {state === "running" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
}

function PdfReportCard({ slug, report }: { slug: string; report: PdfReport }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await renderProgramAiPdf({
        data: {
          slug,
          report: {
            title: report.title,
            subtitle: report.subtitle ?? null,
            sections: (report.sections ?? []).map((s) => ({
              heading: s.heading ?? "",
              paragraphs: s.paragraphs ?? [],
              bullets: s.bullets ?? [],
            })),
          },
        },
      });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: res.mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-background/80 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">PDF report</div>
      <p className="mt-1 text-sm font-medium text-foreground">{report.title}</p>
      {report.subtitle && <p className="text-xs text-muted-foreground">{report.subtitle}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        {(report.sections ?? []).length} section{(report.sections ?? []).length === 1 ? "" : "s"}
      </p>
      <Button size="sm" className="mt-3" onClick={() => void download()} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
        )}
        Download PDF
      </Button>
    </div>
  );
}
