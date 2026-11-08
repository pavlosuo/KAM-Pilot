import { Building2, CalendarClock, Globe2, Landmark, Target } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { avatarLocation, peopleLabel, type Avatar } from "@/lib/engine/avatars";
import { rankPriorities } from "@/lib/engine/priorities";
import { briefItems, briefSources } from "@/lib/regulation/types";
import { AvatarBadge } from "@/components/review/AvatarBadge";
import { PriorityChips } from "@/components/review/PriorityChips";

export function researchedLabel(iso: string | undefined | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** Compact summary of an operator-created avatar: who, where, goals and research status. */
export function AvatarCard({ avatar, companyName, actions, className, selected }: { avatar: Avatar; companyName?: string; actions?: ReactNode; className?: string; selected?: boolean }) {
  const rules = briefItems(avatar.brief);
  const sources = briefSources(avatar.brief);
  const failed = avatar.brief?.topics.filter((t) => t.status === "failed").length ?? 0;
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors", selected ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60", className)}>
      <div className="flex items-start gap-3">
        <AvatarBadge avatar={avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{peopleLabel(avatar)}</p>
          <p className="truncate text-sm text-muted-foreground">{avatar.role}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {companyName && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {companyName}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Globe2 className="h-3 w-3" /> {avatarLocation(avatar)}
            </span>
          </div>
        </div>
      </div>
      <PriorityChips ranked={rankPriorities(avatar.weights)} weights={avatar.weights} max={3} />
      {avatar.profile?.goals.length ? (
        <p className="flex gap-1.5 text-xs leading-snug">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{avatar.profile.goals.slice(0, 2).join(" · ")}</span>
        </p>
      ) : null}
      {avatar.profile?.moments.length ? (
        <p className="flex gap-1.5 text-xs leading-snug text-muted-foreground">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{avatar.profile.moments[0]}</span>
        </p>
      ) : null}
      <p className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs", avatar.brief ? "bg-lind-blue/10 text-lind-blue dark:text-lind-blue" : "bg-muted text-muted-foreground")}>
        <Landmark className="h-3.5 w-3.5 shrink-0" />
        {avatar.brief
          ? `${rules.length} country rules · ${sources.length} sources · researched ${researchedLabel(avatar.brief.generatedAt)}${failed ? ` · ${failed} topic${failed === 1 ? "" : "s"} failed` : ""}`
          : "Country rules not researched yet"}
      </p>
      {actions && <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">{actions}</div>}
    </div>
  );
}
