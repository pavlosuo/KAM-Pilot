import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export type TourStep = {
  /** CSS selector of the element to highlight. Omit for a centered modal step. */
  target?: string;
  title: string;
  body: React.ReactNode;
  /** Optional primary action rendered next to "Next". */
  action?: { label: string; onClick: () => void };
  /** Runs before the step is shown — e.g. navigate to another page or open a dialog. */
  beforeStep?: () => void | Promise<void>;
};


type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;

export function ProductTour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step?.target]);

  // Run the step's side effect (navigate / open dialog), wait for the target
  // to exist, scroll it into view, then measure.
  useEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    const timers: number[] = [];

    void (async () => {
      try {
        await step.beforeStep?.();
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      const start = Date.now();
      const tick = () => {
        if (cancelled) return;
        const el = step.target
          ? (document.querySelector(step.target) as HTMLElement | null)
          : null;
        if (step.target && !el) {
          if (Date.now() - start < 4000) {
            timers.push(window.setTimeout(tick, 120));
          } else {
            setRect(null);
          }
          return;
        }
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        measure();
        timers.push(window.setTimeout(measure, 240));
        timers.push(window.setTimeout(measure, 600));
      };
      tick();
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [open, index, step, measure]);


  useEffect(() => {
    if (!open) return;
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, measure]);

  // Position the tooltip near the highlight (or centered when there is none).
  useLayoutEffect(() => {
    if (!open) return;
    const tip = tipRef.current;
    if (!tip) return;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setTipPos({ top: Math.max(16, (vh - th) / 2), left: Math.max(16, (vw - tw) / 2) });
      return;
    }
    const below = rect.top + rect.height + PAD + 12;
    const above = rect.top - th - PAD - 12;
    const top = below + th < vh - 16 ? below : above > 16 ? above : Math.max(16, (vh - th) / 2);
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.min(Math.max(16, left), Math.max(16, vw - tw - 16));
    setTipPos({ top, left });
  }, [rect, open, index]);

  if (!open || !mounted || !step) return null;

  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Dimmer + spotlight */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary/70 transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/62" />
      )}

      {/* Click-catcher so the underlying UI stays inert */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        ref={tipRef}
        className={cn(
          "absolute w-[min(92vw,26rem)] rounded-2xl border border-border bg-background p-5 shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        style={tipPos ? { top: tipPos.top, left: tipPos.left } : { opacity: 0 }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step {index + 1} of {steps.length}
        </div>
        <h3 className="pr-6 text-lg font-semibold leading-tight">{step.title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {steps.length > 10 ? (
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted-foreground/25">
              <span
                className="block h-full rounded-full bg-primary transition-all"
                style={{ width: `${((index + 1) / steps.length) * 100}%` }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30",
                  )}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step.action && (
              <Button size="sm" variant="outline" onClick={step.action.onClick}>
                {step.action.label}
              </Button>
            )}
            <Button size="sm" onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}>
              {isLast ? "Got it" : "Next"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
