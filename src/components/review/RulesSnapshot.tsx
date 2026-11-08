import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Coins, Globe2, Landmark } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { InterviewDialog } from "@/components/avatar/InterviewDialog";
import { audienceLabel, avatarLocation } from "@/lib/engine/avatars";
import { fmtCompact, fmtNum } from "@/lib/engine/format";
import { carbonValue, metricReading, rankRules, ruleTimeline } from "@/lib/engine/regulatory";
import { STATUS_LABEL, type RuleStatus } from "@/lib/regulation/types";
import { useAccount } from "@/lib/state/account-context";
import { SectionCard } from "./SectionCard";

const DOT: Record<RuleStatus, string> = {
  in_force: "bg-lind-green",
  phasing_in: "bg-lind-blue",
  upcoming: "bg-lind-orange",
  proposed: "bg-lind-purple",
  uncertain: "bg-muted-foreground",
};

/** Overview card: carbon value, next deadline and top three country rules for the selected avatar. */
export function RulesSnapshot() {
  const a = useAccount();
  const { brief, avatar, model, weights, settings, slug, today, neutral, customer } = a;
  const [open, setOpen] = useState(false);
  const rules = useMemo(() => rankRules(brief, weights).slice(0, 3), [brief, weights]);
  const next = useMemo(() => ruleTimeline(brief, today).find((t) => t.monthsAway >= 0), [brief, today]);
  const cv = carbonValue(model, brief);

  if (neutral) return null;

  if (!brief) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-5 py-4">
        <Landmark className="h-5 w-5 text-lind-blue" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">No country research for {audienceLabel(avatar)} yet.</span>{" "}
          <span className="text-muted-foreground">Add CO₂ pricing, reporting deadlines and tax benefits for {avatarLocation(avatar)}.</span>
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <Globe2 className="h-4 w-4" /> Research now
        </Button>
        <InterviewDialog open={open} onOpenChange={setOpen} presetCustomerId={customer.id} researchAvatar={avatar} />
      </div>
    );
  }

  return (
    <SectionCard
      icon={Landmark}
      title={`What ${brief.country}'s rules mean for ${audienceLabel(avatar)}`}
      tone="blue"
      count={rankRules(brief, weights).length}
      action={
        <Link to="/account/$account/rules" params={{ account: slug }} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          All country rules <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {cv ? (
            <div className="rounded-xl bg-lind-green/10 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-lind-green dark:text-lind-green">
                <Coins className="h-3.5 w-3.5" /> Carbon value avoided
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">€{fmtCompact(cv.eur[settings.scenario])}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground" title={cv.price.instrument}>
                at €{fmtNum(cv.price.eurPerTonne)}/t · {cv.price.instrument}
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">No general carbon price found for {brief.country}.</p>
          )}
          {next && (
            <div className="rounded-xl bg-lind-orange/10 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-lind-orange dark:text-lind-orange">
                <CalendarClock className="h-3.5 w-3.5" /> Next deadline
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{next.item.title}</p>
              <p className="text-xs text-muted-foreground">
                {next.item.effective} · {next.monthsAway === 0 ? "this month" : `in ${next.monthsAway} months`}
              </p>
            </div>
          )}
        </div>
        <ul className="divide-y divide-border/60">
          {rules.map((r) => {
            const reading = metricReading(model, r.metric, settings.scenario);
            return (
              <li key={r.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[r.status])} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.relevance || r.summary}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {STATUS_LABEL[r.status]}
                    {r.effective ? ` · ${r.effective}` : ""}
                    {reading ? ` · ${reading.label}: ${reading.value}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
  );
}
