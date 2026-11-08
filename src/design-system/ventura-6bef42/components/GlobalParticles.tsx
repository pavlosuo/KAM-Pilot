import { useEffect } from "react";

/**
 * Fires a small particle burst instantly on click (before any backend call resolves)
 * for: top nav bar buttons, Save/Cancel-style buttons, video feed action buttons,
 * and anything marked with data-particles="true".
 */
const ACTION_WORDS = [
  "save",
  "cancel",
  "submit",
  "confirm",
  "apply",
  "publish",
  "update",
  "create",
  "continue",
  "done",
  "send",
  "follow",
  "following",
  "like",
  "comment",
  "share",
];

function shouldBurst(el: HTMLElement): boolean {
  if (el.dataset.particles === "false") return false;
  if (el.dataset.particles === "true") return true;
  if (el.closest("[data-particle-zone]")) return true;
  if (el.closest("header, nav")) return true;

  const label = (el.textContent || el.getAttribute("aria-label") || "")
    .trim()
    .toLowerCase();
  if (!label || label.length > 24) return false;
  return ACTION_WORDS.some(
    (w) => label === w || label.startsWith(`${w} `) || label.endsWith(` ${w}`)
  );
}

export function GlobalParticles() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>('button, [role="button"], a[data-particles="true"]');
      if (!el) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
      if (!shouldBurst(el)) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // instant press feedback, independent of any async handler
      el.classList.add("particle-press");
      window.setTimeout(() => el.classList.remove("particle-press"), 140);

      for (let i = 0; i < 6; i++) {
        const dot = document.createElement("span");
        dot.className = "ui-particle";
        dot.style.left = `${centerX}px`;
        dot.style.top = `${centerY}px`;
        dot.style.setProperty(
          "--px",
          `${(i % 2 ? 1 : -1) * (Math.random() * 50 + 20)}px`
        );
        dot.style.setProperty("--py", `${-(Math.random() * 50 + 20)}px`);
        dot.style.animationDelay = `${i * 0.05}s`;
        document.body.appendChild(dot);
        window.setTimeout(() => dot.remove(), 900 + i * 50);
      }
    };

    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, []);

  return null;
}
