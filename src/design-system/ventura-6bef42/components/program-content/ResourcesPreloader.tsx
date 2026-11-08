import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { useProgramWorkspace } from "@/design-system/ventura-6bef42/hooks/use-program-workspace";
import { getStartupResources } from "@/design-system/ventura-6bef42/lib/startup-resources.functions";
import { warmPreviewImages } from "@/design-system/ventura-6bef42/lib/resource-preview";

/**
 * Warms the "Recommended by Ventura AI" data + preview images in the background
 * as soon as a signed-in user lands on any authenticated page, so /program-content
 * renders instantly.
 */
export function ResourcesPreloader() {
  const { user, loading } = useAuth();
  const { items } = useProgramWorkspace();
  const queryClient = useQueryClient();
  const load = useServerFn(getStartupResources);

  useEffect(() => {
    if (loading || !user || !items.length) return;
    let cancelled = false;

    const run = async () => {
      for (const item of items) {
        if (cancelled) return;
        try {
          const data = await queryClient.ensureQueryData({
            queryKey: ["startup-resources", item.startupId],
            queryFn: () =>
              load({ data: { startupId: item.startupId, programId: item.programId } }),
            staleTime: 30 * 60_000,
            retry: false,
          });
          if (!cancelled) warmPreviewImages(data?.resources ?? []);
        } catch {
          // preloading is best-effort
        }
      }
    };

    const ric = (window as unknown as {
      requestIdleCallback?: (c: () => void) => number;
    }).requestIdleCallback;
    const idle = (cb: () => void) => (ric ? ric(cb) : window.setTimeout(cb, 1200));

    idle(() => void run());

    return () => {
      cancelled = true;
    };
  }, [loading, user, items, queryClient, load]);

  return null;
}
