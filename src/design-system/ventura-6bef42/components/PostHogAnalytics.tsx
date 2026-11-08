import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";

let initialized = false;

async function loadPosthog() {
  const mod = await import("posthog-js");
  return mod.default;
}

/**
 * Client-only PostHog analytics with session replay.
 * Captures pageviews on route change and identifies signed-in users.
 */
export function PostHogAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.href });
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || initialized) return;
    const token = import.meta.env['VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY'] as string | undefined;
    if (!token) return;
    initialized = true;

    const region = (import.meta.env['VITE_LOVABLE_CONNECTOR_POSTHOG_REGION'] as string | undefined) || "eu";
    const apiHost = region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";

    void (async () => {
      try {
        const posthog = await loadPosthog();
        posthog.init(token, {
          api_host: apiHost,
          capture_pageview: false,
          person_profiles: "identified_only",
          disable_session_recording: false,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: "[data-ph-mask]",
          },
        });

        const applyUser = (user: { id: string; email?: string | null } | null) => {
          if (user) {
            posthog.identify(user.id, user.email ? { email: user.email } : undefined);
          } else {
            posthog.reset();
          }
        };

        // Read the already-persisted session instead of issuing a second user
        // request while AuthProvider is hydrating. Concurrent getUser calls can
        // contend for the auth lock and leave the initial route suspended.
        const { data } = await supabase.auth.getSession();
        applyUser(
          data.session?.user
            ? { id: data.session.user.id, email: data.session.user.email }
            : null,
        );

        supabase.auth.onAuthStateChange((_event, session) => {
          applyUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
        });
      } catch {
        initialized = false;
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!import.meta.env['VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY']) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    void loadPosthog()
      .then((posthog) => {
        if (posthog.__loaded) posthog.capture("$pageview");
      })
      .catch(() => {
        /* analytics must never affect navigation */
      });
  }, [pathname]);

  return null;
}

export default PostHogAnalytics;
