import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ensureMyHandle } from "@/design-system/ventura-6bef42/lib/public-profiles.functions";

type Props = {
  /** Path under origin, e.g. `/u/${handle}` or `/startup/${slug}`. */
  buildPath?: (handle: string) => string;
  /** When set, use this path directly and skip handle fetch. */
  staticPath?: string;
  title?: string;
  description?: string;
};

export function PublicShareCard({ buildPath, staticPath, title = "Public link", description = "Anyone with this link can view your profile." }: Props) {
  const fn = useServerFn(ensureMyHandle);
  const [path, setPath] = useState<string | null>(staticPath ?? null);
  const [loading, setLoading] = useState(!staticPath);

  useEffect(() => {
    if (staticPath) return;
    (async () => {
      try {
        const r = (await fn({})) as { handle: string };
        if (r?.handle && buildPath) setPath(buildPath(r.handle));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = path ? `${origin}${path}` : "";

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={loading ? "Generating link…" : url} className="text-xs font-mono" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!url}
            onClick={async () => {
              try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
              catch { toast.error("Couldn't copy"); }
            }}
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            asChild
            disabled={!url}
            aria-label="Open link"
          >
            <a href={url || "#"} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
