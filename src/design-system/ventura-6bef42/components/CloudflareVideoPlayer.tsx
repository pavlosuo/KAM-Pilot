import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStreamCustomerCode } from "@/design-system/ventura-6bef42/lib/cloudflare-stream.functions";

type Props = {
  uid: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  poster?: string;
  title?: string;
  loop?: boolean;
};

let cachedCode: string | null | undefined;

export function CloudflareVideoPlayer({
  uid,
  className,
  autoplay = false,
  muted = false,
  controls = true,
  poster,
  title = "Pitch video",
  loop = true,
}: Props) {
  const fnCode = useServerFn(getStreamCustomerCode);
  const [code, setCode] = useState<string | null | undefined>(cachedCode);

  useEffect(() => {
    if (cachedCode !== undefined) {
      setCode(cachedCode);
      return;
    }
    let alive = true;
    fnCode()
      .then((r) => {
        cachedCode = r.customerCode ?? null;
        if (alive) setCode(cachedCode);
      })
      .catch(() => {
        cachedCode = null;
        if (alive) setCode(null);
      });
    return () => {
      alive = false;
    };
  }, [fnCode]);

  if (code === undefined) {
    return (
      <div
        className={
          "flex items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground " +
          (className ?? "aspect-video w-full")
        }
      >
        Loading video…
      </div>
    );
  }
  if (!code) {
    return (
      <div
        className={
          "flex items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground " +
          (className ?? "aspect-video w-full")
        }
      >
        Video unavailable
      </div>
    );
  }

  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "true");
  if (muted) params.set("muted", "true");
  if (!controls) params.set("controls", "false");
  if (poster) params.set("poster", poster);
  if (loop) params.set("loop", "true");
  const qs = params.toString();
  // Normalize: accept raw code, "customer-xxx", or a full URL like
  // "https://customer-xxx.cloudflarestream.com" — extract just the subdomain id.
  let id = code.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  id = id.split(".")[0]; // drop ".cloudflarestream.com..." if present
  id = id.replace(/^customer-/, "");
  const src = `https://customer-${id}.cloudflarestream.com/${uid}/iframe${qs ? `?${qs}` : ""}`;

  return (
    <div className={"relative overflow-hidden rounded-2xl border border-border/20 bg-black shadow-lg " + (className ?? "aspect-video w-full")}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media;"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

export default CloudflareVideoPlayer;
