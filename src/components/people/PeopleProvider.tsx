import { useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/alert-dialog";
import { audienceLabel, type Avatar } from "@/lib/engine/avatars";
import { autoDownload } from "@/lib/export/auto-download";
import { useAccount } from "@/lib/state/account-context";
import { usePreferences } from "@/lib/state/preferences-store";
import { NewPersonDialog } from "./NewPersonDialog";

interface PeopleApi {
  /** Opens "New report for another person". */
  openNewPerson: () => void;
  /** Opens the same pop-up for an existing person, to add a LinkedIn link or files and refresh their profile. */
  openUpdatePerson: (person: Avatar) => void;
  /** Re-builds the Recap and dashboard for this person and downloads their PowerPoint when ready. */
  generateFor: (person: Avatar) => void;
  /** Asks, then removes every saved person and report and opens the report studio. */
  startOver: () => void;
}

const Ctx = createContext<PeopleApi | null>(null);

export function PeopleProvider({ children }: { children: ReactNode }) {
  const a = useAccount();
  const prefs = usePreferences();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState<Avatar | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { update, slug } = a;

  const generateFor = useCallback(
    (person: Avatar) => {
      const label = audienceLabel(person);
      const toastId = `person-pptx-${person.id}`;
      toast.loading(`Preparing ${label}'s PowerPoint…`, { id: toastId, duration: Infinity });
      autoDownload.request({ avatarId: person.id, label, toastId });
      // Only the person changes; the company's "What matters most" stays as the KAM set it.
      update({ avatarId: person.id, countries: person.country ? [person.country] : [], pickedObservationIds: null });
      setOpen(false);
      void navigate({ to: "/account/$account/recap", params: { account: slug } });
    },
    [update, navigate, slug],
  );

  const api = useMemo<PeopleApi>(() => ({ openNewPerson: () => setOpen(true), openUpdatePerson: (p) => setUpdating(p), generateFor, startOver: () => setConfirm(true) }), [generateFor]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <NewPersonDialog open={open} onOpenChange={setOpen} onGenerate={generateFor} />
      <NewPersonDialog open={!!updating} onOpenChange={(o) => !o && setUpdating(null)} onGenerate={generateFor} existing={updating} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl text-lind-navy">Start a new report?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">All saved people and reports will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Keep them
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirm(false);
                autoDownload.clear();
                prefs.resetReports();
                void navigate({ to: "/" });
              }}
            >
              Start over
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function usePeople(): PeopleApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeople must be used within PeopleProvider");
  return ctx;
}
