import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_ASSUMPTIONS, type AssumptionValues, type Scenario } from "@/lib/engine/assumptions";
import type { Avatar } from "@/lib/engine/avatars";
import type { Weights } from "@/lib/engine/priorities";

export interface PromptPersonalization {
  text: string;
  weights: Weights;
  source: "rules" | "ai";
  rationale?: string;
  focusSites?: string[];
}

export interface CustomerSettings {
  from: string | null;
  to: string | null;
  baselineId: string | null;
  scenario: Scenario;
  countries: string[];
  productIds: string[];
  avatarId: string;
  prompt: PromptPersonalization | null;
  /** Observations chosen for the exported review; null = automatic top picks. */
  pickedObservationIds: string[] | null;
  /** KAM notes added to the review (meeting context, agreed follow-ups). */
  reviewNotes: string;
  brandColor?: string;
  companyDomain?: string;
}

export const DEFAULT_CUSTOMER_SETTINGS: CustomerSettings = {
  from: null,
  to: null,
  baselineId: null,
  scenario: "base",
  countries: [],
  productIds: [],
  avatarId: "kam-balanced",
  prompt: null,
  pickedObservationIds: null,
  reviewNotes: "",
};

export interface Prefs {
  theme: "light" | "dark";
  customAvatars: Avatar[];
  assumptions: AssumptionValues;
  customers: Record<string, Partial<CustomerSettings>>;
  /** Avatar last chosen in the report studio. */
  studioAvatarId: string | null;
}

/**
 * "New report" starts over: every saved person and every customer's report
 * state (chosen person, picks, notes, priorities, period) is removed. Company
 * branding and the Trust-center assumptions are kept.
 */
export function resetReportPrefs(p: Prefs): Prefs {
  const customers: Prefs["customers"] = {};
  for (const [id, c] of Object.entries(p.customers)) {
    const keep: Partial<CustomerSettings> = {};
    if (c.brandColor) keep.brandColor = c.brandColor;
    if (c.companyDomain) keep.companyDomain = c.companyDomain;
    if (Object.keys(keep).length) customers[id] = keep;
  }
  return { ...p, customAvatars: [], studioAvatarId: null, customers };
}

const DEFAULT_PREFS: Prefs = { theme: "light", customAvatars: [], assumptions: DEFAULT_ASSUMPTIONS, customers: {}, studioAvatarId: null };
const KEY = "lvr-preferences-v1";

interface PrefsApi extends Prefs {
  hydrated: boolean;
  setTheme: (t: "light" | "dark") => void;
  upsertAvatar: (a: Avatar) => void;
  /** Merges fields into a saved avatar (e.g. research that finished in the background). */
  patchAvatar: (id: string, patch: Partial<Avatar>) => void;
  deleteAvatar: (id: string) => void;
  /** Adds avatars from an exported file; existing ids are replaced. Returns how many were added. */
  importAvatars: (list: Avatar[]) => number;
  setStudioAvatar: (id: string | null) => void;
  setAssumptions: (a: AssumptionValues) => void;
  resetAssumptions: () => void;
  customerSettings: (customerId: string) => CustomerSettings;
  updateCustomer: (customerId: string, patch: Partial<CustomerSettings>) => void;
  /** Removes all saved people and reports (see resetReportPrefs). */
  resetReports: () => void;
}

const Ctx = createContext<PrefsApi | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({
          ...DEFAULT_PREFS,
          ...parsed,
          theme: "light",
          // Earlier builds stored copies of the preset lenses; only operator-created avatars are kept.
          customAvatars: (parsed.customAvatars ?? []).filter((a) => a && typeof a.id === "string" && !a.preset),
          assumptions: { ...DEFAULT_ASSUMPTIONS, ...(parsed.assumptions ?? {}) },
        });
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // storage full or blocked
    }
  }, [prefs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.setProperty("color-scheme", "light");
  }, [prefs.theme, hydrated]);

  const setTheme = useCallback((_theme: "light" | "dark") => setPrefs((p) => ({ ...p, theme: "light" })), []);
  const upsertAvatar = useCallback(
    (a: Avatar) =>
      setPrefs((p) => {
        const exists = p.customAvatars.some((x) => x.id === a.id);
        return { ...p, customAvatars: exists ? p.customAvatars.map((x) => (x.id === a.id ? a : x)) : [...p.customAvatars, a] };
      }),
    [],
  );
  const patchAvatar = useCallback(
    (id: string, patch: Partial<Avatar>) => setPrefs((p) => ({ ...p, customAvatars: p.customAvatars.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    [],
  );
  const deleteAvatar = useCallback(
    (id: string) =>
      setPrefs((p) => ({ ...p, customAvatars: p.customAvatars.filter((x) => x.id !== id), studioAvatarId: p.studioAvatarId === id ? null : p.studioAvatarId })),
    [],
  );
  const importAvatars = useCallback((list: Avatar[]) => {
    const valid = list.filter((a) => a && typeof a.id === "string" && typeof a.name === "string" && typeof a.role === "string" && a.weights && !a.preset);
    setPrefs((p) => {
      const ids = new Set(valid.map((a) => a.id));
      return { ...p, customAvatars: [...p.customAvatars.filter((a) => !ids.has(a.id)), ...valid] };
    });
    return valid.length;
  }, []);
  const setStudioAvatar = useCallback((studioAvatarId: string | null) => setPrefs((p) => ({ ...p, studioAvatarId })), []);
  const setAssumptions = useCallback((assumptions: AssumptionValues) => setPrefs((p) => ({ ...p, assumptions })), []);
  const resetAssumptions = useCallback(() => setPrefs((p) => ({ ...p, assumptions: DEFAULT_ASSUMPTIONS })), []);
  const customerSettings = useCallback(
    (customerId: string): CustomerSettings => ({ ...DEFAULT_CUSTOMER_SETTINGS, ...(prefs.customers[customerId] ?? {}) }),
    [prefs.customers],
  );
  const updateCustomer = useCallback(
    (customerId: string, patch: Partial<CustomerSettings>) =>
      setPrefs((p) => ({ ...p, customers: { ...p.customers, [customerId]: { ...(p.customers[customerId] ?? {}), ...patch } } })),
    [],
  );

  const resetReports = useCallback(() => setPrefs(resetReportPrefs), []);

  const value = useMemo(
    () => ({
      ...prefs,
      hydrated,
      setTheme,
      upsertAvatar,
      patchAvatar,
      deleteAvatar,
      importAvatars,
      setStudioAvatar,
      setAssumptions,
      resetAssumptions,
      customerSettings,
      updateCustomer,
      resetReports,
    }),
    [prefs, hydrated, setTheme, upsertAvatar, patchAvatar, deleteAvatar, importAvatars, setStudioAvatar, setAssumptions, resetAssumptions, customerSettings, updateCustomer, resetReports],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
