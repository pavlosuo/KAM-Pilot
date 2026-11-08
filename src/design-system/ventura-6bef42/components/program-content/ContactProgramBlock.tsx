import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarDays,
  CornerUpLeft,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Megaphone,
  MessageSquare,
  Paperclip,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { InfoHint } from "@/design-system/ventura-6bef42/components/program-content/InfoHint";
import { Skeleton } from "@/design-system/ventura-6bef42/components/ui/skeleton";
import { ChatComposer, type ReplyTarget } from "@/design-system/ventura-6bef42/components/chat/ChatComposer";
import { ChatMessageBody } from "@/design-system/ventura-6bef42/components/chat/ChatMessageBody";
import { searchMentionUsers } from "@/design-system/ventura-6bef42/lib/video-engagement.functions";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import {
  sendMessageToProgram,
} from "@/design-system/ventura-6bef42/lib/program-founder.functions";
import { getProgramThread, type ProgramThreadItem } from "@/design-system/ventura-6bef42/lib/program-thread.functions";
import { deleteMyMessage } from "@/design-system/ventura-6bef42/lib/message-delete.functions";

const BROADCAST_ICONS = {
  announcement: Megaphone,
  event: CalendarDays,
  document: FileText,
} as const;

function PinnedBroadcast({
  item,
  onSelect,
}: {
  item: ProgramThreadItem;
  onSelect?: (item: ProgramThreadItem) => void;
}) {
  const Icon = BROADCAST_ICONS[item.kind as keyof typeof BROADCAST_ICONS];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(item);
        }
      }}
      className="relative cursor-pointer rounded-lg border border-border/70 bg-card/60 p-2.5 transition hover:border-primary/40 hover:shadow-md"
      aria-label={`Open ${item.title ?? "announcement"}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.title?.replace(/^📌\s*/u, "") || ""}</p>
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {item.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function ThreadEntry({
  item,
  onReply,
  onDelete,
  deleting,
  onSelectBroadcast,
}: {
  item: ProgramThreadItem;
  onReply?: (t: ReplyTarget) => void;
  onDelete?: (id: string) => void;
  deleting?: boolean;
  onSelectBroadcast?: (item: ProgramThreadItem) => void;
}) {
  const time = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  if (item.pinned && !(item.kind === "sent" || item.kind === "reply")) {
    return <PinnedBroadcast item={item} onSelect={onSelectBroadcast} />;
  }

  if (item.kind === "sent" || item.kind === "reply") {
    const mine = item.kind === "sent";
    return (
      <div className={cn("group flex", mine ? "justify-end" : "justify-start")}>
        <div className="max-w-[85%] space-y-1">
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
              mine
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-muted text-foreground",
            )}
          >
            <ChatMessageBody body={item.body} />
            {item.attachmentName ? (
              <a
                href={item.attachmentHref ?? "#"}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                  mine
                    ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.attachmentName}</span>
              </a>
            ) : null}
          </div>
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground",
              mine ? "justify-end" : "justify-start",
            )}
          >
            <span className="shrink-0">
              {item.author} · {time}
            </span>
            {item.audience ? (
              <Badge
                variant="secondary"
                className="flex shrink-0 items-center gap-1 whitespace-nowrap px-1.5 py-0 text-[10px] font-medium"
              >
                {item.audience === "personal" ? (
                  <>
                    <Lock className="h-2.5 w-2.5" /> Only you
                  </>
                ) : (
                  <>
                    <Users className="h-2.5 w-2.5" /> Whole team
                  </>
                )}
              </Badge>
            ) : null}
            {onReply ? (
              <button
                type="button"
                onClick={() => onReply({ id: item.id, author: item.author, body: item.body })}
                className="cursor-pointer opacity-100 transition hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                aria-label="Reply"
              >
                <CornerUpLeft className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onDelete && item.author === "You" ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(item.id)}
                className="cursor-pointer transition hover:text-destructive disabled:opacity-40"
                aria-label="Delete message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const Icon = BROADCAST_ICONS[item.kind];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectBroadcast?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectBroadcast?.(item);
        }
      }}
      className="flex cursor-pointer gap-2.5 rounded-lg border border-border/70 bg-card/60 p-2.5 transition hover:border-primary/40 hover:shadow-md"
      aria-label={`Open ${item.title ?? "announcement"}`}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {item.body}
        </p>
        {item.href ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.downloadHref ? (
              <a
                href={item.downloadHref}
                download
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-3 w-3" /> Download
              </a>
            ) : null}
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          </div>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {item.author} · {time}
        </p>
      </div>
    </div>
  );
}

function BroadcastDialog({
  item,
  onClose,
}: {
  item: ProgramThreadItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const Icon = BROADCAST_ICONS[item.kind as keyof typeof BROADCAST_ICONS];
  const time = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-left text-base">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="flex-1">{item.title?.replace(/^📌\s*/u, "") || ""}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {item.body}
          </p>
          {item.href ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {item.downloadHref ? (
                <a
                  href={item.downloadHref}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
              ) : null}
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            </div>
          ) : null}
          <p className="mt-4 text-[11px] text-muted-foreground">
            {item.author} · {time}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ContactProgramBlock({
  startupId,
  programId,
  programName,
}: {
  startupId: string;
  programId: string;
  programName: string;
}) {
  const qc = useQueryClient();
  const send = useServerFn(sendMessageToProgram);
  const loadThread = useServerFn(getProgramThread);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [privateMode, setPrivateMode] = useState(false);
  const searchMentions = useServerFn(searchMentionUsers);
  const removeMessage = useServerFn(deleteMyMessage);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<ProgramThreadItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { session, loading: authLoading } = useAuth();
  const queryKey = ["program-thread", startupId, programId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      // Make sure a (refreshed) token exists before hitting the protected server fn.
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return { items: [] as ProgramThreadItem[] };
      return loadThread({ data: { startupId, programId } });
    },
    enabled: Boolean(session?.access_token),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 10_000,
  });

  const items = data?.items ?? [];
  const pinnedItems = items.filter((i) => i.pinned);
  const regularItems = items.filter((i) => !i.pinned);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, isLoading]);

  const handleDelete = async (itemId: string) => {
    const messageId = itemId.replace(/^msg-/, "");
    if (!window.confirm("Delete this message?")) return;
    setDeletingId(itemId);
    try {
      await removeMessage({ data: { messageId } });
      await qc.invalidateQueries({ queryKey });
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the message");
    } finally {
      setDeletingId(null);
    }
  };

  const submit = async (text: string, file?: File | null) => {
    if (!text.trim() && !file) return;
    setBusy(true);
    try {
      let attachment: { fileName: string; mimeType: string; fileBase64: string } | null = null;
      if (file) {
        const buffer = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        attachment = {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBase64: btoa(binary),
        };
      }
      await send({
        data: {
          startupId,
          programId,
          body: text,
          visibility: privateMode ? "private" : "team",
          attachment,
        },
      });
      setReplyTo(null);
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the message");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="min-h-[68px] justify-center pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="hidden md:inline">{programName} conversation</span>
              <span className="md:hidden">Conversation</span>
              <InfoHint text="Messages, announcements, events and documents — all in one thread." />
            </CardTitle>
          </div>
          <button
            type="button"
            onClick={() => setPrivateMode((v) => !v)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
              privateMode
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={privateMode}
          >
            <Lock className="h-3 w-3" />
            <span className="hidden sm:inline">
              {privateMode ? "Private — only program leads" : "Visible to your team"}
            </span>
            <span className="sm:hidden">{privateMode ? "Private" : "Team"}</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div
          ref={scrollRef}
          className="custom-scrollbar min-h-[140px] max-h-[30vh] flex-1 space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-background/40 p-3"
        >
          {isLoading || authLoading ? (
            <>
              <Skeleton className="h-12 w-3/4 rounded-xl" />
              <Skeleton className="ml-auto h-12 w-2/3 rounded-xl" />
              <Skeleton className="h-12 w-3/4 rounded-xl" />
            </>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet. Say hello to the {programName} team.
            </p>
          ) : (
            <>
              {pinnedItems.length > 0 ? (
                <div className="sticky -top-3 z-10 -mx-3 -mt-3 space-y-2 border-b border-border/60 bg-background/85 px-3 py-2 backdrop-blur-md">
                  {pinnedItems.map((item) => (
                    <ThreadEntry
                      key={item.id}
                      item={item}
                      onSelectBroadcast={setSelectedBroadcast}
                    />
                  ))}
                </div>
              ) : null}
              {regularItems.map((item) => (
                <ThreadEntry
                  key={item.id}
                  item={item}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                  deleting={deletingId === item.id}
                  onSelectBroadcast={setSelectedBroadcast}
                />
              ))}
            </>
          )}
        </div>



        <ChatComposer
          onSubmit={submit}
          sending={busy}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          allowAttachments
          placeholder={
            privateMode
              ? "Private message — your teammates won't see this…"
              : "Write a message to the program leads…"
          }
          searchMentions={async (q) => (await searchMentions({ data: { q } })).users}
        />
      </CardContent>
      <BroadcastDialog
        item={selectedBroadcast}
        onClose={() => setSelectedBroadcast(null)}
      />
    </Card>
  );
}
