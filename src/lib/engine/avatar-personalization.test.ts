import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, NEUTRAL_LENS } from "./avatars";
import { avatarCountries, personalizedAvatarWeights } from "./avatar-personalization";
import { blendWeights, rankPriorities, relevance, ZERO_WEIGHTS } from "./priorities";

describe("saved avatar interests and location", () => {
  it("makes the customer's cost interest drive dashboard ranking and observations", () => {
    const avatar = { ...NEUTRAL_LENS, profile: { ...EMPTY_PROFILE, goals: ["Reduce cost"] } };
    const weights = blendWeights({ industry: { ...ZERO_WEIGHTS, water: 3 }, topics: ZERO_WEIGHTS, avatar: personalizedAvatarWeights(avatar) });
    expect(rankPriorities(weights)[0]).toBe("cost");
    expect(relevance(["cost"], weights)).toBeGreaterThan(relevance(["water"], weights));
  });
  it("keeps multiple stated customer interests active", () => {
    const avatar = { ...NEUTRAL_LENS, profile: { ...EMPTY_PROFILE, decisions: ["Water use", "Carbon emissions"], reporting: ["Reporting evidence"] } };
    const weights = personalizedAvatarWeights(avatar);
    expect(weights.water).toBe(6);
    expect(weights.emissions).toBe(6);
    expect(weights.evidence).toBe(6);
  });
  it("locks the generated report to the avatar's specified country", () => {
    expect(avatarCountries({ ...NEUTRAL_LENS, country: "Finland" })).toEqual(["Finland"]);
    expect(avatarCountries({ ...NEUTRAL_LENS, country: null })).toEqual([]);
  });
});