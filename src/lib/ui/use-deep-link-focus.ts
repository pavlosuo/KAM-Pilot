import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

/** Anchors that only exist for some audiences fall back to a nearby section. */
const FALLBACK: Record<string, string> = { money: "savings" };

/**
 * When a dashboard page is opened with a #hash (for example from a Recap
 * link), wait for the section to render, scroll it into view and let it glow
 * briefly so the reader sees where they landed.
 */
export function useDeepLinkFocus() {
  const href = useRouterState({ select: (s) => `${s.location.pathname}#${s.location.hash}` });
  useEffect(() => {
    const hash = decodeURIComponent(href.slice(href.indexOf("#") + 1));
    if (!hash) return;
    let tries = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const go = () => {
      const el = document.getElementById(hash) ?? (FALLBACK[hash] ? document.getElementById(FALLBACK[hash]) : null);
      if (!el) {
        if (tries++ < 25) retry = setTimeout(go, 120);
        return;
      }
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      el.setAttribute("data-deep-link", "on");
      clear = setTimeout(() => el.setAttribute("data-deep-link", ""), 3200);
    };
    retry = setTimeout(go, 60);
    return () => {
      clearTimeout(retry);
      clearTimeout(clear);
    };
  }, [href]);
}
