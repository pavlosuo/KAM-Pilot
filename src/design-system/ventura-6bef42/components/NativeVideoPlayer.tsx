import { useState, useRef, useEffect } from "react";
import { CloudflareVideoPlayer } from "./CloudflareVideoPlayer";

type Props = {
  uid: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  poster?: string;
  loop?: boolean;
};

export function NativeVideoPlayer({
  uid,
  className,
  autoplay = false,
  muted = false,
  controls = true,
  poster,
  loop = true,
}: Props) {
  const [fallback, setFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onError = () => setFallback(true);
    v.addEventListener("error", onError);
    // Also catch when the browser cannot decode the source
    const onCanPlay = () => {
      // If canplay fires, native HLS is working — do nothing.
    };
    v.addEventListener("canplay", onCanPlay);
    return () => {
      v.removeEventListener("error", onError);
      v.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  if (fallback) {
    return (
      <CloudflareVideoPlayer
        uid={uid}
        className={className}
        autoplay={autoplay}
        muted={muted}
        controls={controls}
        poster={poster}
        loop={loop}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/20 bg-black shadow-lg ${className ?? "aspect-video w-full"}`}
    >
      <video
        ref={videoRef}
        src={`https://videodelivery.net/${uid}/manifest/video.m3u8`}
        autoPlay={autoplay}
        muted={muted}
        controls={controls}
        poster={poster}
        playsInline
        loop={loop}
        disablePictureInPicture
        controlsList="nopictureinpicture"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

export default NativeVideoPlayer;
