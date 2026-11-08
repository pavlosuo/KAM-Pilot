"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export interface Chapter {
  /** Stable, unique identifier for the chapter. */
  id: string;
  /** Bold heading shown at the top of the preview card. */
  title: string;
  /** Supporting copy shown under the title (clamped to three lines). */
  description?: React.ReactNode;
  /** Small muted label rendered above the title. */
  meta?: React.ReactNode;
}

export interface ChapterScrubberProps {
  chapters: Chapter[];
  side?: "left" | "right";
  peakLength?: number;
  restLength?: number;
  rowHeight?: number;
  radius?: number;
  currentIndex?: number;
  onActiveChange?: (chapter: Chapter | null, index: number) => void;
  onSelect?: (chapter: Chapter, index: number) => void;
  label?: string;
  className?: string;
}

const CARD_WIDTH = 260;
const GAP = 20;
const POINTER_SPRING = { stiffness: 700, damping: 52, mass: 0.5 };
const STRENGTH_SPRING = { stiffness: 260, damping: 30, mass: 0.6 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Raised-cosine bump: 1 at the crest, 0 beyond the radius.
function bump(distance: number, radius: number) {
  if (distance >= radius) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * (distance / radius)));
}

interface TickProps {
  index: number;
  pointer: MotionValue<number>;
  strength: MotionValue<number>;
  radius: number;
  restLength: number;
  peakLength: number;
  isCurrent: boolean;
}

const Tick = React.memo(function Tick({
  index,
  pointer,
  strength,
  radius,
  restLength,
  peakLength,
  isCurrent,
}: TickProps) {
  const width = useTransform(() => {
    const rise = strength.get() * bump(Math.abs(index - pointer.get()), radius);
    return restLength + rise * (peakLength - restLength);
  });
  const opacity = useTransform(() => {
    const rise = strength.get() * bump(Math.abs(index - pointer.get()), radius);
    const base = isCurrent ? 0.55 : 0.22;
    return base + rise * (1 - base);
  });
  const scaleY = useTransform(() => {
    const rise = strength.get() * bump(Math.abs(index - pointer.get()), radius);
    return 1 + rise * 0.4;
  });

  return (
    <motion.span
      aria-hidden
      style={{ width, opacity, scaleY, height: 2 }}
      className={cn(
        "block rounded-full",
        isCurrent ? "bg-primary" : "bg-foreground",
      )}
    />
  );
});

export function ChapterScrubber({
  chapters,
  side = "right",
  peakLength = 56,
  restLength = 14,
  rowHeight = 10,
  radius = 4,
  currentIndex,
  onActiveChange,
  onSelect,
  label = "Chapters",
  className,
}: ChapterScrubberProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const buttonsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = React.useId();
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const rawPointer = useMotionValue(0);
  const rawStrength = useMotionValue(0);
  const springPointer = useSpring(rawPointer, POINTER_SPRING);
  const springStrength = useSpring(rawStrength, STRENGTH_SPRING);
  const pointer = prefersReducedMotion ? rawPointer : springPointer;
  const strength = prefersReducedMotion ? rawStrength : springStrength;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [engaged, setEngaged] = React.useState(false);
  const [flipped, setFlipped] = React.useState(false);
  const [cardHeight, setCardHeight] = React.useState(0);
  const hoveringRef = React.useRef(false);
  const focusedRef = React.useRef<number | null>(null);
  const activeRef = React.useRef(0);

  const commitActive = React.useCallback((index: number) => {
    if (index !== activeRef.current) {
      activeRef.current = index;
      setActiveIndex(index);
    }
  }, []);

  const last = chapters.length - 1;

  React.useEffect(() => {
    onActiveChange?.(
      engaged ? chapters[activeIndex] : null,
      engaged ? activeIndex : -1,
    );
  }, [engaged, activeIndex, chapters, onActiveChange]);

  React.useEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [activeIndex]);

  React.useEffect(() => {
    if (!engaged) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = el.ownerDocument.defaultView?.innerWidth ?? 0;
    const need = CARD_WIDTH + GAP + 8;
    let useRight = side === "right";
    if (useRight && vw - rect.right < need && rect.left >= need) useRight = false;
    if (!useRight && rect.left < need && vw - rect.right >= need) useRight = true;
    setFlipped(useRight !== (side === "right"));
  }, [engaged, activeIndex, side]);

  const resolvedSide =
    side === "right" ? (flipped ? "left" : "right") : flipped ? "right" : "left";

  const totalHeight = chapters.length * rowHeight;
  const rovingIndex = engaged ? activeIndex : (currentIndex ?? 0);

  const cardTop = useTransform(pointer, (p: number) => {
    const half = cardHeight / 2;
    const center = clamp(
      (p + 0.5) * rowHeight,
      half,
      Math.max(half, totalHeight - half),
    );
    return center - half;
  });
  const cardOpacity = useTransform(strength, [0, 1], [0, 1]);
  const cardScale = useTransform(strength, [0, 1], [0.97, 1]);
  const cardX = useTransform(
    strength,
    [0, 1],
    [resolvedSide === "right" ? -6 : 6, 0],
  );

  const engageAt = (pointerRow: number, activeAt: number) => {
    rawPointer.set(pointerRow);
    rawStrength.set(1);
    commitActive(clamp(activeAt, 0, last));
    if (!engaged) setEngaged(true);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const el = listRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const row = (event.clientY - rect.top) / rowHeight - 0.5;
    hoveringRef.current = true;
    engageAt(clamp(row, -0.5, last + 0.5), Math.round(row));
  };

  const handlePointerLeave = () => {
    hoveringRef.current = false;
    if (focusedRef.current != null) {
      rawPointer.set(focusedRef.current);
    } else {
      rawStrength.set(0);
      setEngaged(false);
    }
  };

  const handleBlur = (event: React.FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      focusedRef.current = null;
      if (!hoveringRef.current) {
        rawStrength.set(0);
        setEngaged(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    let next = focusedRef.current ?? activeRef.current;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = Math.min(last, next + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = Math.max(0, next - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttonsRef.current[next]?.focus();
  };

  if (chapters.length === 0) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-orientation="vertical"
        aria-activedescendant={engaged ? optionId(activeIndex) : undefined}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="relative outline-none"
        style={{ height: totalHeight }}
      >
        {chapters.map((chapter, index) => {
          const isCurrent = index === currentIndex;
          const descText =
            typeof chapter.description === "string"
              ? `. ${chapter.description}`
              : "";
          return (
            <button
              ref={(el) => {
                buttonsRef.current[index] = el;
              }}
              key={chapter.id}
              id={optionId(index)}
              type="button"
              role="option"
              aria-selected={isCurrent}
              aria-label={`${chapter.title}${descText}`}
              tabIndex={index === rovingIndex ? 0 : -1}
              onFocus={() => {
                focusedRef.current = index;
                engageAt(index, index);
              }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                onSelect?.(chapter, index);
                focusedRef.current = null;
                hoveringRef.current = false;
                rawStrength.set(0);
                setEngaged(false);
                e.currentTarget.blur();
              }}
              style={{ height: rowHeight }}
              className={cn(
                "flex w-full items-center rounded-sm outline-none cursor-pointer",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                resolvedSide === "left" ? "justify-end" : "justify-start",
              )}
            >
              <Tick
                index={index}
                pointer={pointer}
                strength={strength}
                radius={radius}
                restLength={restLength}
                peakLength={peakLength}
                isCurrent={isCurrent}
              />
            </button>
          );
        })}
      </div>

      {chapters[activeIndex] ? (
        <motion.div
          ref={cardRef}
          aria-hidden
          style={{
            top: cardTop,
            opacity: cardOpacity,
            scale: cardScale,
            x: cardX,
            width: CARD_WIDTH,
            [resolvedSide === "right" ? "left" : "right"]: peakLength + GAP,
          }}
          className={cn(
            "pointer-events-none absolute z-30 rounded-xl border bg-popover/95 p-3 text-popover-foreground shadow-lg backdrop-blur-md",
          )}
        >
          {chapters[activeIndex].meta ? (
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {chapters[activeIndex].meta}
            </div>
          ) : null}
          <div className="text-sm font-semibold leading-snug">
            {chapters[activeIndex].title}
          </div>
          {chapters[activeIndex].description ? (
            <div className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {chapters[activeIndex].description}
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

export default ChapterScrubber;
