import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import { FileDown, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { renderAiPdfReport } from "@/design-system/ventura-6bef42/lib/ai-pdf.functions";
import orbLogoAsset from "@/design-system/ventura-6bef42/assets/ventura-orb-logo.png.asset.json";
import { toast } from "sonner";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { ScrollArea } from "@/design-system/ventura-6bef42/components/ui/scroll-area";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/design-system/ventura-6bef42/components/ai-elements/prompt-input";
import { createRoleAssistantThread, deleteRoleAssistantThread, getRoleAssistantMessages, listRoleAssistantThreads } from "@/design-system/ventura-6bef42/lib/role-assistant.functions";
import type { RoleHomeRole } from "@/design-system/ventura-6bef42/lib/role-home.functions";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { ChatAttachButton, ChatFileChip } from "@/design-system/ventura-6bef42/components/chat/ChatAttachButton";
import { chatAttachmentToParts } from "@/design-system/ventura-6bef42/lib/chat-attachments";
import { ActionFillDialog, actionPlaceholders } from "./ActionFillDialog";
import { GoalAlertDialog } from "./GoalAlertDialog";

type Thread = { id: string; title: string; updated_at: string };

type PdfReport = {
  pdfReport: true;
  title: string;
  subtitle: string | null;
  sections: Array<{ heading: string; paragraphs: string[]; bullets: string[] }>;
};

function isPdfReport(value: unknown): value is PdfReport {
  return !!value && typeof value === "object" && (value as { pdfReport?: boolean }).pdfReport === true;
}

function PdfReportCard({ report }: { report: PdfReport }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const result = await renderAiPdfReport({
        data: {
          report: {
            title: report.title,
            subtitle: report.subtitle ?? null,
            sections: (report.sections ?? []).map((section) => ({
              heading: section.heading ?? "",
              paragraphs: section.paragraphs ?? [],
              bullets: section.bullets ?? [],
            })),
          },
        },
      });
      const bin = atob(result.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the PDF");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 rounded-xl border bg-background/80 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PDF report</div>
      <p className="mt-1 text-sm font-medium text-foreground">{report.title}</p>
      {report.subtitle ? <p className="text-xs text-muted-foreground">{report.subtitle}</p> : null}
      <Button size="sm" className="mt-3" onClick={() => void download()} disabled={busy}>
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
        Download PDF
      </Button>
    </div>
  );
}
const GOAL_ALERT_QUESTION = "Send me an email when [startup] reaches [goal]";

const QUESTIONS: Record<RoleHomeRole, string[]> = {
  investor: [
    GOAL_ALERT_QUESTION,
    "Create pdf file which summarizes my saved startups",
    "Show top 5 most investment-ready startups",
    "Create a comparison table for the current top startups",
  ],
  mentor: [
    "Prepare a coaching brief for [startup]",
    "Find startups that need help with [area]",
    "Compare my top matches by founder challenges",
    GOAL_ALERT_QUESTION,
  ],
};

export function RoleAssistant({ role, open, onOpenChange, initialPrompt, promptNonce }: { role: RoleHomeRole; open: boolean; onOpenChange: (open: boolean) => void; initialPrompt?: string | null; promptNonce?: number }) {
  const list = useServerFn(listRoleAssistantThreads);
  const create = useServerFn(createRoleAssistantThread);
  const remove = useServerFn(deleteRoleAssistantThread);
  const loadMessages = useServerFn(getRoleAssistantMessages);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [booting, setBooting] = useState(false);
  const [goalAlertOpen, setGoalAlertOpen] = useState(false);
  const [fillLabel, setFillLabel] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const handledNonce = useRef<number | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<string | null>(null);
  const retriedRef = useRef<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/role-assistant", body: () => ({ threadId: activeId, role }), headers: async (): Promise<Record<string, string>> => { const { data } = await supabase.auth.getSession(); return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}; } }), [activeId, role]);
  const { messages, sendMessage, status, setMessages } = useChat({ id: activeId ?? "none", messages: initialMessages, transport, onError: (error) => { const text = error.message || ""; const permanent = ["AI_CREDITS_EXHAUSTED", "AI_ACCESS_BLOCKED", "AI_RATE_LIMITED", "DAILY_LIMIT_REACHED"].some((code) => text.includes(code)); const last = lastSentRef.current; if (!permanent && last && retriedRef.current !== last) { retriedRef.current = last; window.setTimeout(() => { void sendMessage({ text: last }); }, 800); return; } if (text.includes("AI_CREDITS_EXHAUSTED")) toast.error("The AI workspace needs more credits before the assistant can continue."); else if (text.includes("AI_ACCESS_BLOCKED")) toast.error("AI access is currently blocked by the workspace policy."); else if (text.includes("AI_RATE_LIMITED")) toast.error("The assistant is busy. Please wait a moment and try again."); else if (text.includes("DAILY_LIMIT_REACHED")) toast.error("You have reached today's assistant limit."); else toast.error("The assistant could not answer. Please try again."); } });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { if (!open) return; let cancelled = false; setBooting(true); void list({ data: { role } }).then(async (result) => { if (cancelled) return; let rows = result.threads as Thread[]; if (!rows.length) rows = [await create({ data: { role } }) as Thread]; setThreads(rows); setActiveId((current) => current && rows.some((item) => item.id === current) ? current : rows[0].id); }).catch(() => toast.error("Could not load the assistant")).finally(() => !cancelled && setBooting(false)); return () => { cancelled = true; }; }, [open, role]);
  useEffect(() => {
    if (!open || !activeId || loadedId === activeId) return;
    let cancelled = false;
    void loadMessages({ data: { threadId: activeId } }).then((result) => {
      if (cancelled) return;
      const loaded = result.messages.map((message) => ({ id: message.id, role: message.role, parts: Array.isArray(message.parts) ? message.parts : [{ type: "text", text: message.content }] })) as UIMessage[];
      setInitialMessages(loaded);
      setMessages(loaded);
      setLoadedId(activeId);
    }).catch(() => { if (cancelled) return; setInitialMessages([]); setMessages([]); setLoadedId(activeId); });
    return () => { cancelled = true; };
  }, [open, activeId, loadedId]);
  useEffect(() => { if (!open || !initialPrompt || promptNonce === handledNonce.current) return; handledNonce.current = promptNonce; setPendingPrompt(initialPrompt); }, [open, initialPrompt, promptNonce]);
  useEffect(() => {
    if (!pendingPrompt || !activeId || loadedId !== activeId || busy) return;
    setPendingPrompt(null);
    lastSentRef.current = pendingPrompt;
    retriedRef.current = null;
    void sendMessage({ text: pendingPrompt });
  }, [pendingPrompt, activeId, loadedId, busy]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, status]);
  const newThread = async () => { const thread = await create({ data: { role } }) as Thread; setThreads((items) => [thread, ...items]); setInitialMessages([]); setMessages([]); setActiveId(thread.id); setLoadedId(thread.id); };
  const deleteThread = async (id: string) => { await remove({ data: { threadId: id } }); const next = threads.filter((item) => item.id !== id); setThreads(next); if (activeId === id) { setActiveId(next[0]?.id ?? null); setMessages([]); setLoadedId(null); } };
  const submit = (text = input) => {
    const value = text.trim();
    if ((!value && !attachment) || busy) return;
    setInput("");
    const file = attachment;
    setAttachment(null);
    if (activeId && loadedId === activeId) {
      lastSentRef.current = file ? null : value;
      retriedRef.current = null;
      void (async () => {
        const extra = file ? await chatAttachmentToParts(file) : [];
        await sendMessage({ parts: [...(value ? [{ type: "text" as const, text: value }] : []), ...extra] });
      })().catch(() => toast.error("Could not send that attachment"));
    } else {
      setPendingPrompt(value);
    }
  };

  const handleQuestionClick = (question: string) => {
    if (question === GOAL_ALERT_QUESTION) {
      setGoalAlertOpen(true);
      return;
    }
    if (actionPlaceholders(question).length) {
      setFillLabel(question);
      return;
    }
    submit(question);
  };
  const handleGoalAlertCreated = (sentence: string) => {
    setGoalAlertOpen(false);
    submit(sentence);
  };
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-lg"><DialogTitle className="sr-only">Ventura {role} assistant</DialogTitle><div className="flex h-[78vh] overflow-hidden"><aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex"><div className="flex items-center justify-between p-3"><span className="text-xs font-semibold uppercase text-muted-foreground">Chats</span><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void newThread()}><Plus className="h-4 w-4" /></Button></div><ScrollArea className="flex-1 px-2">{threads.map((thread) => <div key={thread.id} className={cn("group mb-1 grid grid-cols-[1fr_2rem] items-center rounded-md", activeId === thread.id ? "bg-background shadow-sm" : "hover:bg-background/60")}><button className="min-w-0 truncate px-2 py-2 text-left text-sm" onClick={() => setActiveId(thread.id)}>{thread.title}</button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteThread(thread.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</ScrollArea></aside><div className="flex min-w-0 flex-1 flex-col"><header className="flex items-center justify-between border-b px-5 py-3"><div className="flex items-center gap-2 text-sm font-semibold">AI {role} assistant</div></header><ScrollArea className="flex-1 px-5 py-4">{booting ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : messages.length === 0 ? <div className="mx-auto max-w-lg py-12 text-center"><img src={orbLogoAsset.url} alt="Ventura" className="mx-auto mb-3 h-12 w-12 object-contain" /><h3 className="mt-3 text-lg font-semibold">What would you like to work on?</h3><div className="mt-6 grid gap-2 sm:grid-cols-2">{QUESTIONS[role].map((question) => <Button key={question} variant="outline" className="h-auto cursor-pointer whitespace-normal py-3 text-left" onClick={() => handleQuestionClick(question)}>{question}</Button>)}</div></div> : <div className="space-y-5">{messages.map((message) => <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[88%] rounded-lg px-4 py-3 text-sm", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60")}>{message.parts.map((part, index) => part.type === "text" ? <ChatMarkdown key={index}>{part.text}</ChatMarkdown> : part.type === "file" ? <ChatFileChip key={index} filename={(part as { filename?: string }).filename} /> : part.type === "reasoning" && busy ? <p key={index} className="text-xs text-muted-foreground">Thinking…</p> : isPdfReport((part as { output?: unknown }).output) ? <PdfReportCard key={index} report={(part as { output: PdfReport }).output} /> : null)}</div></div>)}{busy ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching and thinking…</div> : null}</div>}<div ref={bottomRef} /></ScrollArea><div className="border-t p-3"><PromptInput onSubmit={() => submit()} className="rounded-lg ring-1 ring-primary/40 focus-within:ring-2"><PromptInputTextarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask your ${role} assistant…`} className="min-h-12 max-h-32" /><PromptInputFooter className="justify-between gap-2"><ChatAttachButton file={attachment} onSelect={setAttachment} disabled={busy} /><PromptInputSubmit status={status} disabled={busy || (!input.trim() && !attachment)} className="h-9 w-9">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</PromptInputSubmit></PromptInputFooter></PromptInput></div></div></div></DialogContent></Dialog><GoalAlertDialog open={goalAlertOpen} onOpenChange={setGoalAlertOpen} onCreated={handleGoalAlertCreated} /><ActionFillDialog label={fillLabel} open={Boolean(fillLabel)} onOpenChange={(value) => { if (!value) setFillLabel(null); }} onSubmit={(sentence) => submit(sentence)} /></>;
}