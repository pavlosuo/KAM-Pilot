import type { Baseline, Customer, Dataset } from "../data/types";
import { audienceSiteScope } from "../avatar/audience";
import type { RegulatoryBrief } from "../regulation/types";
import type { AssumptionValues, Scenario } from "./assumptions";
import type { Avatar } from "./avatars";
import { personalizedAvatarWeights } from "./avatar-personalization";
import { computeReview, type ReviewModel } from "./metrics";
import { generateObservations, type Observation } from "./observations";
import { blendWeights, customerTopicWeights, industryWeights, rankPriorities, type PriorityKey, type Weights } from "./priorities";
import { planRebalance, type RebalancePlan } from "./rebalance";
import { regulationWeights, regulatoryObservations } from "./regulatory";

export interface ReviewSettings {
  from: string | null;
  to: string | null;
  baselineId: string | null;
  scenario: Scenario;
  productIds: string[];
  promptWeights: Weights | null;
}

export interface ReviewBundle {
  months: string[];
  baseline: Baseline;
  scopedSiteIds: string[] | null;
  weightParts: { industry: Weights; topics: Weights; avatar: Weights; prompt: Weights | null; regulation: Weights | null };
  weights: Weights;
  ranked: PriorityKey[];
  brief: RegulatoryBrief | null;
  model: ReviewModel;
  plan: RebalancePlan;
  observations: Observation[];
}

/**
 * One review computation for a customer and audience: period, comparison,
 * site scope from the audience's locations, blended priorities, the review
 * model, rebalancing plan and observations. The dashboard, the studio preview
 * and the Recap all use it, so they always agree.
 */
export function buildReview(ds: Dataset, customer: Customer, avatar: Avatar, s: ReviewSettings, assumptions: AssumptionValues, today: Date): ReviewBundle {
  const all = ds.meta.months;
  const from = s.from && all.includes(s.from) ? s.from : all[0];
  const to = s.to && all.includes(s.to) ? s.to : all[all.length - 1];
  const months = all.filter((m) => m >= from && m <= to);
  const fallback = ds.baselines.find((b) => b.selection.toUpperCase() === "DEFAULT") ?? ds.baselines[0];
  const baseline = ds.baselines.find((b) => b.id === s.baselineId) ?? fallback;
  const sites = ds.sites.filter((x) => x.customerId === customer.id);
  const scopedSiteIds = audienceSiteScope(avatar, sites);
  const brief = avatar.brief ?? null;
  const weightParts = {
    industry: industryWeights(customer.industry, ds.industryPriorities),
    topics: customerTopicWeights(customer),
    avatar: personalizedAvatarWeights(avatar),
    prompt: s.promptWeights,
    regulation: regulationWeights(brief),
  };
  const weights = blendWeights(weightParts);
  const model = computeReview(ds, { customerId: customer.id, months, siteIds: scopedSiteIds, productIds: s.productIds.length ? s.productIds : null }, baseline.id, assumptions, weights);
  const plan = planRebalance(ds, customer.id, months, assumptions, scopedSiteIds);
  const observations = generateObservations(model, ds, weights, plan, avatar, regulatoryObservations(model, brief, weights, s.scenario, today));
  return { months, baseline, scopedSiteIds, weightParts, weights, ranked: rankPriorities(weights), brief, model, plan, observations };
}
