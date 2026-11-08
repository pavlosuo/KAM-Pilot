import { COACH_MARKER } from "./rehearsal-prompts";

export interface CoachFeedback {
  credibility: number | null;
  clarity: number | null;
  customerFocus: number | null;
  evidenceUsed: string[];
  overclaim: string | null;
  betterAnswer: string | null;
  nextQuestionTopic: string | null;
}

const clampScore = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);

/**
 * Splits a persona turn into the spoken part and the coaching block. While a
 * reply is still streaming, any partial marker at the end is hidden.
 */
export function splitPersonaTurn(text: string): { spoken: string; coach: CoachFeedback | null; coachPending: boolean } {
  const idx = text.indexOf(COACH_MARKER);
  if (idx === -1) {
    // hide a partially streamed marker such as "[[CO"
    let spoken = text;
    for (let k = COACH_MARKER.length - 1; k > 0; k--) {
      if (spoken.endsWith(COACH_MARKER.slice(0, k))) {
        spoken = spoken.slice(0, -k);
        break;
      }
    }
    return { spoken: spoken.trimEnd(), coach: null, coachPending: false };
  }
  const spoken = text.slice(0, idx).trimEnd();
  const raw = text.slice(idx + COACH_MARKER.length).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return { spoken, coach: null, coachPending: true };
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    return {
      spoken,
      coachPending: false,
      coach: {
        credibility: clampScore(o.credibility),
        clarity: clampScore(o.clarity),
        customerFocus: clampScore(o.customerFocus),
        evidenceUsed: Array.isArray(o.evidenceUsed) ? o.evidenceUsed.filter((x): x is string => typeof x === "string").slice(0, 6) : [],
        overclaim: str(o.overclaim),
        betterAnswer: str(o.betterAnswer),
        nextQuestionTopic: str(o.nextQuestionTopic),
      },
    };
  } catch {
    return { spoken, coach: null, coachPending: true };
  }
}

/** Running average of scored turns (null scores are skipped). */
export function averageScores(list: Array<CoachFeedback | null>) {
  const avg = (k: "credibility" | "clarity" | "customerFocus") => {
    const v = list.map((c) => c?.[k]).filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return { credibility: avg("credibility"), clarity: avg("clarity"), customerFocus: avg("customerFocus") };
}
