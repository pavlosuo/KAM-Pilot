export const CHAPTERS = [
  { name: 'Foundation', subtitle: 'Turn a spark into something real', start: 0, end: 3 },
  { name: 'Validation', subtitle: 'Build it. Test it. Learn.', start: 3, end: 6 },
  { name: 'Growth', subtitle: 'Find the engine that keeps running', start: 6, end: 10 },
  { name: 'Fundraising', subtitle: 'Tell your story. Find your people.', start: 10, end: 12 },
];
export const LEVELS = [
  { title: 'Problem articulated', short: 'Find the problem', detail: 'A real problem is your starting point.', task: 'Describe one painful problem your customer faces.', hint: 'Name a specific person, their problem, and what it costs them.', resource: 'The problem statement canvas', type: 'text' },
  { title: 'Solution defined', short: 'Shape your solution', detail: 'Make the promise simple and clear.', task: 'Describe how your solution makes that problem easier.', hint: 'Focus on the outcome, not the feature list.', resource: 'Value proposition worksheet', type: 'text' },
  { title: 'Market mapped', short: 'Map your market', detail: 'Find the people who need you most.', task: 'Which is the strongest first customer segment?', hint: 'Your first market should be narrow enough to reach and painful enough to care.', resource: 'Your first 100 customers', type: 'choice', options: ['Everyone who uses the internet', 'Independent cafés losing hours to manual stock counts', 'Any company interested in technology'], answer: 1 },
  { title: 'Customer discovery', short: 'Meet your customers', detail: 'Listen before you build.', task: 'Write a question that uncovers how customers handle the problem today.', hint: 'Ask about the last time it happened. Avoid asking if they like your idea.', resource: 'Customer interview field guide', type: 'text' },
  { title: 'Team assembled', short: 'Find your crew', detail: 'Great journeys need complementary skills.', task: 'Choose the foundations of a strong founding team.', hint: 'Shared intent and complementary strengths beat matching job titles.', resource: 'Founder alignment checklist', type: 'check', options: ['Agree on roles and responsibilities', 'Identify a missing core skill', 'Discuss commitment and decision making'] },
  { title: 'MVP ready', short: 'Build your first version', detail: 'Small enough to ship. Useful enough to test.', task: 'What belongs in your first MVP?', hint: 'Test the most important assumption with the smallest useful product.', resource: 'The lean MVP playbook', type: 'choice', options: ['Every feature customers might ever want', 'One core workflow that solves the painful problem', 'A perfect brand and a large product roadmap'], answer: 1 },
  { title: 'Business model', short: 'Make the numbers work', detail: 'Turn value into a sustainable business.', task: 'Describe who pays, what they pay for, and how often.', hint: 'A simple pricing hypothesis is enough to start testing.', resource: 'Unit economics starter sheet', type: 'text' },
  { title: 'Pitch deck', short: 'Tell your story', detail: 'A compelling story, grounded in evidence.', task: 'Prepare the three pillars of your pitch.', hint: 'Connect the problem, your proof, and the opportunity.', resource: 'The 10-slide pitch framework', type: 'check', options: ['Explain the customer problem', 'Show evidence and differentiation', 'Name the ask and next milestone'] },
  { title: 'Pilot launched', short: 'Launch a pilot', detail: 'Put your idea into the real world.', task: 'Write one measurable success criterion for your pilot.', hint: 'Choose a metric, a threshold, and a time window.', resource: 'Pilot experiment planner', type: 'text' },
  { title: 'First customers', short: 'Earn your first revenue', detail: 'The first yes is worth celebrating.', task: 'What is the clearest sign of demand?', hint: 'Behavior is stronger evidence than compliments.', resource: 'From pilot to paying customer', type: 'choice', options: ['A friend says the idea is great', 'A target customer pays and uses the product', 'Your launch post gets likes'], answer: 1 },
  { title: 'Traction', short: 'Build momentum', detail: 'Find growth that lasts beyond launch day.', task: 'Prepare your traction evidence.', hint: 'Investors look for repeatable acquisition, retention, and healthy economics.', resource: 'Traction and retention scorecard', type: 'check', options: ['Track activation and retention', 'Measure acquisition cost', 'Show revenue or usage growth over time'] },
  { title: 'Investor ready', short: 'Get fundraising ready', detail: 'Find the right partners for your next chapter.', task: 'Prepare the essentials before reaching out.', hint: 'Match investors by stage, sector, check size, and the help your company needs.', resource: 'Fundraising readiness checklist', type: 'check', options: ['Define the raise and use of funds', 'Prepare a pitch and core data room', 'Build a relevant investor shortlist'] },
] as const;
export type Progress = { completed: number; xp: number };
export const INITIAL_PROGRESS: Progress = { completed: 2, xp: 100 };
export function completeLevel(state: Progress, index: number, valid: boolean): Progress {
  if (!valid || index !== state.completed || index >= LEVELS.length) return state;
  return { completed: state.completed + 1, xp: state.xp + 50 };
}
export function restoreProgress(raw: string | null): Progress {
  try { const value = JSON.parse(raw ?? 'null'); if (Number.isInteger(value?.completed) && value.completed >= 2 && value.completed <= 12 && value.xp === value.completed * 50) return value; } catch { /* start fresh */ }
  return { ...INITIAL_PROGRESS };
}
export function chapterFor(index: number) { return CHAPTERS.find(c => index >= c.start && index < c.end) ?? CHAPTERS[3]; }
