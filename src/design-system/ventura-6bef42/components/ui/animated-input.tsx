"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Target, AlertTriangle, BarChart2, Handshake, Users } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useIsMobile } from "@/design-system/ventura-6bef42/hooks/use-mobile";
import orbLogoAsset from "@/design-system/ventura-6bef42/assets/ventura-orb-logo.png.asset.json";

export interface OrbAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  end?: string;
}

export const DEFAULT_ORB_ACTIONS: OrbAction[] = [
  {
    id: "goal",
    label: "Set a goal with a startup",
    icon: <Target className="h-4 w-4 text-green-500" />,
    description: "Goals",
    end: "Action",
  },
  {
    id: "bottleneck",
    label: "Which startup is facing a bottleneck at the moment?",
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    description: "Portfolio",
    end: "Insight",
  },
  {
    id: "summary",
    label: "Summary of cohort progress",
    icon: <BarChart2 className="h-4 w-4 text-blue-500" />,
    description: "Cohort",
    end: "Report",
  },
  {
    id: "investor",
    label: "Match a startup with an investor",
    icon: <Handshake className="h-4 w-4 text-purple-500" />,
    description: "Network",
    end: "Match",
  },
  {
    id: "challenge",
    label: "Help with a community challenge",
    icon: <Users className="h-4 w-4 text-orange-500" />,
    description: "Challenges",
    end: "Assist",
  },
];

const ANIMATION_VARIANTS = {
  container: {
    hidden: { opacity: 0, height: 0 },
    show: {
      opacity: 1,
      height: "auto" as const,
      transition: { height: { duration: 0.35 }, staggerChildren: 0.06 },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: { height: { duration: 0.25 }, opacity: { duration: 0.15 } },
    },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
};

/** A single-line placeholder that scrolls horizontally when the text is too long. */
function RunningLinePlaceholder({ text, isTyping }: { text: string; isTyping: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [delta, setDelta] = useState(0);

  useLayoutEffect(() => {
    if (containerRef.current && textRef.current) {
      setDelta(Math.max(0, textRef.current.scrollWidth - containerRef.current.clientWidth));
    }
  }, [text]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 translate-y-0.5 overflow-hidden py-1 text-base leading-relaxed text-muted-foreground/70">
      <motion.span
        ref={textRef}
        className="inline-block whitespace-nowrap"
        initial={{ x: 0 }}
        animate={delta > 0 && !isTyping ? { x: [0, -delta] } : { x: 0 }}
        transition={delta > 0 && !isTyping ? { duration: Math.max(3.5, Math.min(7, delta / 55)), repeat: Infinity, repeatType: "reverse", ease: "linear" } : undefined}
      >
        {text}{isTyping ? "|" : ""}
      </motion.span>
    </div>
  );
}

export interface OrbInputProps {
  className?: string;
  onSubmit?: (value: string) => void;
  actions?: OrbAction[];
  onActionSelect?: (action: OrbAction) => void;
  onLogoClick?: () => void;
  onOpenChange?: (open: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** When true, the action list takes up layout space and pushes content below it down. */
  inlineDropdown?: boolean;
  /** Optional rotating placeholder phrases shown in the input when empty. */
  placeholders?: string[];
  /** Hide the ambient orb glow behind the input. */
  hideGlow?: boolean;
}



/** Ventura logo orb that replaces the liquid-metal blob. */
function LogoOrb({ active, onClick }: { active?: boolean; onClick?: () => void }) {
  const content = (
    <motion.img
      src={orbLogoAsset.url}
      alt=""
       className="program-ai-logo absolute inset-0 m-auto h-[82%] w-[82%] object-contain"
      animate={{
        scale: active ? [1, 1.06, 0.97, 1] : [1, 1.03, 0.98, 1],
        opacity: active ? [0.9, 1, 0.95, 1] : [0.85, 0.95, 0.85, 0.95],
      }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Open program assistant"
        className="relative h-9 w-9 shrink-0 cursor-pointer overflow-visible rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {content}
      </button>
    );
  }

  return (
    <motion.div aria-hidden="true" className="relative h-9 w-9 shrink-0 overflow-visible rounded-full">
      {content}
    </motion.div>
  );
}



export function OrbInput({
  className,
  onSubmit,
  actions = DEFAULT_ORB_ACTIONS,
  onActionSelect,
  onLogoClick,
  onOpenChange,
  onFocus,
  onBlur,
  inlineDropdown = false,
  placeholders: placeholdersProp,
  hideGlow = false,
}: OrbInputProps) {


  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const filteredActions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) =>
      `${a.label} ${a.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [value, actions]);


  // Keep the placeholders stable across renders. On mobile, use only the two
  // shortest phrases so the typing animation doesn't fight the narrow layout.
  const placeholders = useMemo(() => {
    if (placeholdersProp?.length) return placeholdersProp;
    return isMobile
      ? ["What's on your mind?", "How can I help you today?"]
      : [
          "What should we do?",
          "What should concern us?",
          "What should we build next?",
          "I'm meeting Superhero Capital tomorrow. Prepare me.",
          "How do we get from 100 → 1,000 users?",
        ];
  }, [placeholdersProp, isMobile]);


  // Config: tweak the animation to taste
  const CHAR_DELAY = 75; // ms between characters while typing
  const IDLE_DELAY_AFTER_FINISH = 6000; // ms to wait after a full sentence is shown

  // Refs to hold active timers so they can be cleaned up
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // clear any stale timers (helps with StrictMode double-invoke in dev)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const current = placeholders[placeholderIndex];
    if (!current) {
      setDisplayedText("");
      setIsTyping(false);
      return;
    }

    const chars = Array.from(current);

    // reset state for a new round
    setDisplayedText("");
    setIsTyping(true);

    let charIndex = 0;

    // type character-by-character using a derived slice to avoid any chance of appending undefined
    intervalRef.current = window.setInterval(() => {
      if (charIndex < chars.length) {
        const next = chars.slice(0, charIndex + 1).join("");
        setDisplayedText(next);
        charIndex += 1;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsTyping(false);

        // Wait longer for long running-line hints so the text has time to scroll
        // across before switching to the next phrase.
        const idleMs = Math.max(6000, current.length * 120);
        timeoutRef.current = window.setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, idleMs);
      }
    }, CHAR_DELAY);

    // Cleanup on unmount or when placeholderIndex changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [placeholderIndex, placeholders]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    onSubmit?.(value.trim());
    setValue("");
    setOpen(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const selectAction = (action: OrbAction) => {
    onActionSelect?.(action);
    setValue("");
    setOpen(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  return (
    <div className={cn("relative flex w-full flex-col items-center min-h-[360px]", className)}>
      {/* ambient orb glow */}
      {!hideGlow && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-1 h-12 rounded-full opacity-40 blur-2xl"
          animate={{
            scale: isFocused ? [1, 1.06, 1] : [1, 1.03, 1],
            opacity: isFocused ? [0.3, 0.45, 0.3] : [0.2, 0.32, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--primary) 45%, transparent), color-mix(in srgb, var(--primary) 22%, transparent), transparent 70%)",
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-3 rounded-full border border-border/60 bg-card px-6 py-3.5 shadow-xl ring-1 ring-border/30 transition-all focus-within:border-foreground/20 focus-within:shadow-2xl focus-within:ring-2 focus-within:ring-foreground/10"
        >

          <LogoOrb active={isFocused || isTyping} onClick={onLogoClick} />
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border/60" />
          <div className="relative min-w-0 flex-1">
            {!value && <RunningLinePlaceholder text={displayedText} isTyping={isTyping} />}
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setOpen(true);
                // Auto-resize to content while capping at a readable max height.
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              onFocus={() => {
                setIsFocused(true);
                setOpen(true);
                onFocus?.();
              }}
              onBlur={() => {
                setIsFocused(false);
                onBlur?.();
                window.setTimeout(() => setOpen(false), 150);
              }}

              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder=""
              aria-label="Ask a question"
              aria-expanded={open}
              role="combobox"
              aria-autocomplete="list"
              autoComplete="off"
              rows={1}
              className="min-w-0 w-full resize-none overflow-auto bg-transparent py-1 text-base leading-relaxed text-foreground outline-none [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            />
          </div>
          <motion.button
            type="submit"
            disabled={!value.trim()}
            whileHover={{ scale: value.trim() ? 1.08 : 1 }}
            whileTap={{ scale: value.trim() ? 0.95 : 1 }}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
              value.trim()
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground",
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4 -ml-0.5" />
          </motion.button>
        </form>

        <AnimatePresence>
          {open && filteredActions.length > 0 && (
            <motion.div
              className={cn(
                "z-20 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl",
                inlineDropdown
                  ? "relative mt-3 w-full"
                  : "absolute left-0 right-0 top-full",
              )}
              style={inlineDropdown ? undefined : { marginTop: "0.75rem" }}
              variants={ANIMATION_VARIANTS.container}
              initial="hidden"
              animate="show"
              exit="exit"
              role="listbox"
            >
              <ul className="p-1.5">
                {filteredActions.map((action) => (
                  <motion.li
                    key={action.id}
                    variants={ANIMATION_VARIANTS.item}
                    role="option"
                    aria-selected={value === action.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectAction(action)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0">{action.icon}</span>
                      <span className="whitespace-normal break-words text-sm font-medium leading-snug text-foreground">{action.label}</span>
                    </div>
                    {action.end && (
                      <span className="ml-2 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{action.end}</span>
                    )}
                  </motion.li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span className="break-words">Pick an action to get started</span>
                <span className="break-words">ESC to cancel</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default OrbInput;
