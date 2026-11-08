import { useEffect, useRef, useState } from "react";
import { AtSign, CornerUpLeft, Loader2, Paperclip, Send, Smile, X } from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";

export type MentionUser = {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

export type ReplyTarget = { id: string; author: string; body: string } | null;

/**
 * Shared chat composer (same interaction model as the video feed comments):
 * emoji picker, @mention autocomplete and reply-to quoting.
 */
export function ChatComposer({
  onSubmit,
  searchMentions,
  placeholder = "Write a message…",
  disabled,
  sending,
  replyTo,
  onCancelReply,
  maxLength = 5000,
  allowAttachments = false,
}: {
  onSubmit: (body: string, file?: File | null) => void | Promise<void>;
  searchMentions?: (q: string) => Promise<MentionUser[]>;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  replyTo?: ReplyTarget;
  onCancelReply?: () => void;
  maxLength?: number;
  /** Show a paperclip button so the user can attach one file to the message. */
  allowAttachments?: boolean;
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
  }, [text]);

  const updateMentionState = (value: string, caret: number) => {
    if (!searchMentions) return;
    const match = /(?:^|\s)@([a-zA-Z0-9_-]{0,30})$/.exec(value.slice(0, caret));
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  };

  useEffect(() => {
    if (mentionQuery === null || !searchMentions) return;
    if (mentionQuery.trim().length === 0) {
      setMentionResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const users = await searchMentions(mentionQuery);
        if (!cancelled) setMentionResults(users);
      } catch {
        if (!cancelled) setMentionResults([]);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mentionQuery, searchMentions]);

  const insertAtCaret = (insert: string) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const next = text.slice(0, caret) + insert + text.slice(caret);
    setText(next);
    setTimeout(() => {
      if (!el) return;
      const pos = caret + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
      updateMentionState(next, pos);
    }, 0);
  };

  const insertMention = (u: MentionUser) => {
    if (!u.handle) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/(^|\s)@([a-zA-Z0-9_-]{0,30})$/, `$1@${u.handle} `);
    setText(replaced + after);
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(replaced.length, replaced.length);
    }, 0);
  };

  const submit = async () => {
    const body = text.trim();
    if ((!body && !file) || sending) return;
    const quoted = replyTo
      ? `> ${replyTo.author}: ${replyTo.body.replace(/\s+/g, " ").slice(0, 180)}\n`
      : "";
    await onSubmit(quoted + body, file);
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {replyTo ? (
        <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs">
          <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Replying to {replyTo.author}</p>
            <p className="truncate text-muted-foreground">{replyTo.body}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="relative flex items-stretch gap-2">
        <div className="relative flex min-h-[52px] flex-1 items-end overflow-hidden rounded-md border border-input bg-background">
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            maxLength={maxLength}
            disabled={disabled || sending}
            placeholder={placeholder}
            onChange={(e) => {
              setText(e.target.value);
              updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyUp={(e) =>
              updateMentionState(
                e.currentTarget.value,
                e.currentTarget.selectionStart ?? e.currentTarget.value.length,
              )
            }
            onClick={(e) =>
              updateMentionState(
                e.currentTarget.value,
                e.currentTarget.selectionStart ?? e.currentTarget.value.length,
              )
            }
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionResults.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionResults.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const picked = mentionResults[mentionIndex];
                  if (picked) insertMention(picked);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionQuery(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            className="h-auto w-full resize-none bg-transparent px-3 py-2 pr-16 text-sm leading-5 outline-none disabled:opacity-50 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
          />
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
            {allowAttachments ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    if (picked && picked.size > 400 * 1024 * 1024) {
                      window.alert("Attachments must be under 400MB");
                      e.target.value = "";
                      return;
                    }
                    setFile(picked);
                  }}
                />
                <button
                  type="button"
                  disabled={disabled || sending}
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Attach a file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </>
            ) : null}
            {searchMentions ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const el = textareaRef.current;
                  const caret = el?.selectionStart ?? text.length;
                  const needsSpace = caret > 0 && !/\s/.test(text[caret - 1] ?? "");
                  insertAtCaret(`${needsSpace ? " " : ""}@`);
                }}
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Mention someone"
              >
                <AtSign className="h-4 w-4" />
              </button>
            ) : null}
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Insert emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                className="w-auto overflow-visible border-none bg-transparent p-0 shadow-none"
              >
                <div
                  onWheel={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="custom-scrollbar max-h-[320px] overflow-y-auto"
                >
                  <EmojiPicker
                    onEmojiClick={(e) => insertAtCaret(e.emoji)}
                    emojiStyle={EmojiStyle.NATIVE}
                    theme={Theme.AUTO}
                    height={320}
                    width={320}
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

        </div>

        {mentionQuery !== null && mentionResults.length > 0 ? (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-xs overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {mentionResults.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  i === mentionIndex ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {safeSrc(u.avatar_url) ? (
                    <img
                      src={safeSrc(u.avatar_url)!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {(u.full_name || u.handle || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="truncate">
                  {u.full_name || u.handle}
                  {u.handle ? (
                    <span className="ml-1 text-muted-foreground">@{u.handle}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}


        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || sending || (!text.trim() && !file)}
          data-particles="true"
          className="flex w-11 shrink-0 cursor-pointer items-center justify-center self-stretch rounded-md bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
