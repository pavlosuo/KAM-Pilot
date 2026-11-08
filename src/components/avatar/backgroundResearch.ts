import { useSyncExternalStore } from "react";
import type { Dataset } from "@/lib/data/types";
import type { Avatar } from "@/lib/engine/avatars";
import { researchCountry } from "@/lib/avatar/build";
import { briefItems, type RegulatoryBrief } from "@/lib/regulation/types";
import { runAvatarResearch } from "./useResearch";

export interface BackgroundResearchStatus {
  state: "running" | "done" | "failed";
  country: string;
  rules: number;
  error?: string;
}

/**
 * Country-rule research started by the studio keeps running after the
 * operator lands on the Recap; the brief is saved on the audience when it
 * arrives and every page re-renders with it.
 */
const jobs = new Map<string, BackgroundResearchStatus>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startBackgroundResearch(avatar: Avatar, dataset: Dataset, onBrief: (brief: RegulatoryBrief) => void) {
  if (jobs.get(avatar.id)?.state === "running") return;
  controllers.get(avatar.id)?.abort();
  const ctrl = new AbortController();
  controllers.set(avatar.id, ctrl);
  const country = researchCountry(avatar, dataset);
  jobs.set(avatar.id, { state: "running", country, rules: 0 });
  emit();
  runAvatarResearch(avatar, dataset, { signal: ctrl.signal })
    .then((brief) => {
      const ok = brief.topics.some((t) => t.status === "ok");
      onBrief(brief);
      jobs.set(avatar.id, { state: ok ? "done" : "failed", country, rules: briefItems(brief).length, error: ok ? undefined : brief.topics.find((t) => t.error)?.error });
    })
    .catch((e: Error) => {
      if (e.name === "AbortError") return;
      jobs.set(avatar.id, { state: "failed", country, rules: 0, error: e.message });
    })
    .finally(() => {
      controllers.delete(avatar.id);
      emit();
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useBackgroundResearch(avatarId: string | undefined): BackgroundResearchStatus | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (avatarId ? jobs.get(avatarId) : undefined),
    () => undefined,
  );
}
