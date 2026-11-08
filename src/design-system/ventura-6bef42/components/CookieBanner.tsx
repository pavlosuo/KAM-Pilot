import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useCookieConsent } from "@/design-system/ventura-6bef42/hooks/use-cookie-consent";

export function CookieBanner() {
  const { isOpen, accept, reject, close } = useCookieConsent();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isExcluded = pathname === "/moksh" || pathname.startsWith("/moksh/");

  if (!mounted || !isOpen || isExcluded) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-6 sm:right-auto sm:max-w-md">
      <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-md">
        <p className="text-sm text-foreground/90 leading-relaxed">
          We use cookies for analytics and advertising measurement. Your data helps us improve
          and reach the right founders.{" "}
          <Link
            to="/privacy"
            onClick={close}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Privacy Policy
          </Link>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={accept}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Accept
          </button>
          <button
            onClick={reject}
            className="inline-flex items-center justify-center rounded-full border border-border bg-transparent px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
