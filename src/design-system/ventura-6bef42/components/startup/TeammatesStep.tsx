import { useState } from "react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Loader2, Users, User, Mail, X, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { inviteTeammates } from "@/design-system/ventura-6bef42/lib/startup-team.functions";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TeammatesStep({
  startupId,
  onBack,
  onContinue,
}: {
  startupId: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "invite" | "sent">("choose");
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentEmails, setSentEmails] = useState<string[]>([]);
  const fnInvite = useServerFn(inviteTeammates);

  function addEmail(value: string) {
    const v = value.trim().toLowerCase();
    if (!v) return;
    if (!EMAIL_RE.test(v)) {
      toast.error(`"${v}" doesn't look like a valid email`);
      return;
    }
    if (emails.includes(v)) return;
    setEmails((prev) => [...prev, v]);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail(draft);
    } else if (e.key === "Backspace" && !draft && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  async function sendInvites() {
    const all = draft.trim() ? [...emails, draft.trim().toLowerCase()] : emails;
    const valid = Array.from(new Set(all)).filter((e) => EMAIL_RE.test(e));
    if (valid.length === 0) {
      toast.error("Add at least one email");
      return;
    }
    setBusy(true);
    try {
      const res = (await fnInvite({ data: { startupId, emails: valid } })) as {
        results: { email: string; status: string }[];
      };
      const sent = res.results.filter((r) => r.status === "sent" || r.status === "already_invited").map((r) => r.email);
      const members = res.results.filter((r) => r.status === "already_member").map((r) => r.email);
      const errors = res.results.filter((r) => r.status === "error");
      if (sent.length) toast.success(`Invited ${sent.length} teammate${sent.length === 1 ? "" : "s"}`);
      if (members.length) toast.info(`${members.length} already on the team`);
      errors.forEach((e) => toast.error(`Could not invite ${e.email}`));
      setSentEmails(valid);
      setMode("sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invitations");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "choose") {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold">Do you have teammates?</h3>
            <p className="text-sm text-muted-foreground">
              Invite co-founders or teammates now and they'll appear on your startup's team page after they accept.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <ChoiceCard
              icon={<Users className="h-5 w-5" />}
              title="Yes, I have teammates"
              description="Send them an email invitation to join this startup."
              accent
              onClick={() => setMode("invite")}
            />
            <ChoiceCard
              icon={<User className="h-5 w-5" />}
              title="No, it's just me"
              description="Continue solo — you can invite teammates later."
              onClick={onContinue}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>Back</Button>
            <div />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "invite") {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Invite your teammates</h3>
              <p className="text-sm text-muted-foreground">
                Enter their emails. We'll send each of them a link to join this startup on Ventura.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Teammates' emails</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-border focus-within:border-primary/60 hover:border-primary/40 bg-muted/30 p-3 transition-colors">
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
                    onClick={() => setEmails((prev) => prev.filter((x) => x !== e))}
                    aria-label={`Remove ${e}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => draft && addEmail(draft)}
                placeholder={emails.length === 0 ? "teammate@example.com" : "Add another…"}
                className="flex-1 min-w-[200px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter, comma or space to add. Up to 25 invites at once.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onContinue} disabled={busy}>
                Skip for now
              </Button>
              <Button onClick={sendInvites} disabled={busy || (emails.length === 0 && !draft.trim())}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send invites <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // sent
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Invitations on their way</h3>
            <p className="text-sm text-muted-foreground">
              Your teammates will appear in the Team section once they accept.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
          {sentEmails.map((e) => (
            <div key={e} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>{e}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={onContinue}>
            Continue to startup draft <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left rounded-2xl border-2 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        accent
          ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`rounded-lg p-2 ${accent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {icon}
        </div>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <ArrowRight className="absolute top-5 right-5 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
