import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import type { Baseline, Customer, Dataset, Site } from "@/lib/data/types";
import { avatarLocation, NEUTRAL_LENS, type Avatar } from "@/lib/engine/avatars";
import type { ReviewModel } from "@/lib/engine/metrics";
import type { Observation } from "@/lib/engine/observations";
import type { PriorityKey, Weights } from "@/lib/engine/priorities";
import type { RebalancePlan } from "@/lib/engine/rebalance";
import type { AssumptionValues } from "@/lib/engine/assumptions";
import { slugify } from "@/lib/engine/format";
import { buildReview } from "@/lib/engine/review";
import { buildRecap, type Recap } from "@/lib/engine/recap";
import type { RegulatoryBrief } from "@/lib/regulation/types";
import { usePreferences, type CustomerSettings } from "./preferences-store";
import { buildDeck, defaultSections } from "@/lib/export/deck";
import { usePowerPoint } from "@/lib/export/use-powerpoint";
import { autoDownload } from "@/lib/export/auto-download";
import { downloadBlob } from "@/lib/export/colors";

export interface AccountContextValue {
  dataset: Dataset;
  customer: Customer;
  slug: string;
  settings: CustomerSettings;
  update: (patch: Partial<CustomerSettings>) => void;
  allMonths: string[];
  months: string[];
  baseline: Baseline;
  assumptions: AssumptionValues;
  avatars: Avatar[];
  avatar: Avatar;
  weights: Weights;
  weightParts: { industry: Weights; topics: Weights; avatar: Weights; prompt: Weights | null; regulation: Weights | null };
  /** Researched country rules of the selected avatar (null before research). */
  brief: RegulatoryBrief | null;
  /** True when no operator-created avatar is selected. */
  neutral: boolean;
  /** Reference date for deadlines (today). */
  today: Date;
  ranked: PriorityKey[];
  model: ReviewModel;
  plan: RebalancePlan;
  observations: Observation[];
  customerSites: Site[];
  scopedSiteIds: string[] | null;
  /** The five-question story; the Recap page and the presentation both render it. */
  recap: Recap;
}

const Ctx = createContext<AccountContextValue | null>(null);

export function customerSlug(c: Customer) {
  return slugify(c.name);
}

export function findCustomerBySlug(ds: Dataset, slug: string): Customer | undefined {
  return ds.customers.find((c) => customerSlug(c) === slug || c.id.toLowerCase() === slug.toLowerCase());
}

export function AccountProvider({ dataset, customer, children }: { dataset: Dataset; customer: Customer; children: ReactNode }) {
  const prefs = usePreferences();
  const storedSettings = prefs.customerSettings(customer.id);
  const update = useCallback((patch: Partial<CustomerSettings>) => prefs.updateCustomer(customer.id, patch), [prefs, customer.id]);

  const avatars = useMemo(() => prefs.customAvatars.filter((a) => !a.customerId || a.customerId === customer.id), [prefs.customAvatars, customer.id]);
  const avatar = avatars.find((a) => a.id === storedSettings.avatarId) ?? avatars[0] ?? NEUTRAL_LENS;
  const neutral = avatar.id === NEUTRAL_LENS.id;
  const today = useMemo(() => new Date(), []);
  const customerSites = useMemo(() => dataset.sites.filter((s) => s.customerId === customer.id), [dataset, customer.id]);

  const { from, to, baselineId, scenario, productIds, prompt } = storedSettings;
  const review = useMemo(
    () => buildReview(dataset, customer, avatar, { from, to, baselineId, scenario, productIds, promptWeights: prompt?.weights ?? null }, prefs.assumptions, today),
    [dataset, customer, avatar, from, to, baselineId, scenario, productIds, prompt, prefs.assumptions, today],
  );
  // The audience's locations decide the site scope; no separate dashboard filter can widen it.
  const settings = useMemo(
    () => ({
      ...storedSettings,
      countries: review.scopedSiteIds ? [...new Set(customerSites.filter((s) => review.scopedSiteIds!.includes(s.id)).map((s) => s.country))] : [],
    }),
    [storedSettings, review.scopedSiteIds, customerSites],
  );

  const recap = useMemo(
    () =>
      buildRecap({
        model: review.model,
        dataset,
        plan: review.plan,
        observations: review.observations,
        avatar,
        weights: review.weights,
        brief: review.brief,
        scenario: storedSettings.scenario,
        today,
        locationLabel: neutral ? "All locations" : avatarLocation(avatar),
        picked: storedSettings.pickedObservationIds,
      }),
    [review, dataset, avatar, storedSettings.scenario, storedSettings.pickedObservationIds, today, neutral],
  );

  const value: AccountContextValue = {
    dataset,
    customer,
    slug: customerSlug(customer),
    settings,
    update,
    allMonths: dataset.meta.months,
    months: review.months,
    baseline: review.baseline,
    assumptions: prefs.assumptions,
    avatars,
    avatar,
    weights: review.weights,
    weightParts: review.weightParts,
    ranked: review.ranked,
    model: review.model,
    plan: review.plan,
    observations: review.observations,
    customerSites,
    scopedSiteIds: review.scopedSiteIds,
    brief: review.brief,
    neutral,
    today,
    recap,
  };
  return <Ctx.Provider value={value}><PrepareAccountPowerPoint />{children}</Ctx.Provider>;
}

function PrepareAccountPowerPoint() {
  const account = useAccount();
  const deck = useMemo(() => buildDeck(account, { sections: defaultSections(account) }), [account]);
  const { state } = usePowerPoint(deck);
  const pending = useSyncExternalStore(autoDownload.subscribe, autoDownload.get, () => null);
  // "Generate report" for a person: download their PowerPoint once it is ready.
  useEffect(() => {
    if (!pending || pending.avatarId !== account.avatar.id || !state || state.status === "preparing") return;
    autoDownload.clear();
    if (state.status === "ready") {
      const { blob, filename } = state.file;
      downloadBlob(blob, filename);
      toast.success(`${pending.label}'s PowerPoint is downloaded`, {
        id: pending.toastId,
        duration: 12_000,
        action: { label: "Download again", onClick: () => downloadBlob(blob, filename) },
      });
    } else {
      toast.error(`${pending.label}'s PowerPoint could not be prepared: ${state.error}`, { id: pending.toastId, duration: 12_000 });
    }
  }, [pending, state, account.avatar.id]);
  return null;
}

export function useAccount() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
