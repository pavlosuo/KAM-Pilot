import { useEffect, useState } from "react";
import { AchievementUnlockedDialog } from "@/design-system/ventura-6bef42/components/startup-updates/AchievementUnlockedDialog";

const EVENT = "vf:achievement-unlocked";

/** Fire from anywhere (client-side) to celebrate newly earned achievements. */
export function celebrateAchievements(codes: string[]) {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(codes.filter(Boolean)));
  if (unique.length === 0) return;
  window.dispatchEvent(new CustomEvent<string[]>(EVENT, { detail: unique }));
}

export function AchievementCelebrationHost() {
  const [codes, setCodes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail ?? [];
      if (detail.length === 0) return;
      setCodes(detail);
      setOpen(true);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  if (codes.length === 0) return null;

  return (
    <AchievementUnlockedDialog
      codes={codes}
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setCodes([]);
      }}
    />
  );
}
