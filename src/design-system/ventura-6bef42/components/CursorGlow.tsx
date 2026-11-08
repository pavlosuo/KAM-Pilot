import { useEffect, useRef } from "react";

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const hasPointer = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;

    const moveTo = (x: number, y: number) => {
      target.current = { x, y };
      if (!hasPointer.current) {
        hasPointer.current = true;
        pos.current = { x, y };
        if (ref.current) ref.current.style.opacity = "1";
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      moveTo(e.clientX, e.clientY);
    };

    const onMove = (e: MouseEvent) => {
      moveTo(e.clientX, e.clientY);
    };

    const hide = () => {
      hasPointer.current = false;
      if (ref.current) ref.current.style.opacity = "0";
    };

    const tick = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.045;
      pos.current.y += (target.current.y - pos.current.y) * 0.045;
      if (ref.current) {
        ref.current.style.transform = `translate3d(${pos.current.x - 300}px, ${pos.current.y - 300}px, 0)`;
      }
      raf.current = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("blur", hide);
    document.documentElement.addEventListener("mouseleave", hide);
    raf.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("blur", hide);
      document.documentElement.removeEventListener("mouseleave", hide);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[600px] w-[600px] mix-blend-multiply dark:mix-blend-screen"
      style={{
        background:
          "radial-gradient(circle at center, oklch(0.2 0 0 / 0.18) 0%, oklch(0.2 0 0 / 0.06) 35%, transparent 65%)",
        opacity: 0,
        transform: "translate3d(-9999px, -9999px, 0)",
        transition: "opacity 120ms ease-out",
        willChange: "transform",
      }}
    />
  );
}
