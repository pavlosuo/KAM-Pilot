import { useRouter } from "@tanstack/react-router";

/**
 * Returns a handler that goes back in the router history when possible,
 * falling back to the home page only when there is nothing to go back to.
 */
export function useGoBack(fallback: string = "/") {
  const router = useRouter();
  return () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    if (typeof document !== "undefined" && document.referrer) {
      try {
        if (new URL(document.referrer).origin === window.location.origin) {
          window.history.back();
          return;
        }
      } catch {
        // ignore malformed referrer
      }
    }
    void router.navigate({ to: fallback });
  };
}
