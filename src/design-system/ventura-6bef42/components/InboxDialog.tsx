"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { BellRing, CalendarDays, Download, ExternalLink, FileText, Loader2, Mail, Megaphone, MessageSquare, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Skeleton } from "@/design-system/ventura-6bef42/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system/ventura-6bef42/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ventura-6bef42/components/ui/avatar";
import { ChatComposer, type ReplyTarget } from "@/design-system/ventura-6bef42/components/chat/ChatComposer";
import { ChatMessageBody, stripQuotedReply } from "@/design-system/ventura-6bef42/components/chat/ChatMessageBody";
import { CommentsDialog } from "@/design-system/ventura-6bef42/components/CommentsDialog";
import { getInbox, markInboxThreadRead, sendInboxMessage, type InboxItem, type InboxThread } from "@/design-system/ventura-6bef42/lib/inbox.functions";
import { searchMentionUsers } from "@/design-system/ventura-6bef42/lib/video-engagement.functions";
import { deleteMyMessage } from "@/design-system/ventura-6bef42/lib/message-delete.functions";
import { fileToBase64 } from "@/design-system/ventura-6bef42/lib/download";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";

const ICONS: Record<InboxItem["kind"], React.ComponentType<{ className?: string }>> = {
  comment: MessageSquare,
  message: Mail,
  announcement: Megaphone,
  event: CalendarDays,
  document: FileText,
  alert: BellRing,
};
const LABELS: Record<InboxItem["kind"], string> = {
  comment: "Comment", message: "Message", announcement: "Announcement", event: "Event", document: "Document", alert: "Alert",
};

export function InboxDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { role } = useAuth();
  const qc = useQueryClient();
  const load = useServerFn(getInbox);
  const markRead = useServerFn(markInboxThreadRead);
  const send = useServerFn(sendInboxMessage);
  const search = useServerFn(searchMentionUsers);
  const remove = useServerFn(deleteMyMessage);
  const queryKey = ["inbox"] as const;
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => load(), enabled: open, staleTime: 15_000, refetchInterval: open ? 30_000 : false });
  const threads = useMemo(() => data?.threads ?? [], [data]);
  const programThreads = useMemo(() => data?.programThreads ?? [], [data]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [programActiveId, setProgramActiveId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [sending, setSending] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string } | null>(null);
  const [tabSeen, setTabSeen] = useState<Record<string, number>>({});
  useEffect(() => {
    try { const raw = window.localStorage.getItem("ventura-inbox-tab-seen"); if (raw) setTabSeen(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = threads.find((thread) => thread.id === activeId) ?? threads[0] ?? null;
  const activeProgram = programThreads.find((thread) => thread.id === programActiveId) ?? programThreads[0] ?? null;

  useEffect(() => { if (!activeId && threads[0]) setActiveId(threads[0].id); }, [activeId, threads]);
  useEffect(() => { if (!programActiveId && programThreads[0]) setProgramActiveId(programThreads[0].id); }, [programActiveId, programThreads]);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [active?.id, active?.messages.length]);
  useEffect(() => { if (!open || !active || active.unread === 0) return;
    void markRead({ data: { startupId: active.startupId, personId: active.personId } }).then(() => qc.invalidateQueries({ queryKey })).catch(() => undefined);
  }, [active?.id, active?.unread, open]);
  useEffect(() => {
    if (!open || !activeProgram || activeProgram.unread === 0) return;
    void markRead({ data: { startupId: activeProgram.startupId, personId: activeProgram.personId } }).then(() => qc.invalidateQueries({ queryKey })).catch(() => undefined);
  }, [activeProgram?.id, activeProgram?.unread, open]);
  // Opening the inbox shows the Messages tab by default; opening a tab clears its red counter
  // until newer activity arrives (per-tab seen timestamp).
  useEffect(() => { if (open) markTabSeen("messages"); }, [open]);
  const markTabSeen = (tab: string) => setTabSeen((prev) => {
    const next = { ...prev, [tab]: Date.now() };
    try { window.localStorage.setItem("ventura-inbox-tab-seen", JSON.stringify(next)); window.dispatchEvent(new Event("ventura-inbox-seen")); } catch { /* ignore */ }
    return next;
  });

  const submitTo = async (thread: InboxThread | null, body: string, file?: File | null) => {
    if (!thread || !role) return;
    setSending(true);
    try {
      await send({ data: { startupId: thread.startupId, recipientId: thread.personId, senderRole: role, body, attachment: file ? { fileName: file.name, mimeType: file.type || "application/octet-stream", fileBase64: await fileToBase64(file) } : null } });
      setReplyTo(null);
      await qc.invalidateQueries({ queryKey });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not send the message"); }
    finally { setSending(false); }
  };

  const programItems = data?.items ?? [];
  const commentGroups = data?.commentGroups ?? [];
  // A tab's red counter clears once that tab has been viewed; it reappears only for newer activity.
  const seenOf = (tab: string) => tabSeen[tab] ?? 0;
  const directUnread = threads.filter((t) => {
    if (!t.unread) return false;
    const last = t.messages[t.messages.length - 1];
    return !last || Date.parse(last.createdAt) > seenOf("messages");
  }).length;
  const programUnread = programItems.filter((item) => Date.parse(item.createdAt) > seenOf("program")).length;
  const commentUnread = commentGroups.filter((group) => Date.parse(group.latestAt) > seenOf("comments")).length;
  const showProgramTab = data?.showProgramTab ?? false;
  const showCommentsTab = data?.showCommentsTab ?? false;
  const tabCount = 1 + Number(showProgramTab) + Number(showCommentsTab);

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(780px,88vh)] w-[min(1040px,94vw)] max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Inbox</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="messages" onValueChange={(v) => markTabSeen(v)} className="flex min-h-0 flex-1 flex-col">
          {tabCount > 1 ? <TabsList className={cn("mx-5 mt-3 grid w-auto", tabCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
            <TabsTrigger value="messages">Messages {directUnread ? <InboxCount count={directUnread} /> : null}</TabsTrigger>
            {showProgramTab ? <TabsTrigger value="program">Program {programUnread ? <InboxCount count={programUnread} /> : null}</TabsTrigger> : null}
            {showCommentsTab ? <TabsTrigger value="comments">Comments {commentUnread ? <InboxCount count={commentUnread} /> : null}</TabsTrigger> : null}
          </TabsList> : null}
          <TabsContent value="messages" className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-3">
            {isLoading ? <LoadingRows /> : !threads.length ? <Empty icon={Mail} text="No conversations yet." /> : (
              <div className="grid h-full min-h-0 gap-3 md:grid-cols-[minmax(210px,280px)_minmax(0,1fr)]">
                <div className="custom-scrollbar max-h-48 space-y-1.5 overflow-y-auto pr-1 md:max-h-none">
                  {threads.map((thread) => <ThreadButton key={thread.id} thread={thread} active={active?.id === thread.id} onClick={() => { setActiveId(thread.id); setReplyTo(null); }} />)}
                </div>
                <div className="flex min-h-0 flex-col gap-3">
                  {active ? <div className="flex items-center gap-2 border-b pb-2"><Avatar className="h-8 w-8"><AvatarImage src={safeSrc(active.personAvatar) ?? undefined} /><AvatarFallback>{active.personName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-semibold">{active.personName}</p>{active.startupName && active.startupName !== active.personName ? <p className="truncate text-xs text-muted-foreground">{active.startupName}</p> : null}</div></div> : null}
                  <div ref={scrollRef} className="custom-scrollbar min-h-[180px] flex-1 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
                    {active?.messages.map((message) => <div key={message.id} className={cn("group flex", message.mine ? "justify-end" : "justify-start")}><div className="max-w-[86%] space-y-1"><div className={cn("rounded-xl px-3 py-2 text-sm", message.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}><ChatMessageBody body={message.body} />{message.attachmentName ? <a href={message.attachmentHref ?? "#"} target="_blank" rel="noreferrer" className="mt-2 flex max-w-full items-center gap-1.5 rounded-md border border-current/20 px-2 py-1 text-xs"><Paperclip className="h-3 w-3" /><span className="truncate">{message.attachmentName}</span></a> : null}</div><div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", message.mine && "justify-end")}><span>{message.senderName} · {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" aria-label="Reply" onClick={() => setReplyTo({ id: message.id, author: message.senderName, body: message.body })}>↩</Button>{message.mine ? <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" aria-label="Delete message" onClick={async () => { if (!window.confirm("Delete this message?")) return; try { await remove({ data: { messageId: message.id } }); await qc.invalidateQueries({ queryKey }); } catch { toast.error("Could not delete the message"); } }}>×</Button> : null}</div></div></div>)}
                  </div>
                  <ChatComposer onSubmit={(body, file) => submitTo(active, body, file)} sending={sending} disabled={!active} allowAttachments replyTo={replyTo} onCancelReply={() => setReplyTo(null)} placeholder={active ? `Message ${active.personName}…` : "Select a conversation"} searchMentions={async (q) => (await search({ data: { q } })).users} />
                </div>
              </div>
            )}
          </TabsContent>
          {showProgramTab ? <TabsContent value="program" className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
            {isLoading ? <LoadingRows /> : !programThreads.length && !programItems.length ? <Empty icon={Megaphone} text="No program updates yet." /> : <div className="space-y-5">
              {programThreads.length ? <div className="grid min-h-[360px] gap-3 md:grid-cols-[minmax(210px,280px)_minmax(0,1fr)]"><div className="custom-scrollbar max-h-48 space-y-1.5 overflow-y-auto pr-1 md:max-h-[480px]">{programThreads.map((thread) => <ThreadButton key={thread.id} thread={thread} active={activeProgram?.id === thread.id} onClick={() => { setProgramActiveId(thread.id); setReplyTo(null); }} />)}</div><div className="flex min-h-0 flex-col gap-3"><div className="custom-scrollbar min-h-[210px] max-h-[360px] flex-1 space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">{activeProgram?.messages.map((message) => <div key={message.id} className={cn("flex", message.mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[86%] rounded-xl px-3 py-2 text-sm", message.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}><ChatMessageBody body={message.body} />{message.attachmentName ? <a href={message.attachmentHref ?? "#"} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs underline"><Paperclip className="h-3 w-3" />{message.attachmentName}</a> : null}<p className="mt-1 text-[11px] opacity-70">{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</p></div></div>)}</div><ChatComposer onSubmit={(body, file) => submitTo(activeProgram, body, file)} sending={sending} disabled={!activeProgram} allowAttachments placeholder={activeProgram ? `Message ${activeProgram.personName}…` : "Select a program"} searchMentions={async (q) => (await search({ data: { q } })).users} /></div></div> : null}
              {programItems.length ? <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Updates and resources</p><div className="space-y-2">{programItems.filter((item) => item.kind !== "message").map((item) => <ProgramItem key={item.id} item={item} />)}</div></div> : null}
            </div>}
          </TabsContent> : null}
          {showCommentsTab ? <TabsContent value="comments" className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
            {isLoading ? <LoadingRows /> : !commentGroups.length ? <Empty icon={MessageSquare} text="No pitch comments yet." /> : <div className="space-y-2">{commentGroups.map((group) => <Button key={group.startupId} variant="outline" className="h-auto w-full justify-start p-3 text-left" onClick={() => setCommentTarget({ id: group.startupId, name: group.startupName })}><MessageSquare className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{group.startupName}</span><span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{group.preview}</span></span><Badge variant="secondary" className="ml-2">{group.count}</Badge></Button>)}</div>}
          </TabsContent> : null}
        </Tabs>
      </DialogContent>
    </Dialog>
    {commentTarget ? <CommentsDialog open={Boolean(commentTarget)} onOpenChange={(next) => { if (!next) setCommentTarget(null); }} startupId={commentTarget.id} startupName={commentTarget.name} /> : null}
  </>;
}

function ThreadButton({ thread, active, onClick }: { thread: InboxThread; active: boolean; onClick: () => void }) {
  const last = thread.messages[thread.messages.length - 1];
  return <Button variant="ghost" onClick={onClick} className={cn("h-auto w-full justify-start rounded-md border p-2.5 text-left", active ? "border-primary/50 bg-primary/5" : "bg-background hover:bg-muted/50")}><Avatar className="mr-2 h-8 w-8"><AvatarImage src={safeSrc(thread.personAvatar) ?? undefined} /><AvatarFallback>{thread.personName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{thread.personName}</span>{thread.unread ? <InboxCount count={thread.unread} className="ml-auto" /> : null}</span><span className="block truncate text-xs font-normal text-muted-foreground">{stripQuotedReply(last?.body ?? "")}</span><span className="block text-[11px] font-normal text-muted-foreground/70">{last ? formatDistanceToNow(new Date(last.createdAt), { addSuffix: true }) : ""}</span></span></Button>;
}

function InboxCount({ count, className }: { count: number; className?: string }) {
  return <Badge variant="destructive" className={cn("ml-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border-0 px-1 text-[10px] leading-none", className)}>{count > 99 ? "99+" : count}</Badge>;
}

function ProgramItem({ item }: { item: InboxItem }) {
  const Icon = ICONS[item.kind];
  return <div className="flex gap-3 rounded-md border p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{item.title}</p><Badge variant="secondary" className="text-[10px]">{LABELS[item.kind]}</Badge></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>{item.href ? <div className="mt-2 flex gap-2"><Button size="sm" asChild><a href={item.downloadHref ?? item.href} download={item.fileName ?? undefined}><Download className="mr-1.5 h-3.5 w-3.5" />Download</a></Button><Button size="sm" variant="outline" asChild><a href={item.href} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open</a></Button></div> : null}<p className="mt-2 text-xs text-muted-foreground">{item.context ? `${item.context} · ` : ""}{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p></div></div>;
}
function LoadingRows() { return <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>; }
function Empty({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) { return <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Icon className="h-5 w-5" />{text}</div>; }
