import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Heart, Smile, Send, Trash2, AtSign } from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import {
  addComment,
  deleteComment,
  listComments,
  searchMentionUsers,
  toggleCommentLike,
  type CommentNode,
} from "@/design-system/ventura-6bef42/lib/video-engagement.functions";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";

type MentionUser = {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

export function CommentsDialog({
  open,
  onOpenChange,
  startupId,
  startupName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startupId: string;
  startupName: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listComments);
  const delFn = useServerFn(deleteComment);
  const likeFn = useServerFn(toggleCommentLike);

  const commentsKey = ["video-comments", startupId] as const;
  const countsKey = ["video-engagement", startupId] as const;

  const { data, isLoading } = useQuery({
    queryKey: commentsKey,
    queryFn: () => listFn({ data: { startupId } }),
    enabled: open,
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey });
      queryClient.invalidateQueries({ queryKey: countsKey });
    },
    onError: () => toast.error("Couldn't delete comment"),
  });

  const likeMutation = useMutation({
    mutationFn: (commentId: string) => likeFn({ data: { commentId } }),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const prev = queryClient.getQueryData<{ comments: CommentNode[] }>(commentsKey);
      if (prev) {
        queryClient.setQueryData(commentsKey, {
          comments: prev.comments.map((c) => toggleLikeIn(c, commentId)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(commentsKey, ctx.prev);
      toast.error("Couldn't update like");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: commentsKey }),
  });

  const comments = data?.comments ?? [];
  const [replyingTo, setReplyingTo] = useState<{ id: string; handle: string | null } | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle>Comments · {startupName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                myUserId={user?.id ?? null}
                onDelete={(id) => delMutation.mutate(id)}
                onLike={(id) => likeMutation.mutate(id)}
                onReply={(id, handle) => setReplyingTo({ id, handle })}
                replyingTo={replyingTo}
                onReplyClose={() => setReplyingTo(null)}
                startupId={startupId}
                commentsKey={commentsKey}
                countsKey={countsKey}
              />
            ))
          )}
        </div>
        <CommentComposer
          startupId={startupId}
          parentId={null}
          disabled={!user}
          onPosted={() => {
            queryClient.invalidateQueries({ queryKey: commentsKey });
            queryClient.invalidateQueries({ queryKey: countsKey });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function toggleLikeIn(node: CommentNode, id: string): CommentNode {
  if (node.id === id) {
    return {
      ...node,
      liked: !node.liked,
      like_count: Math.max(0, node.like_count + (node.liked ? -1 : 1)),
    };
  }
  if (node.replies.length === 0) return node;
  return { ...node, replies: node.replies.map((r) => toggleLikeIn(r, id)) };
}

function CommentItem({
  comment,
  myUserId,
  onDelete,
  onLike,
  onReply,
  replyingTo,
  onReplyClose,
  startupId,
  commentsKey,
  countsKey,
  isReply,
}: {
  comment: CommentNode;
  myUserId: string | null;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReply: (id: string, handle: string | null) => void;
  replyingTo: { id: string; handle: string | null } | null;
  onReplyClose: () => void;
  startupId: string;
  commentsKey: readonly unknown[];
  countsKey: readonly unknown[];
  isReply?: boolean;
}) {
  const queryClient = useQueryClient();
  const name = comment.author.full_name || (comment.author.handle ? `@${comment.author.handle}` : "Founder");
  const avatar = safeSrc(comment.author.avatar_url);
  const isMine = myUserId === comment.user_id;
  const showReplyForm = replyingTo?.id === comment.id;

  return (
    <div className={`flex gap-3 ${isReply ? "ml-11" : ""}`}>
      <div className="h-9 w-9 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
        {avatar ? (
          <img src={avatar} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">
            {name
              .replace(/^@/, "")
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {comment.author.handle ? (
            <Link
              to="/u/$handle"
              params={{ handle: comment.author.handle }}
              className="text-sm font-semibold truncate hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="text-sm font-semibold truncate">{name}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
          {isMine && (
            <button
              onClick={() => onDelete(comment.id)}
              className="ml-auto text-muted-foreground hover:text-destructive transition cursor-pointer"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">
          <CommentBody body={comment.body} />
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={() => myUserId && onLike(comment.id)}
            disabled={!myUserId}
            className={`flex items-center gap-1 text-xs transition cursor-pointer ${
              comment.liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={comment.liked ? "Unlike" : "Like"}
          >
            <Heart className={`h-3.5 w-3.5 ${comment.liked ? "fill-current" : ""}`} />
            {comment.like_count > 0 && (
              <span className="tabular-nums">{comment.like_count}</span>
            )}
          </button>
          {!isReply && (
            <button
              onClick={() =>
                showReplyForm ? onReplyClose() : onReply(comment.id, comment.author.handle)
              }
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              {showReplyForm ? "Cancel" : "Reply"}
            </button>
          )}
        </div>

        {showReplyForm && (
          <div className="mt-2">
            <CommentComposer
              startupId={startupId}
              parentId={comment.id}
              initialText={replyingTo?.handle ? `@${replyingTo.handle} ` : ""}
              disabled={!myUserId}
              autoFocus
              onPosted={() => {
                queryClient.invalidateQueries({ queryKey: commentsKey });
                queryClient.invalidateQueries({ queryKey: countsKey });
                onReplyClose();
              }}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                myUserId={myUserId}
                onDelete={onDelete}
                onLike={onLike}
                onReply={onReply}
                replyingTo={replyingTo}
                onReplyClose={onReplyClose}
                startupId={startupId}
                commentsKey={commentsKey}
                countsKey={countsKey}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentBody({ body }: { body: string }) {
  const parts = useMemo(() => {
    const out: Array<{ type: "text" | "mention"; value: string }> = [];
    const re = /@([a-zA-Z0-9_-]{2,40})/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      if (m.index > last) out.push({ type: "text", value: body.slice(last, m.index) });
      out.push({ type: "mention", value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < body.length) out.push({ type: "text", value: body.slice(last) });
    return out;
  }, [body]);

  return (
    <>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <Link
            key={i}
            to="/u/$handle"
            params={{ handle: p.value }}
            className="text-primary font-medium hover:underline"
          >
            @{p.value}
          </Link>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

function CommentComposer({
  startupId,
  parentId,
  disabled,
  initialText = "",
  autoFocus,
  onPosted,
}: {
  startupId: string;
  parentId: string | null;
  disabled?: boolean;
  initialText?: string;
  autoFocus?: boolean;
  onPosted: () => void;
}) {
  const addFn = useServerFn(addComment);
  const searchFn = useServerFn(searchMentionUsers);
  const [text, setText] = useState(initialText);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const posting = useRef(false);

  const addMutation = useMutation({
    mutationFn: (body: string) => addFn({ data: { startupId, body, parentId } }),
    onSuccess: () => {
      setText("");
      onPosted();
    },
    onError: () => toast.error("Couldn't post comment"),
    onSettled: () => {
      posting.current = false;
    },
  });

  useEffect(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.value.length;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [autoFocus]);

  // Detect @mention token at caret
  const updateMentionState = (value: string, caret: number) => {
    const upto = value.slice(0, caret);
    const match = /(?:^|\s)@([a-zA-Z0-9_-]{0,30})$/.exec(upto);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  };

  useEffect(() => {
    if (mentionQuery === null) return;
    if (mentionQuery.trim().length === 0) {
      setMentionResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchFn({ data: { q: mentionQuery } });
        if (!cancelled) setMentionResults(res.users);
      } catch {
        if (!cancelled) setMentionResults([]);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mentionQuery, searchFn]);

  const insertMention = (u: MentionUser) => {
    if (!u.handle) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/(^|\s)@([a-zA-Z0-9_-]{0,30})$/, `$1@${u.handle} `);
    const next = replaced + after;
    setText(next);
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => {
      if (!el) return;
      const pos = replaced.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleSubmit = () => {
    const body = text.trim();
    if (!body || posting.current) return;
    posting.current = true;
    addMutation.mutate(body);
  };

  return (
    <div className="border-t border-border p-3 shrink-0 relative">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
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
                  insertMention(mentionResults[mentionIndex]);
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
                handleSubmit();
              }
            }}
            onKeyUp={(e) => {
              const t = e.currentTarget;
              updateMentionState(t.value, t.selectionStart ?? t.value.length);
            }}
            onClick={(e) => {
              const t = e.currentTarget;
              updateMentionState(t.value, t.selectionStart ?? t.value.length);
            }}
            placeholder={parentId ? "Write a reply…" : "Add a comment…"}
            maxLength={2000}
            disabled={disabled || addMutation.isPending}
            rows={1}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-[7px] pr-16 text-sm outline-none disabled:opacity-50 min-h-9 max-h-32"
          />
          <div className="absolute right-1.5 bottom-1.5 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const el = textareaRef.current;
                if (!el) return;
                const caret = el.selectionStart ?? text.length;
                const needsSpace = caret > 0 && !/\s/.test(text[caret - 1] ?? "");
                const insert = `${needsSpace ? " " : ""}@`;
                const next = text.slice(0, caret) + insert + text.slice(caret);
                setText(next);
                setTimeout(() => {
                  el.focus();
                  const pos = caret + insert.length;
                  el.setSelectionRange(pos, pos);
                  updateMentionState(next, pos);
                }, 0);
              }}
              disabled={disabled}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Mention someone"
            >
              <AtSign className="h-4 w-4" />
            </button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Insert emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                className="p-0 border-none bg-transparent shadow-none w-auto overflow-visible"
              >
                <div
                  onWheel={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="overflow-y-auto max-h-[320px]"
                >
                  <EmojiPicker
                    onEmojiClick={(e) => {
                      const el = textareaRef.current;
                      const caret = el?.selectionStart ?? text.length;
                      const next = text.slice(0, caret) + e.emoji + text.slice(caret);
                      setText(next);
                      setTimeout(() => {
                        if (!el) return;
                        const pos = caret + e.emoji.length;
                        el.focus();
                        el.setSelectionRange(pos, pos);
                      }, 0);
                    }}
                    emojiStyle={EmojiStyle.NATIVE}
                    theme={Theme.AUTO}
                    height={320}
                    width={320}
                    skinTonesDisabled
                    searchDisabled={false}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-full max-w-xs bg-popover border border-border rounded-md shadow-lg overflow-hidden z-50">
              {mentionResults.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition cursor-pointer ${
                    i === mentionIndex ? "bg-muted" : "hover:bg-muted"
                  }`}
                >
                  <div className="h-7 w-7 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {safeSrc(u.avatar_url) ? (
                      <img
                        src={safeSrc(u.avatar_url)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {(u.full_name || u.handle || "?")
                          .split(/\s+/)
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.full_name || u.handle}</div>
                    {u.handle && (
                      <div className="truncate text-xs text-muted-foreground">@{u.handle}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim() || addMutation.isPending}
          className="h-9 -translate-y-0.5 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Send className="h-4 w-4" />
          Post
        </button>
      </div>
    </div>
  );
}
