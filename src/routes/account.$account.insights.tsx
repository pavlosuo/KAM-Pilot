import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, MessageCircleQuestion, RotateCcw, Shuffle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { ObservationCard, KIND_META } from "@/components/review/ObservationCard";
import { SectionCard } from "@/components/review/SectionCard";
import { Segmented } from "@/components/review/Segmented";
import { Provenance } from "@/components/review/Provenance";
import { reviewObservations } from "@/lib/ui/review-picks";
import { shortSiteName } from "@/lib/ui/names";
import { steeringQuestions, type ObservationKind } from "@/lib/engine/observations";
import { fmtEur, fmtNum, fmtTonnes } from "@/lib/engine/format";

export const Route = createFileRoute("/account/$account/insights")({
  head: () => ({
    meta: [
      { title: "Insights & next-year plan - Lindström customer value review" },
      { name: "description", content: "Evidence-based observations, joint improvement plan, garment right-sizing and steering-committee questions." },
      { property: "og:title", content: "Insights & next-year plan - Lindström customer value review" },
      { property: "og:description", content: "Evidence-based observations, joint improvement plan and steering-committee questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const a = useAccount();
  const { observations, plan, dataset, customerSites, settings, update, slug } = a;
  const assistant = useAssistant();
  const [kind, setKind] = useState<"all" | ObservationKind>("all");

  const inReview = useMemo(() => new Set(reviewObservations(observations, settings.pickedObservationIds).map((o) => o.id)), [observations, settings.pickedObservationIds]);
  const list = observations.filter((o) => kind === "all" || o.kind === kind);
  const count = (k: ObservationKind) => observations.filter((o) => o.kind === k).length;
  const planned = observations.filter((o) => o.plan);
  const questions = steeringQuestions(observations, 6);
  const siteName = (id: string) => {
    const s = customerSites.find((x) => x.id === id);
    return s ? shortSiteName(s) : id;
  };
  const productName = (id: string) => dataset.products.find((p) => p.id === id)?.name ?? id;

  const toggle = (id: string) => {
    const current = settings.pickedObservationIds ?? [...inReview];
    update({ pickedObservationIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Filter insights"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All", count: observations.length },
              { value: "value", label: KIND_META.value.label, count: count("value") },
              { value: "risk", label: "Risks", count: count("risk") },
              { value: "opportunity", label: "Opportunities", count: count("opportunity") },
              ...(count("rule") ? [{ value: "rule" as const, label: "Country rules", count: count("rule") }] : []),
              { value: "data", label: "Data", count: count("data") },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
        <ClipboardList className="h-4 w-4 text-primary" />
        <span>
          <span className="font-semibold">{inReview.size}</span> insights go into the review deck
          {settings.pickedObservationIds ? " (your selection)" : " (top picks for this lens)"}.
        </span>
        {settings.pickedObservationIds && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => update({ pickedObservationIds: null })}>
            <RotateCcw className="h-3.5 w-3.5" /> Use top picks
          </Button>
        )}
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link to="/account/$account/review" params={{ account: slug }}>
            Open review export <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((o, i) => (
          <ObservationCard key={o.id} observation={o} index={i} picked={inReview.has(o.id)} onTogglePick={() => toggle(o.id)} />
        ))}
      </div>

      <SectionCard id="plan" icon={ClipboardList} title="Joint improvement plan" tone="orange" subtitle="Targets use the customer's own best-quartile sites, not external claims">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">KPI</th>
                <th className="px-3 py-2 text-right font-semibold">Now</th>
                <th className="px-3 py-2 text-right font-semibold">Target next year</th>
                <th className="px-3 py-2 font-semibold">Benchmark</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody>
              {planned.map((o) => (
                <tr key={o.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="py-3 pr-3 font-medium">{o.plan!.kpi}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{o.plan!.current}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-lind-green">{o.plan!.target}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{o.plan!.benchmark}</td>
                  <td className="px-3 py-3 text-xs">{o.action}</td>
                  <td className="px-3 py-3 text-xs">{o.owner}</td>
                </tr>
              ))}
              <tr className="align-top">
                <td className="py-3 pr-3 font-medium">Reporting evidence</td>
                <td className="px-3 py-3 text-right text-xs text-muted-foreground">Synthetic / allocated</td>
                <td className="px-3 py-3 text-right text-xs font-semibold text-lind-green">Approved factors</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">Data readiness checklist</td>
                <td className="px-3 py-3 text-xs">Connect meter data, approved emission factors and a full RFID scan export.</td>
                <td className="px-3 py-3 text-xs">Shared</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          id="rebalance"
          icon={Shuffle}
          title="Garment right-sizing plan"
          tone="violet"
          subtitle={`Based on the last ${plan.window.length} months · keeps every site at ${Math.round(a.assumptions.targetUtilization * 100)}% use or better`}
          action={<Provenance metric="rebalance" compact />}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label="Move between sites" value={fmtNum(plan.transferredPieces)} />
            <Mini label="Release to pool" value={fmtNum(plan.returnedPieces)} />
            <Mini label="New garments avoided" value={fmtNum(plan.avoidedNewGarments)} />
            <Mini label={a.avatar.showMoney ? "Garment value freed" : "Embodied CO₂e"} value={a.avatar.showMoney ? fmtEur(plan.capitalEurReleased) : fmtTonnes(plan.embodiedKgCo2eAvoided + plan.embodiedKgCo2eReleased)} />
          </div>
          {plan.transfers.length > 0 ? (
            <ul className="mt-4 divide-y divide-border/60">
              {plan.transfers.slice(0, 8).map((t, i) => (
                <li key={`${t.fromSiteId}-${t.toSiteId}-${t.productId}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <Truck className="h-4 w-4 shrink-0 text-lind-purple" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{fmtNum(t.pieces)} × {productName(t.productId)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {siteName(t.fromSiteId)} → {siteName(t.toSiteId)} · same laundry
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No site runs above the target utilization, so no transfers are needed; surplus can be released.</p>
          )}
          {plan.returns.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Largest releases:{" "}
              {[...plan.returns]
                .sort((x, y) => y.pieces - x.pieces)
                .slice(0, 3)
                .map((r) => `${siteName(r.siteId)} ${fmtNum(r.pieces)} × ${productName(r.productId).toLowerCase()}`)
                .join(" · ")}
            </p>
          )}
        </SectionCard>

        <SectionCard icon={MessageCircleQuestion} title="Steering-committee questions" tone="violet">
          <ol className="space-y-2.5">
            {questions.map((q, i) => (
              <li key={q} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lind-purple/10 text-xs font-bold text-lind-purple">{i + 1}</span>
                <button type="button" className="cursor-pointer text-left leading-snug hover:text-primary" onClick={() => assistant.open(`Help me prepare for this question from the customer: "${q}"`)}>
                  {q}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Click a question to prepare an answer with the assistant.</p>
        </SectionCard>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-background p-3")}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
