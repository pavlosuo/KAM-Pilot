import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ventura-6bef42/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Loader2, UserPlus, Mail, X, Trash2, Users, Pencil, Check } from "lucide-react";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { toast } from "sonner";
import {
  listStartupTeam,
  inviteTeammates,
  revokeStartupInvitation,
  removeStartupMember,
  updateStartupMemberTitle,
} from "@/design-system/ventura-6bef42/lib/startup-team.functions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Member = {
  id: string;
  user_id: string;
  role: string;
  title: string | null;
  name: string | null;
  avatar_url: string | null;
  handle: string | null;
  isCreator?: boolean;
};
type Invitation = { id: string; email: string; status: string; created_at: string };

export function StartupTeamSection({ startupId }: { startupId: string }) {
  const fnList = useServerFn(listStartupTeam);
  const fnInvite = useServerFn(inviteTeammates);
  const fnRevoke = useServerFn(revokeStartupInvitation);
  const fnRemove = useServerFn(removeStartupMember);
  const fnUpdateTitle = useServerFn(updateStartupMemberTitle);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = (await fnList({ data: { startupId } })) as {
        members: Member[];
        invitations: Invitation[];
        isOwner: boolean;
      };
      setMembers(r.members);
      setInvitations(r.invitations);
      setIsOwner(r.isOwner);
    } catch (e) {
      // not fatal — likely not a member
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupId]);

  function addEmail(value: string) {
    const v = value.trim().toLowerCase();
    if (!v) return;
    if (!EMAIL_RE.test(v)) return toast.error(`"${v}" doesn't look like a valid email`);
    if (emails.includes(v)) return;
    setEmails((p) => [...p, v]);
    setDraft("");
  }

  async function sendInvites() {
    const all = draft.trim() ? [...emails, draft.trim().toLowerCase()] : emails;
    const valid = Array.from(new Set(all)).filter((e) => EMAIL_RE.test(e));
    if (valid.length === 0) return toast.error("Add at least one email");
    setBusy(true);
    try {
      const res = (await fnInvite({ data: { startupId, emails: valid } })) as {
        results: { email: string; status: string }[];
      };
      const sent = res.results.filter((r) => r.status === "sent").length;
      if (sent) toast.success(`Invited ${sent} teammate${sent === 1 ? "" : "s"}`);
      setEmails([]);
      setDraft("");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invitations");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await fnRevoke({ data: { id } });
      toast.success("Invitation revoked");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke");
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await fnRemove({ data: { startupId, userId } });
      toast.success("Member removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  }

  function startEditTitle(m: Member) {
    setEditingId(m.id);
    setEditDraft(m.title ?? "");
  }

  async function saveTitle(memberId: string) {
    setSavingId(memberId);
    try {
      const value = editDraft.trim();
      await fnUpdateTitle({ data: { startupId, memberId, title: value || null } });
      setMembers((prev) => prev.map((x) => (x.id === memberId ? { ...x, title: value || null } : x)));
      setEditingId(null);
      setEditDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update title");
    } finally {
      setSavingId(null);
    }
  }

  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Team
            </h2>
          </div>
          {isOwner && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={members.length + pending.length >= 6}>
                  <UserPlus className="h-3.5 w-3.5" /> Invite teammate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite teammates</DialogTitle>
                  <DialogDescription>
                    Enter their emails. They'll get a link to join this startup on Ventura.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-border focus-within:border-primary/60 bg-muted/30 p-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    {emails.map((e) => (
                      <span
                        key={e}
                        className="inline-flex items-center gap-1.5 rounded-full bg-background border px-2.5 py-1 text-xs font-medium shadow-sm"
                      >
                        {e}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setEmails((p) => p.filter((x) => x !== e))}
                          aria-label={`Remove ${e}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "," || e.key === " ") {
                          e.preventDefault();
                          addEmail(draft);
                        } else if (e.key === "Backspace" && !draft && emails.length > 0) {
                          setEmails((p) => p.slice(0, -1));
                        }
                      }}
                      onBlur={() => draft && addEmail(draft)}
                      placeholder={emails.length === 0 ? "teammate@example.com" : "Add another…"}
                      className="flex-1 min-w-[180px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Press Enter, comma or space to add.</p>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={sendInvites} disabled={busy || (emails.length === 0 && !draft.trim())}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invites"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teammates yet. Invite co-founders or teammates to show them here.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3"
                  >
                    <Avatar className="h-10 w-10">
                      {m.avatar_url ? <AvatarImage src={m.avatar_url} alt={m.name ?? ""} /> : null}
                      <AvatarFallback>{(m.name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      {m.handle ? (
                        <Link
                          to="/u/$handle"
                          params={{ handle: m.handle }}
                          className="font-medium text-sm hover:underline truncate block"
                        >
                          {m.name ?? m.handle}
                        </Link>
                      ) : (
                        <p className="font-medium text-sm truncate">{m.name ?? "Teammate"}</p>
                      )}
                      {editingId === m.id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); void saveTitle(m.id); }
                              if (e.key === "Escape") { setEditingId(null); setEditDraft(""); }
                            }}
                            placeholder="Title (e.g. CTO, Designer)"
                            className="h-7 text-xs"
                            maxLength={80}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={savingId === m.id}
                            onClick={() => void saveTitle(m.id)}
                          >
                            {savingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {m.title ?? <span className="capitalize">{m.role}</span>}
                          </p>
                          {isOwner && !m.id.startsWith("owner-") && (
                            <button
                              type="button"
                              onClick={() => startEditTitle(m)}
                              className="text-muted-foreground/70 hover:text-foreground"
                              title={m.title ? "Edit title" : "Add title"}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isOwner && editingId !== m.id && !m.isCreator && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(m.user_id)}
                        title="Remove from team"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isOwner && pending.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pending invitations
                </h3>
                <ul className="space-y-1.5">
                  {pending.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">{inv.email}</span>
                      <Badge variant="secondary" className="text-xs">
                        Pending
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(inv.id)}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
