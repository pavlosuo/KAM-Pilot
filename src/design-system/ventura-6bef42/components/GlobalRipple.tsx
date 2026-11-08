import { useEffect } from "react";

/**
 * Adds a Material-style ripple to every button in the app on press.
 * Purely presentational: listens on the document and injects a short-lived span.
 */
export function GlobalRipple() {
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>('button, [role="button"], .ripple-target');
      if (!el) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
      if (el.dataset.noRipple === "true") return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const style = window.getComputedStyle(el);
      if (style.position === "static") el.style.position = "relative";
      el.style.overflow = "hidden";

      const size = Math.max(rect.width, rect.height) * 2;
      const span = document.createElement("span");
      span.className = "ui-ripple";
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.left = `${e.clientX - rect.left - size / 2}px`;
      span.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(span);
      window.setTimeout(() => span.remove(), 600);
    };

    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, []);

  return null;
}
