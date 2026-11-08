import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Building2, CalendarClock, Coins, ExternalLink, Globe2, Landmark, Leaf, Lightbulb, RefreshCw, Search, ShieldCheck, ShieldQuestion, Target, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { InterviewDialog } from "@/components/avatar/InterviewDialog";
import { researchedLabel } from "@/components/avatar/AvatarCard";
import { SectionCard } from "@/components/review/SectionCard";
import { Segmented } from "@/components/review/Segmented";
import { audienceLabel, avatarLocation } from "@/lib/engine/avatars";
import { fmtCompact, fmtNum, fmtTonnes } from "@/lib/engine/format";
import { PRIORITY_META } from "@/lib/engine/priorities";
import { carbonValue, metricReading, rankRules, ruleTimeline } from "@/lib/engine/regulatory";
import {
  briefCompanyFacts,
  briefSources,
  CATEGORY_LABEL,
  RESEARCH_TOPICS,
  STATUS_LABEL,
  TOPIC_META,
  type ResearchTopic,
  type RuleItem,
  type RuleStatus,
  type Source,
} from "@/lib/regulation/types";
import { useAccount } from "@/lib/state/account-context";
import { usePeople } from "@/components/people/PeopleProvider";
import { PRIORITY_BG_SOFT, PRIORITY_TEXT } from "@/lib/ui/palette";

export const Route = createFileRoute("/account/$account/rules")({
  head: () => ({
    meta: [
      { title: "Country rules - Lindström customer value review" },
      {
        name: "description",
        content: "Web-researched CO₂ pricing, reporting duties, tax benefits and textile rules for the stakeholder's country, linked to the customer's own figures.",
      },
      { property: "og:title", content: "Country rules - Lindström customer value review" },
      { property: "og:description", content: "Carbon pricing, reporting deadlines, tax benefits and textile rules linked to the account's figures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

const STATUS_TONE: Record<RuleStatus, string> = {
  in_force: "bg-lind-green/10 text-lind-green ring-lind-green/25 dark:text-lind-green",
  phasing_in: "bg-lind-blue/10 text-lind-blue ring-lind-blue/25 dark:text-lind-blue",
  upcoming: "bg-lind-orange/10 text-lind-orange ring-lind-orange/25 dark:text-lind-orange",
  proposed: "bg-lind-purple/10 text-lind-purple ring-lind-purple/25 dark:text-lind-purple",
  uncertain: "bg-muted text-muted-foreground ring-border",
};

const DOT_TONE: Record<RuleStatus, string> = {
  in_force: "bg-lind-green",
  phasing_in: "bg-lind-blue",
  upcoming: "bg-lind-orange",
  proposed: "bg-lind-purple",
  uncertain: "bg-muted-foreground",
};

function SourceLinks({ sources }: { sources: Source[] }) {
  if (!sources.length) return <p className="text-xs text-muted-foreground">No source link returned - treat as unconfirmed.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            title={s.verified ? "Link returned by the live web search" : "Link not confirmed by the search - check before use"}
          >
            {s.verified ? <ShieldCheck className="h-3 w-3 shrink-0 text-lind-green" /> : <ShieldQuestion className="h-3 w-3 shrink-0 text-lind-orange" />}
            <span className="truncate">{s.title || new URL(s.url).hostname}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function RuleCard({ rule, index, personName }: { rule: RuleItem; index: number; personName: string }) {
  const a = useAccount();
  const reading = metricReading(a.model, rule.metric, a.settings.scenario);
  return (
    <motion.article
      id={`rule-${rule.id}`}
      data-deep-link=""
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-background p-4"
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", DOT_TONE[rule.status])} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1", STATUS_TONE[rule.status])}>{STATUS_LABEL[rule.status]}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{CATEGORY_LABEL[rule.category]}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PRIORITY_BG_SOFT[rule.priority], PRIORITY_TEXT[rule.priority])}>{PRIORITY_META[rule.priority].short}</span>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {rule.jurisdiction}
          {rule.effective ? ` · ${rule.effective}` : ""}
        </span>
      </div>
      <h3 className="font-semibold leading-snug">{rule.title}</h3>
      {rule.summary && <p className="text-sm leading-relaxed text-muted-foreground">{rule.summary}</p>}
      {rule.relevance && (
        <p className="flex gap-2 rounded-xl bg-muted/50 p-2.5 text-sm leading-snug">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Why it matters for {personName}: </span>
            {rule.relevance}
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {reading && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-lind-blue/10 px-2.5 py-1 text-xs text-lind-blue dark:text-lind-blue">
            <Target className="h-3.5 w-3.5" /> {reading.label}: <span className="font-semibold tabular-nums">{reading.value}</span>
          </span>
        )}
        <span className="inline-flex items-center rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">{rule.confidence} confidence</span>
      </div>
      {rule.action && (
        <p className="flex gap-2 text-sm leading-snug">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-lind-orange" />
          <span>{rule.action}</span>
        </p>
      )}
      <SourceLinks sources={rule.sources} />
    </motion.article>
  );
}

function RulesPage() {
  const a = useAccount();
  const people = usePeople();
  const { avatar, brief, model, neutral, slug, customer, settings, weights, today } = a;
  const [topic, setTopic] = useState<"all" | ResearchTopic>("all");
  const [dialog, setDialog] = useState<"research" | "new" | null>(null);

  const ranked = useMemo(() => rankRules(brief, weights), [brief, weights]);
  const list = ranked.filter((r) => topic === "all" || r.topic === topic);
  const timeline = useMemo(() => ruleTimeline(brief, today), [brief, today]);
  const cv = carbonValue(model, brief);
  const facts = briefCompanyFacts(brief);
  const sources = briefSources(brief);
  const confirmed = sources.filter((s) => s.verified).length;
  const failed = brief?.topics.filter((t) => t.status === "failed") ?? [];

  if (!brief) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
        <Landmark className="h-10 w-10 text-lind-blue" />
        <div>
          <h1 className="text-xl font-bold">{neutral ? "Choose a person to research their country rules" : `No country research for ${audienceLabel(avatar)} yet`}</h1>
          
        </div>
        {neutral ? (
          <Button className="gap-1.5" onClick={people.openNewPerson}>
            <Globe2 className="h-4 w-4" /> Add a person
          </Button>
        ) : (
          <Button className="gap-1.5" onClick={() => setDialog("research")}>
            <Globe2 className="h-4 w-4" /> Research {avatarLocation(avatar)}
          </Button>
        )}
        <InterviewDialog
          open={dialog !== null}
          onOpenChange={(o) => !o && setDialog(null)}
          presetCustomerId={customer.id}
          researchAvatar={dialog === "research" ? avatar : null}
          onSaved={() => setDialog(null)}
        />
      </div>
    );
  }

  // Window: up to two years back (older rules pin to the start) and at least a year ahead.
  const span = timeline.length
    ? (() => {
        const back = new Date(today.getFullYear() - 2, today.getMonth(), 1).getTime();
        const ahead = new Date(today.getFullYear() + 1, today.getMonth(), 1).getTime();
        return { from: Math.max(back, Math.min(today.getTime(), timeline[0].date.getTime())), to: Math.max(ahead, timeline[timeline.length - 1].date.getTime()) };
      })()
    : null;
  const pos = (t: number) => (span && span.to > span.from ? Math.min(100, Math.max(0, ((t - span.from) / (span.to - span.from)) * 100)) : 50);
  const years: number[] = [];
  if (span) for (let y = new Date(span.from).getFullYear() + 1; new Date(y, 0, 1).getTime() <= span.to; y++) years.push(y);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Country rules for {audienceLabel(avatar)}</h1>
          
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => setDialog("research")}>
          <RefreshCw className="h-4 w-4" /> Refresh research
        </Button>
      </div>

      {failed.length > 0 && (
        <p role="status" className="rounded-xl border border-lind-orange/40 bg-lind-orange/5 px-4 py-2.5 text-sm">
          {failed.map((f) => TOPIC_META[f.topic].label).join(", ")} could not be researched ({failed[0].error}). Refresh to try again.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard id="carbon" icon={Coins} title="Carbon price × your avoided CO₂e" tone="emerald" subtitle="Illustrative - not an invoice or tax saving">
          {cv ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="line-clamp-2 text-xs font-semibold text-muted-foreground">{cv.price.instrument}</p>
                  <p className="text-3xl font-bold tabular-nums">
                    €{fmtNum(cv.price.eurPerTonne)}
                    <span className="text-base font-semibold text-muted-foreground"> / t CO₂</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cv.price.year} · {cv.price.appliesTo}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">CO₂e avoided ({settings.scenario} case)</p>
                  <p className="text-3xl font-bold tabular-nums">{fmtTonnes(model.impact.savings[settings.scenario].co2Kg)}</p>
                  <p className="text-xs text-muted-foreground">vs {model.baseline.name.toLowerCase()}</p>
                </div>
              </div>
              <div className="rounded-xl bg-lind-green/10 p-3">
                <p className="text-sm">
                  ≈ <span className="text-xl font-bold tabular-nums">€{fmtCompact(cv.eur[settings.scenario])}</span> of carbon cost a less efficient alternative would carry
                </p>
                <p className="text-xs text-muted-foreground">
                  Range €{fmtCompact(cv.eur.low)} – €{fmtCompact(cv.eur.high)} across low/high cases. Calculated here from the account data; only the price comes from the web.
                </p>
              </div>
              <SourceLinks sources={[cv.price.source]} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">The research found no general carbon price for {brief.country} to value the avoided emissions.</p>
          )}
        </SectionCard>

        <SectionCard icon={Building2} title={facts?.found ? `${customer.name}: public commitments` : "Sector expectations"} tone="sky" subtitle={facts?.found ? "Published by the company" : "Sector context - not this company"}>
          {facts ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">{facts.summary || "Nothing reliable was found."}</p>
              {facts.targets.length > 0 && (
                <ul className="space-y-1.5">
                  {facts.targets.map((t) => (
                    <li key={t} className="flex gap-2 text-sm">
                      <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-lind-green" /> {t}
                    </li>
                  ))}
                </ul>
              )}
              <SourceLinks sources={facts.sources} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No company or sector findings in this research run.</p>
          )}
        </SectionCard>
      </div>

      {timeline.length > 0 && span && (
        <SectionCard id="deadlines" icon={CalendarClock} title="Deadlines on the horizon" tone="amber" subtitle="Dated findings - today is marked">
          <div className="scrollbar-hide overflow-x-auto pb-2">
            <div className="relative min-w-2xl px-4 pb-2 pt-10">
              <div className="h-1 rounded-full bg-muted" />
              {years.map((y) => (
                <span key={y} className="absolute top-4 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground" style={{ left: `${pos(new Date(y, 0, 1).getTime())}%` }}>
                  {y}
                </span>
              ))}
              <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${pos(today.getTime())}%` }}>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-primary">Today</span>
                <span className="mx-auto mt-1 block h-6 w-0.5 bg-primary" />
              </div>
              <ol className="relative mt-3 space-y-2">
                {timeline.map((t) => {
                  const p = pos(t.date.getTime());
                  const right = p > 55;
                  return (
                  <li
                    key={t.item.id}
                    className={cn("relative flex items-center gap-2 text-xs", right && "flex-row-reverse text-right")}
                    style={right ? { paddingRight: `${100 - p}%` } : { paddingLeft: `${p}%` }}
                  >
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background", right ? "translate-x-1/2" : "-translate-x-1/2", DOT_TONE[t.item.status])} />
                    <span className="min-w-0 truncate">
                      <span className="font-semibold tabular-nums">{t.item.effective}</span> · {t.item.title}
                      <span className="text-muted-foreground"> · {t.monthsAway > 0 ? `in ${t.monthsAway} mo` : t.monthsAway === 0 ? "this month" : "applies now"}</span>
                    </span>
                  </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </SectionCard>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Findings</h2>
          <div className="max-w-full overflow-x-auto">
          <Segmented
            label="Filter by topic"
            value={topic}
            onChange={setTopic}
            options={[
              { value: "all", label: "All", count: ranked.length },
              ...RESEARCH_TOPICS.filter((t) => ranked.some((r) => r.topic === t)).map((t) => ({
                value: t,
                label: TOPIC_META[t].label.split(" & ")[0].split(",")[0],
                count: ranked.filter((r) => r.topic === t).length,
              })),
            ]}
          />
          </div>
        </div>
        {list.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {list.map((r, i) => (
              <RuleCard key={r.id} rule={r} index={i} personName={audienceLabel(avatar)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No findings for this topic.</p>
        )}
      </section>

      <details className="rounded-2xl border border-border/60 bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          <Search className="mr-1.5 inline h-4 w-4 text-muted-foreground" /> Research log - what the AI searched
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {brief.topics.map((t) => (
            <div key={t.topic} className="min-w-0 space-y-1.5">
              <p className="text-xs font-semibold">
                {TOPIC_META[t.topic].label} · {t.status === "ok" ? `${t.searchedSources} sources read` : "failed"}
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {t.queries.map((q) => (
                  <li key={q} className="truncate">
                    “{q}”
                  </li>
                ))}
              </ul>
              {t.notes && <p className="text-xs italic text-muted-foreground">{t.notes}</p>}
            </div>
          ))}
        </div>
      </details>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Findings are AI summaries of public web sources, researched for {avatar.name} ({avatar.role}) at {customer.name} in {brief.country}. They describe rules and
        incentives; they are not legal or tax advice. Check the linked source before quoting a finding to the customer. Figures next to a finding come from the
        account data in this workspace.{" "}
        <Link to="/account/$account/trust" params={{ account: slug }} className="text-primary hover:underline">
          Method & data quality
        </Link>
      </p>

      <InterviewDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        presetCustomerId={customer.id}
        researchAvatar={dialog === "research" ? avatar : null}
        onSaved={() => setDialog(null)}
      />
    </div>
  );
}
