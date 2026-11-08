import { useCallback, useRef, useState } from "react";
import type { Dataset } from "@/lib/data/types";
import type { Avatar } from "@/lib/engine/avatars";
import { researchCountry, researchRequests } from "@/lib/avatar/build";
import { RESEARCH_TOPICS, countryCode, type RegulatoryBrief, type ResearchRequest, type ResearchTopic, type TopicResult } from "@/lib/regulation/types";

export interface TopicProgress {
  state: "idle" | "searching" | "writing" | "done" | "failed";
  queries: string[];
  sources: number;
  result: TopicResult | null;
}

const IDLE: TopicProgress = { state: "idle", queries: [], sources: 0, result: null };

type Progress = Record<ResearchTopic, TopicProgress>;

const idleAll = (): Progress => Object.fromEntries(RESEARCH_TOPICS.map((t) => [t, { ...IDLE }])) as Progress;

async function runTopic(req: ResearchRequest, signal: AbortSignal, onEvent: (p: Partial<TopicProgress> | ((p: TopicProgress) => Partial<TopicProgress>)) => void): Promise<TopicResult> {
  const fail = (error: string): TopicResult => ({ topic: req.topic, status: "failed", items: [], notes: "", queries: [], searchedSources: 0, error });
  let res: Response;
  try {
    res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return fail("Could not reach the research service. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return fail(body?.error ?? "The research service rejected the request.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: TopicResult | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      nl = buf.indexOf("\n");
      if (!line) continue;
      try {
        const ev = JSON.parse(line) as { type: string; query?: string; count?: number; result?: TopicResult };
        if (ev.type === "query" && ev.query) onEvent((p) => ({ queries: p.queries.includes(ev.query!) ? p.queries : [...p.queries, ev.query!] }));
        else if (ev.type === "sources" && typeof ev.count === "number") onEvent({ sources: ev.count });
        else if (ev.type === "writing") onEvent({ state: "writing" });
        else if (ev.type === "result" && ev.result) result = ev.result;
      } catch {
        // ignore malformed line
      }
    }
  }
  return result ?? fail("The research ended before it finished. Try again.");
}

/**
 * Runs the four research topics in parallel against the streaming research
 * endpoint and assembles the avatar's regulatory brief (plain function, so it
 * can also run in the background after the studio hands over to the Recap).
 */
export async function runAvatarResearch(
  avatar: Avatar,
  dataset: Dataset,
  opts: { signal: AbortSignal; only?: ResearchTopic[]; onTopic?: (topic: ResearchTopic, p: Partial<TopicProgress> | ((p: TopicProgress) => Partial<TopicProgress>)) => void },
): Promise<RegulatoryBrief> {
  const reqs = researchRequests(avatar, dataset).filter((r) => !opts.only || opts.only.includes(r.topic));
  const results = await Promise.all(
    reqs.map(async (r) => {
      const res = await runTopic(r, opts.signal, (p) => opts.onTopic?.(r.topic, p));
      opts.onTopic?.(r.topic, { state: res.status === "ok" ? "done" : "failed", result: res });
      return res;
    }),
  );
  const country = researchCountry(avatar, dataset);
  const previous = avatar.brief?.topics ?? [];
  const topics = RESEARCH_TOPICS.map((t) => results.find((r) => r.topic === t) ?? previous.find((p) => p.topic === t)).filter((t): t is TopicResult => !!t);
  return {
    version: 1,
    country,
    countryCode: countryCode(country),
    industry: dataset.customers.find((c) => c.id === avatar.customerId)?.industry ?? "",
    role: avatar.role,
    generatedAt: new Date().toISOString(),
    topics,
  };
}

/** Component wrapper around runAvatarResearch with per-topic progress. */
export function useResearch() {
  const [progress, setProgress] = useState<Progress>(idleAll);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((topic: ResearchTopic, p: Partial<TopicProgress> | ((p: TopicProgress) => Partial<TopicProgress>)) => {
    setProgress((all) => ({ ...all, [topic]: { ...all[topic], ...(typeof p === "function" ? p(all[topic]) : p) } }));
  }, []);

  const run = useCallback(
    async (avatar: Avatar, dataset: Dataset, only?: ResearchTopic[]): Promise<RegulatoryBrief | null> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const topicsToRun = RESEARCH_TOPICS.filter((t) => !only || only.includes(t));
      setRunning(true);
      setProgress((all) => {
        const next = { ...all };
        for (const t of topicsToRun) next[t] = { state: "searching", queries: [], sources: 0, result: null };
        return next;
      });
      try {
        return await runAvatarResearch(avatar, dataset, { signal: ctrl.signal, only, onTopic: patch });
      } catch (e) {
        if ((e as Error).name === "AbortError") return null;
        throw e;
      } finally {
        if (abortRef.current === ctrl) {
          abortRef.current = null;
          setRunning(false);
        }
      }
    },
    [patch],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setProgress(idleAll());
  }, []);

  const reset = useCallback(() => setProgress(idleAll()), []);

  return { progress, running, run, cancel, reset };
}
