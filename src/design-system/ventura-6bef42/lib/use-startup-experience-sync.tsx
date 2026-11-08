import { useCallback, useState } from "react";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/alert-dialog";
import { toast } from "sonner";

type Side = "experience" | "startup";
type Changes = { name?: string; logo_url?: string | null };

type StartupMatch = { id: string; name: string; logo_url: string | null };
type ExperienceMatch = { id: string; company: string; logo_url: string | null };

type Pending = {
  side: Side;
  changes: Changes;
  startupMatches: StartupMatch[];
  experienceMatches: ExperienceMatch[];
};

/**
 * Bidirectional sync between a startup's experience entry and the user's
 * published startup profile when their names match (case-insensitive, trimmed).
 * Shows a confirmation dialog before propagating the change to the linked side.
 *
 * Usage:
 *   const { maybeSync, SyncConfirmDialog } = useStartupExperienceSync();
 *   // after saving your primary side:
 *   await maybeSync({ side: "experience", matchName: oldCompany, changes: { name: newName, logo_url } });
 *   // render <SyncConfirmDialog /> somewhere in the tree
 */
export function useStartupExperienceSync() {
  const [pending, setPending] = useState<Pending | null>(null);

  const maybeSync = useCallback(
    async (args: { side: Side; matchName: string; changes: Changes }): Promise<void> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const name = (args.matchName ?? "").trim();
      if (!name) return;
      const { name: newName, logo_url: newLogo } = args.changes;
      const hasNameChange = newName !== undefined;
      const hasLogoChange = newLogo !== undefined;
      if (!hasNameChange && !hasLogoChange) return;

      const userId = u.user.id;

      if (args.side === "experience") {
        const { data } = await supabase
          .from("startups")
          .select("id, name, logo_url")
          .eq("owner_id", userId)
          .eq("is_published", true)
          .ilike("name", name);
        const matches = ((data ?? []) as StartupMatch[]).filter(
          (s) => (s.name ?? "").trim().toLowerCase() === name.toLowerCase(),
        );
        if (matches.length === 0) return;
        const willChange = matches.some(
          (s) =>
            (hasNameChange && (s.name ?? "").trim() !== (newName ?? "").trim()) ||
            (hasLogoChange && (s.logo_url ?? null) !== (newLogo ?? null)),
        );
        if (!willChange) return;
        setPending({ side: "experience", changes: args.changes, startupMatches: matches, experienceMatches: [] });
      } else {
        const { data } = await supabase
          .from("founder_experiences")
          .select("id, company, logo_url")
          .eq("user_id", userId)
          .ilike("company", name);
        const matches = ((data ?? []) as ExperienceMatch[]).filter(
          (e) => (e.company ?? "").trim().toLowerCase() === name.toLowerCase(),
        );
        if (matches.length === 0) return;
        const willChange = matches.some(
          (e) =>
            (hasNameChange && (e.company ?? "").trim() !== (newName ?? "").trim()) ||
            (hasLogoChange && (e.logo_url ?? null) !== (newLogo ?? null)),
        );
        if (!willChange) return;
        setPending({ side: "startup", changes: args.changes, startupMatches: [], experienceMatches: matches });
      }
    },
    [],
  );

  async function applySync() {
    if (!pending) return;
    const { side, changes, startupMatches, experienceMatches } = pending;
    try {
      if (side === "experience" && startupMatches.length) {
        const payload: { name?: string; logo_url?: string | null } = {};
        if (changes.name !== undefined) payload.name = changes.name.trim();
        if (changes.logo_url !== undefined) payload.logo_url = changes.logo_url;
        const { error } = await supabase
          .from("startups")
          .update(payload)
          .in(
            "id",
            startupMatches.map((m) => m.id),
          );
        if (error) throw error;
        toast.success("Linked startup updated");
      } else if (side === "startup" && experienceMatches.length) {
        const payload: { company?: string; logo_url?: string | null } = {};
        if (changes.name !== undefined) payload.company = changes.name.trim();
        if (changes.logo_url !== undefined) payload.logo_url = changes.logo_url;
        const { error } = await supabase
          .from("founder_experiences")
          .update(payload)
          .in(
            "id",
            experienceMatches.map((m) => m.id),
          );
        if (error) throw error;
        toast.success("Linked experience updated");
      }

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync linked entry");
    } finally {
      setPending(null);
    }
  }

  function cancel() {
    setPending(null);
  }

  const targetLabel =
    pending?.side === "experience" ? "published startup profile" : "startup experience entry";
  const targetName =
    pending?.side === "experience"
      ? pending?.startupMatches[0]?.name
      : pending?.experienceMatches[0]?.company;

  const SyncConfirmDialog = (
    <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) cancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Also update your {targetLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            "{targetName}" is linked because it shares the same name. Do you want to apply the
            same change there too?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancel}>Keep separate</AlertDialogCancel>
          <AlertDialogAction onClick={applySync}>Update both</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { maybeSync, SyncConfirmDialog };
}
