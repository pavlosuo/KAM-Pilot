import { motion, useReducedMotion } from "framer-motion";

type Score = { label: string; value: number; tone: string };

/** Container-sized scorecard: chart above labels, even in the narrow sidebar. */
export function RehearsalScorecard({ credibility, clarity, customerFocus }: {
  credibility: number;
  clarity: number;
  customerFocus: number;
}) {
  const reducedMotion = useReducedMotion();
  const scores: Score[] = [
    { label: "Credibility", value: credibility, tone: "text-lind-green" },
    { label: "Clarity", value: clarity, tone: "text-lind-navy" },
    { label: "Customer focus", value: customerFocus, tone: "text-lind-purple" },
  ];

  return (
    <div className="flex min-w-0 flex-col items-center gap-6" data-rehearsal-scorecard>
      <svg viewBox="0 0 160 160" className="h-40 w-40 max-w-full shrink-0" role="img" aria-label="Meeting score rings">
        {scores.map((score, index) => {
          const radius = 70 - index * 22;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference * (1 - Math.max(0, Math.min(100, score.value)) / 100);
          return (
            <g key={score.label} fill="none" strokeWidth={14} transform="rotate(-90 80 80)">
              <circle cx={80} cy={80} r={radius} className="stroke-border" />
              <motion.circle
                cx={80} cy={80} r={radius}
                stroke="currentColor" className={score.tone}
                strokeLinecap="round" strokeDasharray={circumference}
                initial={reducedMotion ? false : { strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: reducedMotion ? 0 : 0.8 }}
              />
            </g>
          );
        })}
      </svg>
      <dl className="w-full min-w-0 divide-y divide-border">
        {scores.map((score) => (
          <div key={score.label} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-sm font-medium text-muted-foreground">{score.label}</dt>
            <dd className={`whitespace-nowrap text-2xl font-bold tabular-nums ${score.tone}`}>
              {score.value}<span className="text-sm font-medium text-muted-foreground"> / 100</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}