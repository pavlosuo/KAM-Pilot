export interface BadgeDef {
  code: string;
  label: string;
  emoji: string;
  description: string;
}

export const BADGE_DEFS: Record<string, BadgeDef> = {
  founded: {
    code: "founded",
    label: "Founded",
    emoji: "🚀",
    description: "Publish your first startup profile",
  },
  first_goal: {
    code: "first_goal",
    label: "First Goal",
    emoji: "🌱",
    description: "Complete your first weekly goal",
  },
  first_five: {
    code: "first_five",
    label: "High Five",
    emoji: "✋",
    description: "Complete all 5 goals in a week",
  },
  perfect_week: {
    code: "perfect_week",
    label: "Perfect Week",
    emoji: "⭐",
    description: "Complete every goal you set (min 3)",
  },
  three_perfect: {
    code: "three_perfect",
    label: "Triple Crown",
    emoji: "👑",
    description: "Land 3 perfect weeks total",
  },
  carryover_hero: {
    code: "carryover_hero",
    label: "Comeback Kid",
    emoji: "🔁",
    description: "Complete 5 carried-over goals",
  },
  ten_done: {
    code: "ten_done",
    label: "Momentum",
    emoji: "🚀",
    description: "Complete 10 goals lifetime",
  },
  fifty_done: {
    code: "fifty_done",
    label: "Machine",
    emoji: "⚡",
    description: "Complete 50 goals lifetime",
  },
  hundred_done: {
    code: "hundred_done",
    label: "Legend",
    emoji: "🏆",
    description: "Complete 100 goals lifetime",
  },
  // Streak badges
  streak_4: {
    code: "streak_4",
    label: "On A Roll",
    emoji: "🔥",
    description: "4-week publishing streak",
  },
  streak_10: {
    code: "streak_10",
    label: "Ten Strong",
    emoji: "💪",
    description: "10-week publishing streak",
  },
  streak_25: {
    code: "streak_25",
    label: "Unstoppable",
    emoji: "🌋",
    description: "25-week publishing streak",
  },
  streak_52: {
    code: "streak_52",
    label: "Year of Grit",
    emoji: "🗓️",
    description: "52-week publishing streak",
  },
  // Storyteller
  storyteller_5: {
    code: "storyteller_5",
    label: "Storyteller",
    emoji: "✍️",
    description: "Publish 5 written updates",
  },
  storyteller_25: {
    code: "storyteller_25",
    label: "Chronicler",
    emoji: "📖",
    description: "Publish 25 written updates",
  },
  longform_5: {
    code: "longform_5",
    label: "Deep Diver",
    emoji: "🌊",
    description: "5 longform updates (500+ chars)",
  },
  // Team play
  team_player: {
    code: "team_player",
    label: "Team Player",
    emoji: "🤝",
    description: "All co-founders publish in the same week",
  },
  team_ten: {
    code: "team_ten",
    label: "Dream Team",
    emoji: "🌟",
    description: "10 team-complete weeks",
  },
  // Program
  program_challenge: {
    code: "program_challenge",
    label: "Challenge",
    emoji: "🎯",
    description: "Get a program challenge approved by your lead",
  },
  // Comeback
  comeback: {
    code: "comeback",
    label: "Comeback",
    emoji: "↩️",
    description: "Publish after skipping 2+ weeks",
  },
};

export function getBadgeDef(code: string): BadgeDef {
  return (
    BADGE_DEFS[code] ?? { code, label: code, emoji: "🎖️", description: "" }
  );
}
