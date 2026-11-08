import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

const TABS = [
  {
    n: "01",
    label: "Discover",
    title: "Founders beyond your network.",
    body: "Break out of warm-intro circles, geography, and conference rosters. Ventura surfaces the founders you'd otherwise never see.",
    quote: "Discovery happens first, trust gets built over time.",
  },
  {
    n: "02",
    label: "Watch",
    title: "Pitches you actually read.",
    body: "Short vertical video pitches put the founder in the frame. Read conviction, clarity, and story in 60 seconds — not 60 slides.",
    quote: "More founder-focused than pitch decks.",
  },
  {
    n: "03",
    label: "Engage",
    title: "Signal, not noise.",
    body: "Filter by industry, stage, and geography. Save what resonates, comment, and message founders directly — no gatekeepers.",
    quote: "More personalised than cold emails.",
  },
  {
    n: "04",
    label: "Close",
    title: "From scroll to call.",
    body: "Move from feed to first call without chasing intros. Ventura keeps discovery and dialogue in one place, so momentum compounds.",
    quote: "More scalable than events.",
  },
];

const INTERVAL = 5000;

export function OfferingTabs() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    setProgress(0);
    const start = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / INTERVAL) * 100);
      setProgress(p);
    }, 50);
    const next = setTimeout(() => setActive((a) => (a + 1) % TABS.length), INTERVAL);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [active, paused]);

  const t = TABS[active];

  return (
    <section className="relative overflow-hidden border-t border-border bg-background text-foreground">
      {/* dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(oklch(0.2 0 0) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* red glow right */}
      <div className="pointer-events-none absolute -right-40 top-1/2 h-[700px] w-[700px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,oklch(0.5_0_0/0.2),transparent_60%)] blur-3xl" />

      <div className="container relative mx-auto max-w-7xl px-6 py-28">
        <div className="flex items-center gap-3 text-primary">
          <span className="h-px w-10 bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-[0.3em]">What we offer</span>
        </div>

        {/* tabs */}
        <div className="mt-10 flex flex-wrap gap-3">
          {TABS.map((tab, i) => {
            const isActive = i === active;
            return (
              <button
                key={tab.n}
                onClick={() => setActive(i)}
                className={`relative overflow-hidden rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-foreground/20 text-foreground/70 hover:text-foreground"
                }`}
              >
                <span className="relative z-10">
                  {tab.n} — {tab.label}
                </span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 h-[2px] bg-foreground transition-[width] duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </button>
            );
          })}
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume" : "Pause"}
            className="inline-flex items-center justify-center rounded-full border border-foreground/20 p-2.5 text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1.4fr_1fr]">
          {/* text side — keyed for transitions */}
          <div key={`text-${active}`} className="animate-fade-up">
            <h2 className="text-5xl font-black uppercase leading-[0.92] sm:text-7xl">
              {t.title.split(".")[0]}
              <span className="text-primary">.</span>
            </h2>
            <p className="mt-8 max-w-xl text-2xl text-foreground/70">{t.body}</p>
            <p className="mt-8 border-l-2 border-primary/50 pl-4 italic text-foreground/80">
              {t.quote}
            </p>
          </div>

          {/* big circle number */}
          <div className="relative mx-auto aspect-square w-full max-w-[140px] sm:max-w-sm lg:max-w-md">
            {/* rings */}
            {[0.5, 0.7, 0.9].map((s, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-primary/20"
                style={{
                  transform: `scale(${s})`,
                  animation: `pulse-dot ${4 + i}s ease-in-out infinite`,
                  animationDelay: `${i * 300}ms`,
                }}
              />
            ))}
            <div
              key={`num-${active}`}
              className="absolute inset-0 grid place-items-center animate-rise"
            >
              <span className="text-[10rem] font-black leading-none text-foreground sm:text-[14rem] lg:text-[18rem]">
                {t.n}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
