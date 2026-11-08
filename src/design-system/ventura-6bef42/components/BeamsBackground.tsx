"use client";

import { useEffect, useRef, createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

type BeamsContextValue = {
  disabled: boolean;
  disable: (reason: string) => void;
  enable: (reason: string) => void;
};

const BeamsContext = createContext<BeamsContextValue | null>(null);

export function BeamsProvider({ children }: { children: ReactNode }) {
  const [reasons, setReasons] = useState<Set<string>>(new Set());

  const disable = useCallback((reason: string) => {
    setReasons((prev) => new Set(prev).add(reason));
  }, []);

  const enable = useCallback((reason: string) => {
    setReasons((prev) => {
      const next = new Set(prev);
      next.delete(reason);
      return next;
    });
  }, []);

  const disabled = reasons.size > 0;

  return (
    <BeamsContext.Provider value={{ disabled, disable, enable }}>
      {children}
    </BeamsContext.Provider>
  );
}

export function useBeamsControl() {
  const ctx = useContext(BeamsContext);
  if (!ctx) throw new Error("useBeamsControl must be used within BeamsProvider");
  return ctx;
}

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

function createBeam(width: number, height: number, isDarkMode: boolean): Beam {
  const angle = -35 + Math.random() * 10;
  const hueBase = isDarkMode ? 190 : 210;
  const hueRange = isDarkMode ? 70 : 50;

  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.5,
    angle,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue: hueBase + Math.random() * hueRange,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  };
}

const OPACITY_MAP = {
  subtle: 0.7,
  medium: 0.85,
  strong: 1,
} as const;

/**
 * Animated beams canvas rendered behind every page.
 * Fixed, pointer-events-none, sits under all app content.
 */
export default function BeamsBackground({
  className,
  intensity = "medium",
  disabled: disabledProp = false,
}: {
  className?: string;
  intensity?: keyof typeof OPACITY_MAP;
  disabled?: boolean;
}) {
  const ctx = useContext(BeamsContext);
  const isRouterLoading = useRouterState({ select: (s) => s.isLoading });
  const pathname = useRouterState({ select: (s) => s.location?.pathname ?? "" });
  const isPublicProfile = pathname.startsWith("/startup/") || pathname.startsWith("/u/");
  const disabled = ctx ? ctx.disabled || disabledProp || isRouterLoading || isPublicProfile : disabledProp || isRouterLoading || isPublicProfile;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beamsRef = useRef<Beam[]>([]);
  const animationFrameRef = useRef(0);
  const isDarkModeRef = useRef(false);
  const MINIMUM_BEAMS = 20;

  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateDarkMode = () => {
      isDarkModeRef.current = document.documentElement.classList.contains("dark");
    };
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    updateDarkMode();

    const updateCanvasSize = () => {
      // The beams are heavily blurred, so rendering at half resolution is
      // visually identical while cutting the per-frame pixel cost ~4x.
      const scale = 0.5;
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(scale, scale);

      const totalBeams = Math.round(MINIMUM_BEAMS * 1.5);
      beamsRef.current = Array.from({ length: totalBeams }, () =>
        createBeam(window.innerWidth, window.innerHeight, isDarkModeRef.current)
      );
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    function resetBeam(beam: Beam, index: number, totalBeams: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const column = index % 3;
      const spacing = w / 3;
      const hueBase = isDarkModeRef.current ? 190 : 210;
      const hueRange = isDarkModeRef.current ? 70 : 50;

      beam.y = h + 100;
      beam.x = column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.width = 100 + Math.random() * 100;
      beam.length = h * 2.5;
      beam.speed = 0.5 + Math.random() * 0.4;
      beam.hue = hueBase + (index * hueRange) / totalBeams;
      beam.opacity = 0.2 + Math.random() * 0.1;
      return beam;
    }

    function drawBeam(context: CanvasRenderingContext2D, beam: Beam) {
      context.save();
      context.translate(beam.x, beam.y);
      context.rotate((beam.angle * Math.PI) / 180);

      const pulsingOpacity =
        beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * OPACITY_MAP[intensity];

      const gradient = context.createLinearGradient(0, 0, 0, beam.length);
      const saturation = isDarkModeRef.current ? "85%" : "75%";
      const lightness = isDarkModeRef.current ? "65%" : "45%";

      gradient.addColorStop(0, `hsla(${beam.hue}, ${saturation}, ${lightness}, 0)`);
      gradient.addColorStop(0.1, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity * 0.5})`);
      gradient.addColorStop(0.4, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity})`);
      gradient.addColorStop(0.6, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity})`);
      gradient.addColorStop(0.9, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity * 0.5})`);
      gradient.addColorStop(1, `hsla(${beam.hue}, ${saturation}, ${lightness}, 0)`);

      context.fillStyle = gradient;
      context.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      context.restore();
    }

    // Cap to ~30fps and skip work entirely while the tab is hidden.
    const FRAME_MS = 1000 / 30;
    let last = 0;

    function animate(now: number) {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (!canvas || !ctx) return;
      if (document.hidden) return;
      if (now - last < FRAME_MS) return;
      last = now;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.filter = "blur(35px)";

      const totalBeams = beamsRef.current.length;
      beamsRef.current.forEach((beam, index) => {
        // Keep motion consistent now that we draw half as often.
        beam.y -= beam.speed * 2;
        beam.pulse += beam.pulseSpeed * 2;
        if (beam.y + beam.length < -100) resetBeam(beam, index, totalBeams);
        drawBeam(ctx, beam);
      });
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      observer.disconnect();
    };
  }, [disabled, intensity]);

  if (disabled) {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 -z-10 bg-background",
          className
        )}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background",
        className
      )}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute inset-0 bg-background/55" />
    </div>
  );
}
