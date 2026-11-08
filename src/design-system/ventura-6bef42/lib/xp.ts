// Central XP constants + level curve.
// Level curve: each level requires 150 XP. Level N spans [ (N-1)*150, N*150 ).
export const XP_PER_LEVEL = 150;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; pct: number } {
  const current = xp % XP_PER_LEVEL;
  const needed = XP_PER_LEVEL - current;
  return { current, needed, pct: (current / XP_PER_LEVEL) * 100 };
}

// XP rewards
export const XP_REWARD = {
  metricAnswer: 8, // per tracked-question slot answered per week
  goalDone: 15,
  goalPerfectBonus: 40,
  goalCarryoverBonus: 10,
  textUpdatePublish: 25,
  textUpdateLong: 10, // extra when >= 500 chars
  teamAllPublished: 30, // once per week, when all team members publish
  streakGrowth: 5, // per streak growth unit
  cardHeadline: 10, // new progression-card headline (label) — only headlines count
  challengeApproved: 200, // program lead approves a challenge submission
  startupCreated: 75, // one-time, when a startup profile is first published
} as const;
