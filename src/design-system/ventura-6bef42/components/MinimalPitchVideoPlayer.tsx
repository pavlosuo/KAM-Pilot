import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type Hls from "hls.js";

type Props = {
  uid: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string;
  topRight?: React.ReactNode;
  /** When false, the stream is not loaded at all (off-screen feed slides). */
  active?: boolean;
};

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MinimalPitchVideoPlayer({
  uid,
  className,
  autoplay = true,
  muted = false,
  loop = true,
  poster,
  topRight,
  active = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [volOpen, setVolOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wasPlayingRef = useRef(false);
  const durationRef = useRef(0);
  const videoSrc = `https://videodelivery.net/${uid}/manifest/video.m3u8`;

  const getPlayableDuration = (v: HTMLVideoElement) => {
    if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
    const ranges = v.seekable;
    if (ranges.length > 0) {
      const end = ranges.end(ranges.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
    return 0;
  };

  const restartingRef = useRef(false);
  const playVideo = (v: HTMLVideoElement) => {
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => setPlaying(false));
    }
  };

  const restartVideo = (v: HTMLVideoElement, force = false) => {
    if (restartingRef.current && !force) return;
    restartingRef.current = false;
    restartingRef.current = true;

    const clear = () => {
      v.removeEventListener("seeked", onSeeked);
      restartingRef.current = false;
    };
    const onSeeked = () => {
      clear();
      playVideo(v);
    };
    v.addEventListener("seeked", onSeeked, { once: true });

    try {
      v.currentTime = 0;
    } catch {
      clear();
      playVideo(v);
      return;
    }

    // Safety: if 'seeked' never fires, still try to play.
    window.setTimeout(() => {
      if (restartingRef.current) {
        clear();
        playVideo(v);
      }
    }, 500);
  };

  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active) return;

    let destroyed = false;
    let hls: Hls | null = null;

    v.removeAttribute("src");
    v.load();

    void import("hls.js")
      .then(({ default: Hls }) => {
        if (destroyed) return;

        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            // Keep the buffer modest so one slide never hogs bandwidth,
            // and large enough to ride out network jitter.
            maxBufferLength: 30,
            backBufferLength: 15,
            maxMaxBufferLength: 60,
          });
          hlsRef.current = hls;
          hls.loadSource(videoSrc);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (autoplay && !destroyed) playVideo(v);
          });
          hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; type?: string }) => {
            if (!hls) return;
            if (!data.fatal) {
              // Non-fatal stall (e.g. buffer underrun) — kick the loader.
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else hls.startLoad();
          });
          return;
        }

        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = videoSrc;
          v.load();
          if (autoplay) playVideo(v);
        }
      })
      .catch(() => {
        if (destroyed) return;
        v.src = videoSrc;
        v.load();
        if (autoplay) playVideo(v);
      });

    return () => {
      destroyed = true;
      hlsRef.current = null;
      hls?.destroy();
      v.removeAttribute("src");
      v.load();
    };
  }, [autoplay, videoSrc, active]);

  // Stall watchdog: if the video should be playing but time stops
  // advancing (buffer underrun that hls.js didn't recover from), nudge it.
  useEffect(() => {
    if (!active) return;
    let lastTime = -1;
    let stuckTicks = 0;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.seeking || dragging) {
        lastTime = -1;
        stuckTicks = 0;
        return;
      }
      const t = v.currentTime;
      const playableDuration = getPlayableDuration(v);
      if (playableDuration > 0 && t >= playableDuration - 0.35) return; // near end — loop logic handles it
      if (t === lastTime) {
        stuckTicks += 1;
        if (stuckTicks >= 4) {
          stuckTicks = 0;
          hlsRef.current?.startLoad();
          if (v.readyState < 2 && t > 0) {
            // Skip past a possibly broken segment boundary.
            try { v.currentTime = t + 0.05; } catch { /* ignore */ }
          }
          playVideo(v);
        }
      } else {
        stuckTicks = 0;
      }
      lastTime = t;
    }, 500);
    return () => window.clearInterval(id);
  }, [active, dragging]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = isMuted;
      v.volume = volume;
    }
  }, [isMuted, volume]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = false;

    const restart = () => restartVideo(v);
    const onTime = () => {
      const playableDuration = getPlayableDuration(v);
      if (playableDuration > 0 && playableDuration !== durationRef.current) {
        durationRef.current = playableDuration;
        setDuration(playableDuration);
      }

      setCurrent(v.currentTime);

      const nearEnd = playableDuration > 0 && v.currentTime >= playableDuration - 0.35;
      if (loop && nearEnd && !v.seeking && !dragging) {
        restart();
      }
    };
    const onMeta = () => {
      const playableDuration = getPlayableDuration(v);
      durationRef.current = playableDuration;
      setDuration(playableDuration);
    };
    const onPlay = () => { setPlaying(true); setUserPaused(false); };
    const onPause = () => {
      setPlaying(false);
      const playableDuration = getPlayableDuration(v) || durationRef.current;
      const pausedAtEnd = playableDuration > 0 && v.currentTime >= playableDuration - 0.75;
      if (loop && pausedAtEnd && !dragging) restart();
    };
    const onEnded = () => {
      if (loop) restart();
    };
    const watchdog = window.setInterval(() => {
      if (!loop || dragging) return;
      const playableDuration = getPlayableDuration(v) || durationRef.current;
      const stuckAtEnd = playableDuration > 0 && v.currentTime >= playableDuration - 0.75;
      if (stuckAtEnd && (v.paused || v.ended)) restart();
    }, 250);

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      window.clearInterval(watchdog);
    };
  }, [uid, loop, dragging]);


  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const playableDuration = getPlayableDuration(v) || durationRef.current;
      const pausedAtEnd = playableDuration > 0 && v.currentTime >= playableDuration - 0.5;
      if (v.ended || pausedAtEnd) restartVideo(v, true);
      else playVideo(v);
      setUserPaused(false);
    }
    else {
      v.pause();
      setUserPaused(true);
    }
  };

  const pctFromClientX = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const seekToClientX = (clientX: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = pctFromClientX(clientX) * duration;
  };

  const onBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const v = videoRef.current;
    if (v) {
      wasPlayingRef.current = !v.paused;
      v.pause();
    }
    setDragging(true);
    seekToClientX(e.clientX);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      seekToClientX(e.clientX);
      setHoverPct(pctFromClientX(e.clientX) * 100);
    };
    const onUp = () => {
      setDragging(false);
      if (wasPlayingRef.current) void videoRef.current?.play();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, duration]);

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className={`relative overflow-hidden ${className ?? "aspect-video w-full"}`}>
      <video
        ref={videoRef}
        autoPlay={autoplay}
        muted={isMuted}
        loop={false}
        playsInline
        preload="auto"
        poster={poster}
        onClick={toggle}
        className="absolute inset-0 h-full w-full cursor-pointer bg-black object-contain"
      />

      {/* Top overlay bar - three columns: time | sound | tags */}
      <div className="absolute top-0 left-0 right-0 z-20 grid grid-cols-[auto_auto_1fr] items-center gap-2 px-4 pt-4">
        {/* Left: time */}
        <div className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-black/70 px-3 text-xs font-medium tabular-nums text-white pointer-events-none select-none">
          {fmt(current)} / {fmt(duration)}
        </div>

        {/* Middle: sound */}
        <div
          className="relative"
          onMouseEnter={() => setVolOpen(true)}
          onMouseLeave={() => setVolOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/80 transition"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          {/* Volume slider dropdown */}
          {volOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 pb-1">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-black/80 px-2 py-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (v > 0 && isMuted) setIsMuted(false);
                    if (v === 0 && !isMuted) setIsMuted(true);
                  }}
                  className="w-24 h-1.5 accent-white cursor-pointer"
                  style={{ writingMode: "horizontal-tb" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: tags */}
        {topRight ? (
          <div className="flex items-center justify-end min-w-0">
            {topRight}
          </div>
        ) : (
          <div />
        )}
      </div>


      {/* Play indicator overlay when paused */}
      {!playing && userPaused && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-16 w-16 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Progress bar (bottom) with hover scrubber */}
      <div
        ref={barRef}
        onMouseDown={onBarMouseDown}
        onMouseMove={(e) => setHoverPct(pctFromClientX(e.clientX) * 100)}
        onMouseLeave={() => !dragging && setHoverPct(null)}
        className="group absolute bottom-0 left-0 right-0 z-30 flex h-5 cursor-pointer items-end px-0 select-none"
      >
        <div className="relative h-1 w-full rounded-full bg-white/60 transition-all group-hover:h-1.5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
            style={{ width: `${pct}%`, backgroundColor: "#ffffff" }}
          />

          {(hoverPct !== null || dragging) && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.25),0_0_10px_rgba(255,255,255,0.9)]"
              style={{ left: `${pct}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MinimalPitchVideoPlayer;
