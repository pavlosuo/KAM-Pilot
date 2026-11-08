import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowUpRight, Globe2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { Recap, RecapBeat, RecapChapter, RecapLink } from "@/lib/engine/recap";
import { BeatLink, TargetLink } from "./DeepLink";
import { Counter, RecapVisualView, TONE_BORDER, TONE_TEXT } from "./visuals";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return reduced;
}

/* ----------------------------------------------------------------------------
 * Scroll timeline helpers
 * ------------------------------------------------------------------------- */

function fmtCount(v: number, d: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Adds the visual animations of one beat (counters, bars, rings, icons…) to a scrubbed timeline. */
function animateBeat(tl: gsap.core.Timeline, el: HTMLElement, at: number) {
  el.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => {
    const to = Number(c.dataset.count ?? 0);
    const d = Number(c.dataset.decimals ?? 0);
    const pre = c.dataset.prefix ?? "";
    const suf = c.dataset.suffix ?? "";
    const o = { v: 0 };
    const render = () => {
      c.textContent = `${pre}${fmtCount(o.v, d)}${suf}`;
    };
    render();
    tl.to(o, { v: to, duration: 1.1, ease: "power1.out", onUpdate: render }, at);
  });
  const growX = el.querySelectorAll("[data-grow-x]");
  if (growX.length) tl.from(growX, { scaleX: 0, transformOrigin: "left center", stagger: 0.12, duration: 0.8 }, at + 0.05);
  const growY = el.querySelectorAll("[data-grow-y]");
  if (growY.length) tl.from(growY, { scaleY: 0, transformOrigin: "center top", duration: 1 }, at);
  const pops = el.querySelectorAll("[data-pop]");
  if (pops.length) tl.from(pops, { scale: 0.3, autoAlpha: 0, stagger: { amount: Math.min(0.9, pops.length * 0.05) }, duration: 0.35, ease: "back.out(1.6)" }, at + 0.1);
  const dims = el.querySelectorAll<HTMLElement>("[data-dim]");
  const lit = el.querySelector<HTMLElement>("[data-pop]:not([data-dim])");
  if (dims.length && lit) tl.from(dims, { color: getComputedStyle(lit).color, duration: 0.5, stagger: { amount: 0.3 } }, at + 1.05);
  el.querySelectorAll<SVGCircleElement>("[data-ring]").forEach((r) => {
    const circ = Number(r.dataset.circ ?? 0);
    const val = Number(r.dataset.ring ?? 0);
    tl.fromTo(r, { strokeDashoffset: circ }, { strokeDashoffset: circ * (1 - val), duration: 1.1, ease: "power1.out" }, at);
  });
  el.querySelectorAll<SVGPathElement>("[data-draw]").forEach((p) => {
    const len = p.getTotalLength();
    gsap.set(p, { strokeDasharray: len });
    tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, ease: "none" }, at);
  });
  el.querySelectorAll<SVGGElement>("[data-orbit]").forEach((g) => {
    const turns = Number(g.dataset.turns ?? 1);
    tl.fromTo(g, { rotation: 0 }, { rotation: 360 * turns, svgOrigin: "120 120", duration: 1.2, ease: "none" }, at);
  });
}

/* ----------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------- */

function BeatView({ beat, compact = false }: { beat: RecapBeat; compact?: boolean }) {
  return (
    <div className={cn("grid h-full w-full grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16", compact && "py-8")}>
      <div className="min-w-0 space-y-3 lg:space-y-4">
        <p className={cn("eyebrow lg:text-sm", TONE_TEXT[beat.tone])}>{beat.kicker}</p>
        {beat.figure ? (
          <p className="leading-none">
            {beat.link ? (
              <TargetLink target={beat.link.to} title={`Open ${beat.link.label}`} className="group inline-block rounded-md focus-visible:outline-2">
                <Counter figure={beat.figure} className="text-5xl font-bold tracking-tight text-lind-navy transition-colors group-hover:text-lind-blue sm:text-7xl lg:text-8xl" />
              </TargetLink>
            ) : (
              <Counter figure={beat.figure} className="text-5xl font-bold tracking-tight text-lind-navy sm:text-7xl lg:text-8xl" />
            )}
            {beat.unit && <span className="mt-2 block text-xl font-bold text-lind-navy sm:text-2xl lg:text-3xl">{beat.unit}</span>}
          </p>
        ) : null}
        <p className={cn("text-lind-ink", beat.figure ? "text-lg sm:text-xl lg:text-2xl" : "text-2xl font-bold leading-snug text-lind-navy sm:text-3xl lg:text-4xl")}>{beat.headline}</p>
        {beat.comparison && (
          <p className={cn("border-l-4 bg-card py-3 pl-4 pr-3 text-base font-semibold leading-snug text-lind-ink shadow-lind sm:text-lg lg:py-4 lg:text-xl", TONE_BORDER[beat.tone])}>{beat.comparison}</p>
        )}
        {beat.note && <p className="hidden text-sm leading-relaxed text-lind-grey sm:block">{beat.note}</p>}
        {beat.link && (
          <div className="pt-1">
            <BeatLink link={beat.link} />
          </div>
        )}
      </div>
      <div className="flex min-h-0 min-w-0 items-center justify-center">
        <RecapVisualView visual={beat.visual} tone={beat.tone} />
      </div>
    </div>
  );
}

function SceneShell({ children, tone, label }: { children: ReactNode; tone: "white" | "grey" | "navy"; label: string }) {
  return (
    <section
      data-scene
      aria-label={label}
      className={cn("relative h-svh w-full overflow-hidden", tone === "navy" ? "bg-lind-navy text-white" : tone === "grey" ? "bg-lind-mist" : "bg-card")}
    >
      {children}
    </section>
  );
}

function ChapterScene({ chapter, tone }: { chapter: RecapChapter; tone: "white" | "grey" }) {
  return (
    <SceneShell tone={tone} label={`Question ${chapter.number}: ${chapter.question}`}>
      {/* Intro: the question, big */}
      <div data-intro className="absolute inset-0 flex items-center">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <h2 data-intro-item className="max-w-5xl text-4xl font-bold leading-[1.05] tracking-tight text-lind-navy sm:text-6xl lg:text-7xl">
            {chapter.question}
          </h2>
          <p data-intro-item className="mt-10 flex items-center gap-2 text-base font-semibold text-lind-blue">
            <ArrowDown className="h-5 w-5 animate-bounce" /> Keep scrolling
          </p>
        </div>
      </div>
      {/* Compact header + beats */}
      <div className="absolute inset-0 flex flex-col">
        <div data-head className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lind-navy text-base font-bold text-white">{chapter.number}</span>
            <p className="min-w-0 truncate text-lg font-bold text-lind-navy sm:text-xl">{chapter.question}</p>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-lind-line">
            <div data-progress className="h-full w-full origin-left rounded-full bg-lind-red" />
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {chapter.beats.map((b) => (
            <div key={b.id} data-beat className="invisible absolute inset-0 overflow-hidden">
              <div className="mx-auto flex h-full w-full max-w-6xl items-center px-5 py-4 sm:px-8 sm:py-8">
                <BeatView beat={b} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

export interface RecapCover {
  company: string;
  logo: ReactNode;
  audience: string;
  scope: string;
  stats: Array<{ value: string; label: string; link?: RecapLink }>;
  research?: { state: "running" | "done" | "failed"; country: string; rules: number } | null;
}

/** One "year at a glance" figure; opens its dashboard detail when it has one. */
function CoverStat({ stat, big = false }: { stat: RecapCover["stats"][number]; big?: boolean }) {
  const body = (
    <>
      <span className={cn("flex items-start justify-between gap-2 font-bold", big ? "text-4xl sm:text-6xl" : "text-4xl")}>
        <span>{stat.value}</span>
        {stat.link && <ArrowUpRight className="mt-1 h-6 w-6 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
      </span>
      <span className="mt-1 block text-lg text-white/85">{stat.label}</span>
    </>
  );
  if (!stat.link) return <div className="border-t-4 border-white pt-4">{body}</div>;
  return (
    <TargetLink target={stat.link.to} title={`Open ${stat.link.label}`} className="group -mx-3 block rounded-lg border-t-4 border-white px-3 pb-3 pt-4 transition-colors hover:bg-white/10 focus-visible:outline-2">
      {body}
    </TargetLink>
  );
}

function CoverScene({ recap, cover }: { recap: Recap; cover: RecapCover }) {
  return (
    <SceneShell tone="navy" label={`${recap.title} - ${cover.company}`}>
      <div className="absolute inset-x-0 top-0 h-2 bg-brand-secondary" />
      <div data-intro className="absolute inset-0 flex items-center">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div data-intro-item className="flex items-center gap-4">
            <span className="rounded-lg bg-white p-1.5">{cover.logo}</span>
            <span className="text-xl font-bold sm:text-2xl">{cover.company}</span>
          </div>
          <h1 data-intro-item className="mt-8 text-6xl font-bold leading-none tracking-tight sm:text-8xl lg:text-9xl">
            {recap.periodLabel}
            <span className="block text-4xl text-white/85 sm:text-6xl lg:text-7xl">with Lindström</span>
          </h1>
          <p data-intro-item className="mt-8 text-xl text-white/85 sm:text-2xl">
            Prepared for <strong className="text-white">{cover.audience}</strong> · {cover.scope}
          </p>
          {cover.research && (
            <p data-intro-item className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-base">
              {cover.research.state === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
              {cover.research.state === "running"
                ? `Looking up ${cover.research.country}'s climate and tax rules - the risks update when ready`
                : cover.research.state === "done"
                  ? `${cover.research.rules} ${cover.research.country} rules added to the story`
                  : `${cover.research.country}'s rules could not be looked up this time`}
            </p>
          )}
          <p data-intro-item className="mt-12 flex items-center gap-2 text-lg font-semibold text-white/90">
            <ArrowDown className="h-5 w-5 animate-bounce" /> Scroll to see your year in five questions
          </p>
          <p data-intro-item className="mt-2 hidden text-sm text-white/70 lg:block">Presenting? Use the arrow keys to move answer by answer.</p>
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col">
        <div data-head className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-8">
          <p className="text-lg font-bold">
            {cover.company} · {recap.periodLabel}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div data-progress className="h-full w-full origin-left rounded-full bg-white" />
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <div data-beat className="invisible absolute inset-0">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-5 sm:px-8">
              <p className="eyebrow text-white/80">The year at a glance</p>
              <ul className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
                {cover.stats.map((s) => (
                  <li key={s.label} data-pop>
                    <CoverStat stat={s} big />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

/* ----------------------------------------------------------------------------
 * Story
 * ------------------------------------------------------------------------- */

export function RecapStory({ recap, cover, closing }: { recap: Recap; cover: RecapCover; closing: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const triggers = useRef<ScrollTrigger[]>([]);
  /** Presenter stops: the question, then each answer once its animation has played. */
  const stops = useRef<Array<{ st: ScrollTrigger; time: number; duration: number }>>([]);
  const [active, setActive] = useState(0);
  const signature = useMemo(
    () => recap.chapters.map((c) => `${c.id}:${c.beats.map((b) => `${b.id}=${b.figure?.text ?? ""}`).join(",")}`).join("|") + `|${cover.stats.map((s) => s.value).join(",")}`,
    [recap, cover.stats],
  );
  const scenes = ["Start", ...recap.chapters.map((c) => `${c.number}. ${c.question}`)];

  useGSAP(
    () => {
      // Do not pin DOM until the browser's motion preference is known.
      if (reduced !== false || !root.current) return;
      triggers.current = [];
      stops.current = [];
      const vh = () => window.innerHeight;
      gsap.utils.toArray<HTMLElement>("[data-scene]", root.current).forEach((scene, si) => {
        const intro = scene.querySelector<HTMLElement>("[data-intro]");
        const introItems = scene.querySelectorAll("[data-intro-item]");
        const head = scene.querySelector<HTMLElement>("[data-head]");
        const progress = scene.querySelector<HTMLElement>("[data-progress]");
        const beats = gsap.utils.toArray<HTMLElement>(scene.querySelectorAll("[data-beat]"));

        // The question arrives as the scene scrolls into view…
        gsap.from(introItems, { y: 50, autoAlpha: 0, stagger: 0.12, duration: 0.7, ease: "power2.out", scrollTrigger: { trigger: scene, start: "top 70%", toggleActions: "play none none reverse" } });

        // …then the viewport holds while the answer plays out.
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        gsap.set(beats, { autoAlpha: 0, yPercent: 12 });
        if (head) gsap.set(head, { autoAlpha: 0, y: -16 });
        // Hold the question briefly, then slide it away while the first answer slides in.
        let t = 0.45;
        if (intro) tl.to(intro, { yPercent: -18, autoAlpha: 0, duration: 0.45, ease: "power2.in" }, t);
        if (head) tl.to(head, { autoAlpha: 1, y: 0, duration: 0.45 }, t + 0.25);
        t += 0.4;
        const sceneStops = [0];
        beats.forEach((beat, i) => {
          tl.to(beat, { autoAlpha: 1, yPercent: 0, duration: 0.55 }, t);
          animateBeat(tl, beat, t + 0.2);
          sceneStops.push(t + 1.5);
          t += 2.3;
          if (i < beats.length - 1) {
            // The outgoing answer is almost gone before the next one appears, so text never overlaps.
            tl.to(beat, { autoAlpha: 0, yPercent: -12, duration: 0.4, ease: "power2.in" }, t);
            t += 0.36;
          }
        });
        // Longer tail hold: after the last answer has fully played, the user
        // scrolls a clear stretch before the next slide takes over.
        tl.to({}, { duration: 1.4 }, t + 0.5);
        if (progress) tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1, ease: "none", duration: tl.duration() }, 0);

        const st = ScrollTrigger.create({
          trigger: scene,
          start: "top top",
          end: () => `+=${tl.duration() * vh() * 0.42}`,
          pin: true,
          scrub: 0.6,
          animation: tl,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onToggle: (self) => {
            if (self.isActive) setActive(si);
          },
        });
        triggers.current[si] = st;
        const total = tl.duration();
        sceneStops.forEach((time) => stops.current.push({ st, time, duration: total }));
      });
      if (bar.current) {
        gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.3 } });
      }
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    },
    { scope: root, dependencies: [reduced, signature], revertOnUpdate: true },
  );

  // Presenter keys: → / ↓ / PageDown go to the next answer, ← / ↑ / PageUp to the previous one.
  useEffect(() => {
    if (reduced !== false) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const next = e.key === "ArrowRight" || e.key === "PageDown" || e.key === "ArrowDown";
      const prev = e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp";
      if (!next && !prev) return;
      const positions = stops.current.map(({ st, time, duration }) => st.start + (duration ? time / duration : 0) * (st.end - st.start));
      const y = window.scrollY;
      const target = next ? positions.find((p) => p > y + 8) : [...positions].reverse().find((p) => p < y - 8);
      if (target === undefined) return;
      e.preventDefault();
      window.scrollTo({ top: Math.ceil(target), behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reduced]);

  const jump = (i: number) => {
    const st = triggers.current[i];
    if (st) window.scrollTo({ top: st.start + (i === 0 ? 0 : 2), behavior: "smooth" });
  };

  if (reduced) {
    return (
      <div className="bg-card">
        <StaticRecap recap={recap} cover={cover} />
        {closing}
      </div>
    );
  }

  return (
    <div ref={root} className="relative">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-1">
        <div ref={bar} className="h-full origin-left bg-lind-red" />
      </div>
      <nav aria-label="Recap chapters" className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        {scenes.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => jump(i)}
            title={label}
            aria-label={label}
            aria-current={active === i ? "step" : undefined}
            className={cn(
              "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-bold shadow-lind transition-colors",
              active === i ? "border-lind-red bg-lind-red text-white" : "border-lind-line bg-card text-lind-grey hover:border-lind-navy",
            )}
          >
            {i === 0 ? "★" : i}
          </button>
        ))}
      </nav>
      <CoverScene recap={recap} cover={cover} />
      {recap.chapters.map((c, i) => (
        <ChapterScene key={c.id} chapter={c} tone={i % 2 === 0 ? "white" : "grey"} />
      ))}
      {closing}
    </div>
  );
}

/** Same story without motion (reduced-motion users): every answer stacked and fully visible. */
function StaticRecap({ recap, cover }: { recap: Recap; cover: RecapCover }) {
  return (
    <>
      <section className="bg-lind-navy py-16 text-white">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-white p-1.5">{cover.logo}</span>
            <span className="text-xl font-bold">{cover.company}</span>
          </div>
          <h1 className="mt-6 text-6xl font-bold leading-none sm:text-8xl">
            {recap.periodLabel} <span className="block text-4xl text-white/85 sm:text-6xl">with Lindström</span>
          </h1>
          <p className="mt-6 text-xl text-white/85">
            Prepared for <strong className="text-white">{cover.audience}</strong> · {cover.scope}
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            {cover.stats.map((s) => (
              <li key={s.label}>
                <CoverStat stat={s} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      {recap.chapters.map((c, i) => (
        <section key={c.id} className={cn("py-16", i % 2 === 0 ? "bg-card" : "bg-lind-mist")} aria-label={`Question ${c.number}`}>
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h2 className="text-4xl font-bold leading-tight text-lind-navy sm:text-5xl">{c.question}</h2>
            <div className="mt-6 divide-y divide-lind-line">
              {c.beats.map((b) => (
                <BeatView key={b.id} beat={b} compact />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
