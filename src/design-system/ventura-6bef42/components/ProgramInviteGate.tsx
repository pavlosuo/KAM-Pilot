import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import {
  getProgramInvite,
  submitStartupToProgram,
  declineProgramInvite,
} from "@/design-system/ventura-6bef42/lib/program-join.functions";
import { clearPendingProgramInvite, getPendingProgramInvite } from "@/design-system/ventura-6bef42/lib/program-invite-storage";

type Invite = Awaited<ReturnType<typeof getProgramInvite>>;

export function ProgramInviteGate() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchInvite = useServerFn(getProgramInvite);
  const accept = useServerFn(submitStartupToProgram);
  const decline = useServerFn(declineProgramInvite);

  const [invite, setInvite] = useState<Invite | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"confirm" | "pick">("confirm");

  useEffect(() => {
    if (loading || !user) return;
    // Don't interrupt sign-up / onboarding: the invite stays pending until the
    // founder lands in the app with a startup profile.
    const blocked = [
      "/program-join/",
      "/auth",
      "/login",
      "/post-auth",
      "/reset-password",
      "/founder-onboarding",
      "/invite/accept",
    ];
    if (blocked.some((p) => pathname.startsWith(p))) return;
    const pending = getPendingProgramInvite();
    if (!pending) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchInvite({ data: { token: pending } });
        if (cancelled) return;
        if (!res.valid) {
          clearPendingProgramInvite();
          return;
        }
        setToken(pending);
        setInvite(res);
        setStep("confirm");
        setOpen(true);
      } catch {
        /* ignore — retry on next navigation */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, pathname, fetchInvite]);

  if (!invite?.valid || !token) return null;

  const published = invite.startups.filter((s) => s.is_published);
  const alreadyIn = new Set(invite.alreadySubmitted);
  const program = invite.program!;

  async function onAccept(startupId: string) {
    setBusy(true);
    try {
      await accept({ data: { token: token!, startupId } });
      clearPendingProgramInvite();
      setOpen(false);
      await queryClient.invalidateQueries();
      toast.success(`You joined ${program.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join the program");
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    setBusy(true);
    try {
      await decline({ data: { token: token! } });
    } catch {
      /* ignore */
    } finally {
      clearPendingProgramInvite();
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <DialogContent className="sm:max-w-md">
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {program.logoUrl ? (
                  <img
                    src={program.logoUrl}
                    alt={`${program.name} logo`}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted" />
                )}
                <DialogTitle>Want to join {program.name}?</DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                {program.description ||
                  `${program.name} invited you to join their program on Ventura. If you join, the program team can follow your startup and see your full weekly updates.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={onDecline}
              >
                Decline
              </Button>
              <Button
                className="cursor-pointer"
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                Join
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choose a startup</DialogTitle>
              <DialogDescription>
                {published.length > 0
                  ? "Select which startup joins the program."
                  : "You need a published startup profile before you can join. Publish one and we'll ask you again."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {published.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {s.logo_url ? (
                      <img
                        src={s.logo_url}
                        alt={`${s.name} logo`}
                        className="h-9 w-9 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-muted" />
                    )}
                    <p className="truncate text-sm font-medium">{s.name}</p>
                  </div>
                  <Button
                    size="sm"
                    className="cursor-pointer"
                    disabled={busy || alreadyIn.has(s.id)}
                    onClick={() => onAccept(s.id)}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : alreadyIn.has(s.id) ? (
                      "Joined"
                    ) : (
                      "Join"
                    )}
                  </Button>
                </div>
              ))}
            </div>

            {published.length === 0 && (
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Later
                </Button>
                <Button
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    void navigate({ to: "/startups/new" });
                  }}
                >
                  Create startup profile
                </Button>
              </DialogFooter>
            )}


          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

