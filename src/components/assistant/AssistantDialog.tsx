import { useEffect, useMemo, useRef, useState } from "react";
import { audienceLabel } from "@/lib/engine/avatars";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Check, Copy, Info, Loader2, MessageCircle, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import AITextLoading from "@/design-system/ventura-6bef42/components/ui/ai-text-loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { ScrollArea } from "@/design-system/ventura-6bef42/components/ui/scroll-area";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/design-system/ventura-6bef42/components/ai-elements/prompt-input";
import { buildAiContext } from "@/lib/ai/context";
import { chatErrorMessage, messageText } from "@/lib/ai/chat-errors";
import { useAccount } from "@/lib/state/account-context";

export function AssistantDialog({
  open,
  onOpenChange,
  pendingPrompt,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendingPrompt: { text: string; nonce: number } | null;
}) {
  const account = useAccount();
  const contextRef = useRef(buildAiContext(account));
  contextRef.current = buildAiContext(account);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        body: () => ({ context: contextRef.current }),
      }),
    [],
  );
  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: `assistant-${account.customer.id}`,
    transport,
    onError: (e) => toast.error(chatErrorMessage(e)),
  });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handled = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !pendingPrompt || handled.current === pendingPrompt.nonce || busy) return;
    handled.current = pendingPrompt.nonce;
    void sendMessage({ text: pendingPrompt.text });
  }, [open, pendingPrompt, busy, sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy]);

  const last = messages[messages.length - 1];
  const showThinking = busy && (!last || last.role !== "assistant" || !messageText(last.parts as never).trim());

  const submit = (text = input) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    void sendMessage({ text: t });
  };

  const suggestions = useMemo(() => {
    const own = account.avatar.concerns.slice(0, 3);
    const brief = account.brief;
    const rules = brief
      ? [
          `What do ${brief.country}'s CO₂ and reporting rules mean for ${audienceLabel(account.avatar)}, and which of our figures support them?`,
          `Which ${brief.country} tax benefits or funding could strengthen the case for the service?`,
        ]
      : [];
    const pack = account.dataset.suggestedPrompts.map((p) => p.prompt);
    return [...rules, ...own, ...pack].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
  }, [account.avatar.concerns, account.avatar.name, account.brief, account.dataset.suggestedPrompts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Value assistant</DialogTitle>
        <div className="flex h-[78vh]">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b px-5 py-3">
              <MessageCircle className="h-5 w-5 text-lind-blue" />
              <div className="text-sm font-semibold">Value assistant · {account.customer.name}</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="info" size="icon-sm" aria-label="What the assistant does">
                    <Info />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <p className="text-base leading-relaxed">
                    The assistant only narrates figures already calculated in this workspace and keeps their source / estimate labels. It does
                    not give legal or compliance advice.
                  </p>
                </PopoverContent>
              </Popover>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto mr-8 gap-1.5"
                  onClick={() => {
                    void stop();
                    setMessages([]);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> New chat
                </Button>
              )}
            </header>

            <ScrollArea className="flex-1 px-5 py-4 scrollbar-stylish">
              {messages.length === 0 ? (
                <div className="mx-auto max-w-md py-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-12 w-12 text-lind-blue" />
                  <h3 className="text-base font-semibold">Prepare the review with {account.customer.name}</h3>
                  
                  <div className="mt-5 space-y-2 text-left">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="w-full cursor-pointer rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((m) => (
                    <Bubble key={m.id} message={m} />
                  ))}
                  {showThinking && (
                    <AITextLoading
                      className="justify-start"
                      texts={["Reading the review…", "Checking sites…", "Weighing the evidence…", "Writing for your audience…"]}
                    />
                  )}
                </div>
              )}
              <div ref={bottomRef} />
            </ScrollArea>

            <div className="border-t p-3">
              <PromptInput onSubmit={() => submit()} className="overflow-hidden rounded-xl ring-1 ring-primary focus-within:ring-2 focus-within:ring-primary">
                <PromptInputTextarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={1}
                  placeholder="Ask about value, sites, savings or what to improve next year…"
                  className="min-h-12 max-h-32 px-4 pb-2 pt-3 leading-6 scrollbar-stylish"
                />
                <PromptInputFooter className="justify-end gap-2 px-2 pb-2 pt-0">
                  <PromptInputSubmit status={status} disabled={busy || !input.trim()} className="h-9 w-9 shrink-0 rounded-lg">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -translate-x-0.5" />}
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

function Bubble({ message }: { message: UIMessage }) {
  const text = messageText(message.parts as never);
  const [copied, setCopied] = useState(false);
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{text}</div>
      </div>
    );
  }
  if (!text.trim()) return null;
  return (
    <div className="group flex justify-start">
      <div className="min-w-0 max-w-[92%]">
        <ChatMarkdown>{text}</ChatMarkdown>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
