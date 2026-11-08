import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Dialog, DialogContent } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { BADGE_DEFS } from "@/design-system/ventura-6bef42/components/startup-updates/goals/badges";

function fireConfetti() {
  const defaults = { spread: 70, ticks: 120, gravity: 0.9, scalar: 1, zIndex: 9999 };
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.5 } });
  window.setTimeout(
    () => confetti({ ...defaults, particleCount: 60, angle: 60, origin: { x: 0.1, y: 0.7 } }),
    200,
  );
  window.setTimeout(
    () => confetti({ ...defaults, particleCount: 60, angle: 120, origin: { x: 0.9, y: 0.7 } }),
    350,
  );
}

export function AchievementUnlockedDialog({
  codes,
  open,
  onOpenChange,
}: {
  codes: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setIndex(0);
      fireConfetti();
    }
  }, [open]);

  if (codes.length === 0) return null;

  const code = codes[Math.min(index, codes.length - 1)];
  const def = BADGE_DEFS[code];
  const label = def?.label ?? code.replaceAll("_", " ");
  const emoji = def?.emoji ?? "🏅";
  const hasNext = index < codes.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
        <div className="relative flex flex-col items-center gap-4 py-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Congratulations! You've got a new achievement!
          </h2>

          <AnimatePresence mode="wait">
            <motion.div
              key={code}
              initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/25">
                <motion.span
                  className="text-5xl"
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  {emoji}
                </motion.span>
              </div>
              <div className="text-lg font-bold uppercase tracking-wide">{label}</div>
              {def?.description && (
                <p className="text-sm text-muted-foreground max-w-xs">{def.description}</p>
              )}
            </motion.div>
          </AnimatePresence>

          {codes.length > 1 && (
            <div className="text-xs text-muted-foreground">
              {index + 1} of {codes.length}
            </div>
          )}

          <Button
            className="mt-2 w-full"
            onClick={() => {
              if (hasNext) {
                setIndex((i) => i + 1);
                fireConfetti();
              } else {
                onOpenChange(false);
              }
            }}
          >
            {hasNext ? "Next achievement" : "Awesome!"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
