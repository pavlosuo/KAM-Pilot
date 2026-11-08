import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { CornerUpLeft, Loader2, Lock, Mail, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { ChatComposer, type ReplyTarget } from "@/design-system/ventura-6bef42/components/chat/ChatComposer";
import { ChatMessageBody, stripQuotedReply } from "@/design-system/ventura-6bef42/components/chat/ChatMessageBody";
import {
  listProgramInboxThreads,
  markProgramThreadRead,
  searchProgramMentionUsers,
  sendProgramMemberMessage,
  deleteProgramMessage,
  sendProgramStartupMessage,
  type ProgramInboxThread,
} from "@/design-system/ventura-6bef42/lib/program-comms.functions";

export function ProgramInboxChat({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const load = useServerFn(listProgramInboxThreads);
  const markRead = useServerFn(markProgramThreadRead);
  const sendTeam = useServerFn(sendProgramStartupMessage);
  const sendMember = useServerFn(sendProgramMemberMessage);
  const searchFn = useServerFn(searchProgramMentionUsers);
  const removeMessage = useServerFn(deleteProgramMessage);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryKey = ["program-inbox-threads", slug];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => load({ data: { slug } }),
    refetchInterval: 30_000,
  });

  const threads = useMemo<ProgramInboxThread[]>(() => data?.threads ?? [], [data]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0] ?? null;

  useEffect(() => {
    if (!activeId && threads[0]) setActiveId(threads[0].id);
  }, [threads, activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.id, active?.messages.length]);

  useEffect(() => {
    if (!active || active.unread === 0) return;
    void markRead({
      data: { slug, startupId: active.startupId, senderId: active.personUserId },
    })
      .then(() => qc.invalidateQueries({ queryKey }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.unread]);

  const handleDelete = async (messageId: string) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    setDeletingId(messageId);
    try {
      await removeMessage({ data: { slug, messageId } });
      await qc.invalidateQueries({ queryKey });
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the message");
    } finally {
      setDeletingId(null);
    }
  };

  const submit = async (body: string) => {
    if (!active) return;
    setSending(true);
    try {
      const target = replyTo?.id.startsWith("member:")
        ? replyTo.id.slice(7)
        : active.personUserId;
      if (target) {
        await sendMember({ data: { slug, startupId: active.startupId, userId: target, body } });
      } else {
        await sendTeam({ data: { slug, startupId: active.startupId, body } });
      }
      setReplyTo(null);
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversations…
      </div>
    );
  }

  if (!threads.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
        <Mail className="h-5 w-5" />
        No conversations yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
      <div className="custom-scrollbar max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveId(t.id);
              setReplyTo(null);
            }}
            className={cn(
              "w-full cursor-pointer rounded-lg border p-2.5 text-left transition",
              active?.id === t.id
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-border bg-background/60 hover:bg-muted/50",
            )}
          >
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                {t.kind === "personal" ? t.personName : t.startupName}
              </p>
              {t.unread > 0 ? (
                <Badge className="h-5 border-none bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {t.unread}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {stripQuotedReply(t.messages[t.messages.length - 1]?.body ?? "")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(t.lastMessageAt), { addSuffix: true })}
            </p>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <div
          ref={scrollRef}
          className="custom-scrollbar min-h-[240px] max-h-[340px] flex-1 space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-3"
        >
          {active?.messages.map((m) => (
            <div
              key={m.id}
              className={cn("group flex", m.fromProgram ? "justify-end" : "justify-start")}
            >
              <div className="max-w-[85%] space-y-1">
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                    m.fromProgram
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  <ChatMessageBody body={m.body} />
                  {m.attachmentName ? (
                    <a
                      href={m.attachmentHref ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                        m.fromProgram
                          ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <span className="truncate">📎 {m.attachmentName}</span>
                    </a>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] text-muted-foreground",
                    m.fromProgram ? "justify-end" : "justify-start",
                  )}
                >
                  <span>
                    {m.senderName} ·{" "}
                    {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </span>
                  {m.fromProgram ? (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1 px-1.5 py-0 text-[10px] font-medium"
                    >
                      {m.audience === "personal" ? (
                        <>
                          <Lock className="h-2.5 w-2.5" /> Personal
                        </>
                      ) : (
                        <>
                          <Users className="h-2.5 w-2.5" /> Whole team
                        </>
                      )}
                    </Badge>
                  ) : m.audience === "personal" ? (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1 px-1.5 py-0 text-[10px] font-medium"
                    >
                      <Lock className="h-2.5 w-2.5" /> Private to sender
                    </Badge>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setReplyTo({
                        id: m.fromProgram ? m.id : `member:${m.senderId}`,
                        author: m.senderName,
                        body: m.body,
                      })
                    }
                    className="cursor-pointer opacity-0 transition hover:text-foreground group-hover:opacity-100"
                    aria-label="Reply"
                  >
                    <CornerUpLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === m.id}
                    onClick={() => void handleDelete(m.id)}
                    className="cursor-pointer opacity-70 transition hover:text-destructive hover:opacity-100 disabled:opacity-40"
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                </div>
              </div>
            </div>
          ))}
        </div>

        {active?.kind === "personal" ? (
          <p className="text-[11px] text-muted-foreground">
            Private conversation — only {active.personName} sees these messages.
          </p>
        ) : replyTo?.id.startsWith("member:") ? (
          <p className="text-[11px] text-muted-foreground">
            This reply goes only to {replyTo.author}. Cancel the reply to message the whole team.
          </p>
        ) : null}

        <ChatComposer
          onSubmit={submit}
          sending={sending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={
            active
              ? active.kind === "personal"
                ? `Private message to ${active.personName}…`
                : `Message ${active.startupName}…`
              : "Select a conversation"
          }
          disabled={!active}
          searchMentions={async (q) => {
            if (!active) return [];
            const res = await searchFn({ data: { slug, startupId: active.startupId, q } });
            return res.users;
          }}
        />
      </div>
    </div>
  );
}
