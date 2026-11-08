import confetti from "canvas-confetti";

/** Fires a celebratory confetti burst. Safe to call in the browser only. */
export function fireCelebrationConfetti() {
  if (typeof window === "undefined") return;
  const defaults = { spread: 70, ticks: 120, gravity: 0.9, scalar: 1, zIndex: 9999 };
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.5 } });
  window.setTimeout(
    () => confetti({ ...defaults, particleCount: 60, angle: 60, origin: { x: 0.1, y: 0.7 } }),
    200,
  );
  window.setTimeout(
    () => confetti({ ...defaults, particleCount: 60, angle: 120, origin: { x: 0.9, y: 0.7 } }),
    350,
  );
}
