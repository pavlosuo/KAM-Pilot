import type { Avatar } from "./avatars";
import { parsePriorityText, PRIORITY_KEYS, type Weights } from "./priorities";

/** Stated interests override role defaults for matching supported themes. */
export function personalizedAvatarWeights(avatar: Avatar): Weights {
  const profile = avatar.profile;
  if (!profile) return avatar.weights;
  const interests = [...profile.decisions, ...profile.goals, ...profile.reporting];
  const matches = interests.flatMap((interest) => parsePriorityText(interest).matches);
  const avoid = profile.avoid.flatMap((interest) => parsePriorityText(interest).matches);
  const weights = { ...avatar.weights };
  for (const key of PRIORITY_KEYS) {
    const selected = matches.filter((match) => match.key === key);
    if (selected.length) weights[key] = selected.some((match) => match.weight > 0) ? 6 : 0;
    if (avoid.some((match) => match.key === key)) weights[key] = 0;
  }
  return weights;
}

/** No independent dashboard setting can broaden an avatar's country scope. */
export function avatarCountries(avatar: Avatar): string[] {
  return avatar.country && avatar.country !== "ALL" ? [avatar.country] : [];
}