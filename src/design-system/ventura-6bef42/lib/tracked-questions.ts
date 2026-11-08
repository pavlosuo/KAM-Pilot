export const TRACKED_QUESTION_OPTIONS: readonly string[] = [
  "How many potential customers did you speak with last week?",
  "How many people tested your prototype or MVP last week?",
  "How many people said they would try or pay for your solution?",
  "How many new users signed up last week?",
  "How many users actively used your product last week?",
  "How many users returned from the previous week?",
  "How many product experiments, features, or major improvements did you launch?",
  "How many pieces of actionable user feedback did you collect?",
  "How many new leads did you generate last week?",
  "How many sales calls or product demos did you complete?",
  "How many pilot customers did you start or confirm?",
  "How many new paying customers did you acquire?",
  "How much revenue did you generate last week?",
  "How many partnership conversations did you have last week?",
  "How many investor meetings, grant applications, or accelerator applications did you complete?",
] as const;

export const DEFAULT_TRACKED_QUESTION = TRACKED_QUESTION_OPTIONS[0];
