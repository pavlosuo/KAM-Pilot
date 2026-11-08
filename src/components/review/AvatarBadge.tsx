import { Briefcase, Coins, Crown, Factory, FlaskConical, Leaf, Shield, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import type { Avatar, AvatarIcon } from "@/lib/engine/avatars";

export const AVATAR_ICONS: Record<AvatarIcon, LucideIcon> = {
  briefcase: Briefcase,
  leaf: Leaf,
  factory: Factory,
  shield: Shield,
  coins: Coins,
  crown: Crown,
  users: Users,
  flask: FlaskConical,
};

const SIZES = {
  sm: { box: "h-7 w-7", text: "text-sm" },
  md: { box: "h-10 w-10", text: "text-lg" },
  lg: { box: "h-14 w-14", text: "text-2xl" },
  xl: { box: "h-20 w-20", text: "text-4xl" },
};

/** A person's portrait when one was found, otherwise a question mark. */
export function AvatarBadge({ avatar, size = "md", className }: { avatar: Partial<Pick<Avatar, "photo" | "name">>; size?: keyof typeof SIZES; className?: string }) {
  const [broken, setBroken] = useState(false);
  const s = SIZES[size];
  if (avatar.photo && !broken) {
    return (
      <img
        src={avatar.photo}
        alt={avatar.name?.trim() ? avatar.name : ""}
        onError={() => setBroken(true)}
        className={cn("inline-block shrink-0 rounded-full object-cover ring-2 ring-card", s.box, className)}
      />
    );
  }
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-lind-navy/10 font-bold text-lind-navy ring-2 ring-card", s.box, s.text, className)}>
      ?
    </span>
  );
}
