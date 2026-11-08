import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Compass, Gauge, Loader2, Plus, Sparkles, UserRound, X } from "lucide-react";
import { ServiceRings } from "@/components/review/ServiceRings";
import { PriorityPrompt } from "@/components/review/PriorityPrompt";
import { Button } from "@/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { usePeople } from "@/components/people/PeopleProvider";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { KpiTile } from "@/components/review/KpiTile";
import { SectionCard } from "@/components/review/SectionCard";
import { StatusPill } from "@/components/review/StatusPill";
import { siteAttentionTag } from "@/lib/ui/contextual-tags";
import { usePersonalize } from "@/components/review/usePersonalize";
import { orderedKpis } from "@/lib/ui/kpis";
import { useTokenColors } from "@/lib/ui/use-token-colors";
import { shortSiteName } from "@/lib/ui/names";
import { SIGNAL_META, type SiteSummary } from "@/lib/engine/metrics";
import { fmtNum, fmtPct } from "@/lib/engine/format";
import { PRIORITY_META } from "@/lib/engine/priorities";

export const Route = createFileRoute("/account/$account/")({
  head: () => ({
    meta: [
      { title: "Account overview - Lindström customer value review" },
      { name: "description", content: "Personalised first screen: value delivered, service health, sites needing attention and next-year opportunities." },
      { property: "og:title", content: "Account overview - Lindström customer value review" },
      { property: "og:description", content: "Value delivered, service health, sites needing attention and next-year opportunities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function worstSignal(s: SiteSummary) {
  return [...s.signals].sort((a, b) => a.percentile - b.percentile)[0];
}

function signalText(s: SiteSummary) {
  const w = worstSignal(s);
  const meta = SIGNAL_META[w.key];
  const v = meta.unit === "pct" ? fmtPct(w.value, 1) : fmtNum(w.value, 2);
  return `${meta.label}: ${v}`;
}

function OverviewPage() {
  const a = useAccount();
  const { model, avatar, observations, slug, settings, neutral } = a;
  const people = usePeople();
  const assistant = useAssistant();
  const colors = useTokenColors();
  const { apply, clear, pending } = usePersonalize();

  const kpis = orderedKpis(a).slice(0, 8);
  const attention = [...model.sites].filter((s) => s.status !== "on-track").sort((x, y) => x.health - y.health);
  const opportunities = observations.filter((o) => o.kind === "opportunity" || o.kind === "risk").slice(0, 4);

  const util = model.activity.utilization;
  const wash = model.activity.washesPerGarmentMonth;
  const rings = [
    {
      label: "Garments in active use",
      value: util * 100,
      color: colors.cost,
      size: 156,
      current: Math.round(util * 100),
      target: Math.round(a.assumptions.targetUtilization * 100),
      unit: "%",
      info: "Share of assigned garments that were actually worn or washed during the period, counted from RFID read events in the uploaded data. Low use means garments (and money) sit idle in lockers. The target is an editable assumption (P02).",
    },
    {
      label: "On-time service cycles",
      value: model.cycles.onTimeShare * 100,
      color: colors.service,
      size: 116,
      current: Number((model.cycles.onTimeShare * 100).toFixed(1)),
      target: 100,
      unit: "%",
      info: "Share of tracked service cycles (pickup, wash, return) completed within the promised turnaround time. Calculated from the sample of RFID-tracked garments in the uploaded data; the target is 100%.",
    },
    {
      label: "Wash rhythm",
      value: (wash / a.assumptions.washTargetPerMonth) * 100,
      color: colors.hygiene,
      size: 76,
      current: Number(wash.toFixed(1)),
      target: a.assumptions.washTargetPerMonth,
      unit: "/ month",
      info: "Average number of times each garment in circulation was washed per month during the period: total washes divided by garments and months. The target is an editable assumption (P03).",
    },
  ].filter((ring) => ring.label !== "On-time service cycles" || model.cycles.cycles > 0);

  const suggestions = [
    ...avatar.concerns.slice(0, 2).map((c, i) => ({ id: `concern-${i}`, label: c })),
    ...a.dataset.suggestedPrompts.slice(0, 3).map((p, i) => ({ id: `pack-${i}`, label: p.prompt })),
  ];

  return (
    <div className="space-y-6">
      {neutral && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-5 py-4">
          <UserRound className="h-5 w-5 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">This is the neutral view.</span>{" "}
            <span className="text-muted-foreground">Add a person to tailor the dashboard to them, their country's rules and what they decide.</span>
          </p>
          <Button size="sm" className="gap-1.5" onClick={people.openNewPerson}>
            <Plus className="h-4 w-4" /> Add a person
          </Button>
        </div>
      )}

      {/* KPI grid, ordered by the stakeholder lens */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Key figures</h2>

          </div>
          <Link to="/account/$account/impact" params={{ account: slug }} className="text-xs font-medium text-primary hover:underline">
            Impact details
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k, i) => {
            const v = k.compute(a);
            return (
              <KpiTile
                key={k.id}
                index={i}
                label={k.label}
                value={v.value}
                unit={v.unit}
                sub={v.sub}
                range={v.range}
                metric={k.metric}
                icon={k.icon}
                iconClass={k.iconClass}
                highlight={i < 2}
              />
            );
          })}
        </div>
      </section>

      {/* Rings + attention, the Ventura program-overview rhythm */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard id="service-health" icon={Gauge} title="Service health" tone="blue" subtitle="Garment use, timeliness and wash rhythm in the period">
          <ServiceRings rings={rings} className="bg-transparent p-0 sm:p-2" />
          {!model.cycles.cycles && <p className="text-xs text-muted-foreground">On-time service: not available - no service cycles in the uploaded scope.</p>}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Targets are editable assumptions (P02, P03). Timeliness comes from a sample of RFID-tracked garments.
          </p>
        </SectionCard>

        <div className="flex flex-col gap-6">
          <SectionCard
            icon={AlertTriangle}
            title="Sites needing attention"
            tone="destructive"
            count={attention.length}
            action={
              <Link to="/account/$account/sites" params={{ account: slug }} className="text-xs font-medium text-primary hover:underline">
                All sites
              </Link>
            }
          >
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every site is on track for the current emphasis.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {attention.slice(0, 4).map((s) => (
                  <li key={s.site.id}>
                    <Link
                      to="/account/$account/sites/$siteId"
                      params={{ account: slug, siteId: s.site.id }}
                      className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{shortSiteName(s.site)}</p>
                        <p className="truncate text-xs text-muted-foreground">{signalText(s)}</p>
                      </div>
                      <StatusPill status={s.status} label={siteAttentionTag(s)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={Compass}
            title="Next-year opportunities"
            tone="amber"
            count={opportunities.length}
            action={
              <Link to="/account/$account/insights" params={{ account: slug }} className="text-xs font-medium text-primary hover:underline">
                All insights
              </Link>
            }
          >
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No improvement signals for this period.</p>
            ) : (
              <ul className="space-y-3">
                {opportunities.map((o) => (
                  <li key={o.id} className="flex gap-3">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        o.kind === "risk" ? "bg-destructive" : "bg-lind-orange",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{o.title}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Personalise by prompt */}
      <section aria-label="Tell the dashboard what matters" data-tour="priority-prompt" className="space-y-3">
        <PriorityPrompt onSubmit={(v) => void apply(v)} suggestions={suggestions} onAsk={(q) => assistant.open(q)} disabled={pending} />
        {settings.prompt && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Sparkles className="h-4 w-4 text-lind-purple" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">“{settings.prompt.text}”</p>
              <p className="text-xs text-muted-foreground">
                {pending
                  ? "Keyword reading applied - the AI reading is on its way…"
                  : settings.prompt.source === "ai"
                    ? (settings.prompt.rationale ?? "AI reading applied")
                    : "Keyword reading applied"}
                {" · Now leading with "}
                {a.ranked
                  .slice(0, 2)
                  .map((k) => PRIORITY_META[k].label.toLowerCase())
                  .join(" and ")}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} className="gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </motion.div>
        )}
      </section>
    </div>
  );
}
