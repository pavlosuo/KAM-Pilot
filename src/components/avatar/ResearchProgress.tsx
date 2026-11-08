import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Building2, CheckCircle2, Coins, Globe2, Leaf, Loader2, Recycle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Progress } from "@/design-system/ventura-6bef42/components/ui/progress";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { RESEARCH_TOPICS, TOPIC_META, type ResearchTopic } from "@/lib/regulation/types";
import type { TopicProgress } from "./useResearch";

const TOPIC_ICON: Record<ResearchTopic, typeof Leaf> = { climate: Leaf, incentives: Coins, circularity: Recycle, company: Building2 };
const TOPIC_TONE: Record<ResearchTopic, string> = {
  climate: "bg-lind-green/10 text-lind-green ring-lind-green/20",
  incentives: "bg-lind-orange/10 text-lind-orange ring-lind-orange/20",
  circularity: "bg-lind-purple/10 text-lind-purple ring-lind-purple/20",
  company: "bg-lind-blue/10 text-lind-blue ring-lind-blue/20",
};

/** Live view of the four web-research topics: queries as they run, then rules and sources found. */
export function ResearchProgress({ progress, country, running }: { progress: Record<ResearchTopic, TopicProgress>; country: string; running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const finished = RESEARCH_TOPICS.filter((t) => progress[t].state === "done" || progress[t].state === "failed").length;
  const active = RESEARCH_TOPICS.filter((t) => progress[t].state !== "idle").length || RESEARCH_TOPICS.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Globe2 className="h-4 w-4 text-primary" /> Researching {country} on the web
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {finished}/{active} topics · {running ? `${seconds}s` : "finished"}
        </p>
      </div>
      <Progress value={(finished / active) * 100} aria-label="Research progress" />
      {running && <p className="text-xs text-muted-foreground">This usually takes about a minute - the AI reads official sources and every link is checked against what the search returned.</p>}

      <ul className="space-y-2.5">
        {RESEARCH_TOPICS.map((t) => {
          const p = progress[t];
          const Icon = TOPIC_ICON[t];
          const res = p.result;
          return (
            <li key={t} className={cn("rounded-xl border bg-background p-3 transition-colors", p.state === "failed" ? "border-destructive/40" : "border-border/60")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1", TOPIC_TONE[t])}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{TOPIC_META[t].label}</p>
                    <span className="ml-auto shrink-0">
                      {p.state === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-lind-green" aria-label="Done" />
                      ) : p.state === "failed" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Failed" />
                      ) : p.state === "idle" ? null : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Working" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.state === "done" && res
                      ? `${res.items.length} finding${res.items.length === 1 ? "" : "s"} · ${res.searchedSources} sources read${res.carbonPrice ? ` · carbon price €${res.carbonPrice.eurPerTonne}/t` : ""}`
                      : p.state === "failed"
                        ? (res?.error ?? "Research failed")
                        : p.state === "writing"
                          ? "Writing findings for this person…"
                          : p.state === "searching"
                            ? p.sources
                              ? `Searching · ${p.sources} sources read`
                              : "Searching…"
                            : TOPIC_META[t].looksFor}
                  </p>
                  {p.queries.length > 0 && p.state !== "done" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <AnimatePresence initial={false}>
                        {p.queries.slice(-4).map((q) => (
                          <motion.span
                            key={q}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            <Search className="h-3 w-3 shrink-0" /> <span className="truncate">{q}</span>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                  {p.state === "done" && res && res.items.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {res.items.slice(0, 3).map((it) => (
                        <li key={it.id} className="truncate text-xs">
                          <span className="font-medium">{it.title}</span>
                          {it.effective && <span className="text-muted-foreground"> · {it.effective}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
