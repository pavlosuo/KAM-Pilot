import { generateResponse, streamResponse } from "@lovable.dev/ai-gateway";
import { PRIORITY_KEYS, type PriorityKey } from "@/lib/engine/priorities";
import { RESEARCH_MODEL, gatewayFailure, isHttpUrl, normalizeUrl, parseJson, responseText, searchTrace } from "@/lib/ai/sdk.server";
import {
  CATEGORY_LABEL,
  EU_MEMBERS,
  RULE_METRICS,
  STATUS_LABEL,
  type CarbonPrice,
  type CompanyFacts,
  type ResearchRequest,
  type RuleCategory,
  type RuleItem,
  type RuleMetric,
  type RuleStatus,
  type Source,
  type TopicResult,
} from "./types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as RuleCategory[];
const STATUSES = Object.keys(STATUS_LABEL) as RuleStatus[];

const SOURCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "url"],
  properties: { title: { type: "string" }, url: { type: "string" } },
} as const;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "notes", "carbonPrice", "companyFacts"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "jurisdiction", "status", "effective", "summary", "relevance", "action", "metric", "priority", "confidence", "sources"],
        properties: {
          category: { type: "string", enum: CATEGORIES },
          title: { type: "string" },
          jurisdiction: { type: "string" },
          status: { type: "string", enum: STATUSES },
          effective: { type: ["string", "null"] },
          summary: { type: "string" },
          relevance: { type: "string" },
          action: { type: "string" },
          metric: { type: "string", enum: RULE_METRICS },
          priority: { type: "string", enum: PRIORITY_KEYS },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          sources: { type: "array", items: SOURCE_SCHEMA },
        },
      },
    },
    notes: { type: "string" },
    carbonPrice: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["eurPerTonne", "instrument", "appliesTo", "year", "source"],
          properties: {
            eurPerTonne: { type: "number" },
            instrument: { type: "string" },
            appliesTo: { type: "string" },
            year: { type: "string" },
            source: SOURCE_SCHEMA,
          },
        },
      ],
    },
    companyFacts: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["found", "summary", "targets", "sources"],
          properties: {
            found: { type: "boolean" },
            summary: { type: "string" },
            targets: { type: "array", items: { type: "string" } },
            sources: { type: "array", items: SOURCE_SCHEMA },
          },
        },
      ],
    },
  },
} as const;

interface RawResult {
  items: Array<Omit<RuleItem, "id" | "topic" | "sources"> & { sources: Array<{ title: string; url: string }> }>;
  notes: string;
  carbonPrice: (Omit<CarbonPrice, "source"> & { source: { title: string; url: string } }) | null;
  companyFacts: (Omit<CompanyFacts, "sources"> & { sources: Array<{ title: string; url: string }> }) | null;
}

function personBlock(r: ResearchRequest) {
  const p = r.person;
  const list = (label: string, v: string[]) => (v.length ? `- ${label}: ${v.join("; ")}` : "");
  return [
    `- Role: ${p.role}`,
    list("Decides / owns", p.decisions),
    list("Measured on / goals", p.goals),
    list("Reporting duties", p.reporting),
    list("Upcoming moments", p.moments),
  ]
    .filter(Boolean)
    .join("\n");
}

function topicBrief(r: ResearchRequest): string {
  const eu = EU_MEMBERS.has(r.countryCode);
  const c = r.country;
  switch (r.topic) {
    case "climate":
      return [
        `Research climate-reporting and CO₂ rules that apply in ${c}${eu ? " (EU member state - include EU-level rules as they apply there)" : ""} to a ${r.company.industry} company with ${r.company.segment} profile.`,
        `Cover, where they exist: (1) whether and from when CSRD / ESRS sustainability reporting applies to a company like this after the latest EU simplification ("Omnibus") decisions, and the national transposition status in ${c}; (2) the current national carbon tax or carbon price on fuels/heat (laundry processes, transport) - put the most recent general rate in carbonPrice converted to EUR per tonne CO₂, stating the year and the source; (3) EU ETS / ETS2 timing for buildings and road-transport fuels; (4) national climate law or targets that shape corporate disclosures; (5) rules on environmental claims that matter when the customer re-uses a supplier's CO₂ or water figures in its own communication.`,
        "Typical metric links: carbon pricing → co2Saving; reporting rules → footprintCo2 (purchased services in Scope 3); claims rules → co2Saving.",
      ].join("\n");
    case "incentives":
      return [
        `Research tax benefits, deductions, energy-tax refunds, grants and subsidies available in ${c}${eu ? " (and EU programmes accessible from there)" : ""} that a ${r.company.industry} company could use in connection with energy efficiency, low-emission transport, renewable heat or power, circular procurement or reducing textile waste.`,
        "For each: who is eligible, the rate or amount, deadlines or application windows. Also include green public procurement criteria if this industry sells to the public sector. Set carbonPrice to null.",
        "Typical metric links: energy measures → energySaving; transport/heat → co2Saving; procurement/stock measures → idleGarments.",
      ].join("\n");
    case "circularity":
      return [
        `Research textile, waste, water and hygiene rules in ${c}${eu ? " (EU rules as they apply there)" : ""} relevant to workwear used by a ${r.company.industry} company and washed by an industrial laundry.`,
        `Cover, where they exist: separate collection of textile waste and national implementation; extended producer responsibility (EPR) for textiles and its national timeline; rules on destroying unsold or returned textiles; wastewater, water-abstraction fees or water-scarcity rules relevant to laundries; sector hygiene or PPE rules that govern how workwear for ${r.company.industry} must be handled, washed and traced. Set carbonPrice to null.`,
        "Typical metric links: textile rules → textileWaste or wasteDiverted; repair/reuse rules → repairs or postponed; water rules → waterSaving; hygiene rules → onTime.",
      ].join("\n");
    case "company":
      return r.company.synthetic
        ? [
            `The account "${r.company.name}" is a SYNTHETIC test company - do NOT search for it and do not attribute anything to it.`,
            `Instead research sector expectations: what large ${r.company.industry} companies operating in ${c} publicly commit to (e.g. science-based targets, Scope 3 supplier engagement, water or circularity targets) and what they typically ask from service suppliers for reporting.`,
            'Set companyFacts.found to false and companyFacts.summary to a short sector-context summary that clearly says it is sector context, not this company. Use category "company_target" only for sector commitments, naming the example companies in the title. Set carbonPrice to null.',
          ].join("\n")
        : [
            `Research public information about the company "${r.company.name}" (${r.company.industry}, headquartered in ${r.company.hqCountry}): published climate or sustainability targets, SBTi status, sustainability reports, and requirements it sets for suppliers.`,
            "Only use results that clearly refer to this exact company. If nothing reliable is found, set companyFacts.found to false and return no items. Set carbonPrice to null.",
          ].join("\n");
  }
}

function instructions(r: ResearchRequest): string {
  return [
    "You are a regulatory research analyst preparing a customer value review for Lindström, a workwear rental and industrial laundry service.",
    `Today is ${r.today}. Use the web search tool. Prefer official sources (government, tax authority, environmental agency, EUR-Lex, European Commission) and reputable law-firm or industry summaries when official pages are unavailable.`,
    "Rules:",
    "- Only report facts supported by pages you found in this search. Every item needs at least one source URL copied exactly from your search results.",
    "- Give absolute dates (YYYY-MM-DD, YYYY-MM or YYYY). Mark proposals and unclear timelines honestly (status proposed / uncertain, confidence low).",
    "- `summary`: what the rule says, at most three short sentences.",
    "- Write `relevance` for the specific person below, in plain business language (one or two sentences). Write `action` as a concrete talking point or next step for the review meeting.",
    "- `jurisdiction` is the country name or \"EU\".",
    "- 3 to 6 items, most decision-relevant first. No legal or tax advice wording - describe, don't advise.",
    "- Return only JSON matching the schema.",
  ].join("\n");
}

function toSource(s: { title: string; url: string }, verified: Set<string>): Source | null {
  if (!s?.url || !isHttpUrl(s.url)) return null;
  const url = normalizeUrl(s.url);
  return { title: (s.title || new URL(url).hostname).slice(0, 160), url, verified: verified.has(url) };
}

function clean(s: unknown, max = 600): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

function payload(r: ResearchRequest) {
  return {
    model: RESEARCH_MODEL,
    instructions: instructions(r),
    input: [
      {
        role: "user" as const,
        content: [
          `Company: ${r.company.name} - ${r.company.industry}, ${r.company.segment}, HQ ${r.company.hqCountry}; ${r.company.sitesInScope} delivery site(s) in scope (${r.company.siteTypes.join(", ") || "various site types"}).`,
          `Country in scope: ${r.country}.`,
          "Person the review is for:",
          personBlock(r),
          "",
          topicBrief(r),
          "",
          "Return JSON.",
        ].join("\n"),
      },
    ],
    tools: [
      {
        type: "web_search" as const,
        ...(r.countryCode ? { user_location: { type: "approximate" as const, country: r.countryCode } } : {}),
      },
    ],
    include: ["web_search_call.action.sources" as const],
    reasoning: { effort: "low" as const },
    text: { format: { type: "json_schema" as const, name: "research_result", schema: RESULT_SCHEMA as unknown as Record<string, unknown>, strict: true } },
  };
}

/** Validates the model's JSON and checks every source against the URLs the live search returned. */
export function finalizeResearch(r: ResearchRequest, resp: unknown): TopicResult {
  const base: TopicResult = { topic: r.topic, status: "failed", items: [], notes: "", queries: [], searchedSources: 0 };
  const trace = searchTrace(resp);
  const raw = parseJson<RawResult>(responseText(resp));
  if (!raw || !Array.isArray(raw.items)) {
    return { ...base, queries: trace.queries, error: "The research answer could not be read." };
  }

  const items: RuleItem[] = raw.items
    .filter((i) => clean(i.title))
    .slice(0, 6)
    .map((i, idx) => {
      const sources = (i.sources ?? []).map((s) => toSource(s, trace.urls)).filter((s): s is Source => !!s).slice(0, 4);
      const verified = sources.some((s) => s.verified);
      const confidence = !sources.length ? "low" : !verified && i.confidence === "high" ? "medium" : i.confidence;
      return {
        id: `${r.topic}-${idx + 1}`,
        topic: r.topic,
        category: CATEGORIES.includes(i.category) ? i.category : "reporting",
        title: clean(i.title, 160),
        jurisdiction: clean(i.jurisdiction, 60) || r.country,
        status: STATUSES.includes(i.status) ? i.status : "uncertain",
        effective: i.effective && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(i.effective.trim()) ? i.effective.trim() : null,
        summary: clean(i.summary, 900),
        relevance: clean(i.relevance, 500),
        action: clean(i.action, 500),
        metric: (RULE_METRICS as string[]).includes(i.metric) ? (i.metric as RuleMetric) : "none",
        priority: (PRIORITY_KEYS as string[]).includes(i.priority) ? (i.priority as PriorityKey) : "evidence",
        sources,
        confidence: confidence as RuleItem["confidence"],
      };
    });

  let carbonPrice: CarbonPrice | null = null;
  if (r.topic === "climate" && raw.carbonPrice && Number.isFinite(raw.carbonPrice.eurPerTonne) && raw.carbonPrice.eurPerTonne > 0 && raw.carbonPrice.eurPerTonne < 1000) {
    const src = toSource(raw.carbonPrice.source, trace.urls);
    if (src) {
      carbonPrice = {
        eurPerTonne: Math.round(raw.carbonPrice.eurPerTonne * 100) / 100,
        instrument: clean(raw.carbonPrice.instrument, 160),
        appliesTo: clean(raw.carbonPrice.appliesTo, 240),
        year: clean(raw.carbonPrice.year, 12),
        source: src,
      };
    }
  }

  let companyFacts: CompanyFacts | null = null;
  if (r.topic === "company" && raw.companyFacts) {
    companyFacts = {
      found: !r.company.synthetic && !!raw.companyFacts.found,
      summary: clean(raw.companyFacts.summary, 800),
      targets: (raw.companyFacts.targets ?? []).map((t) => clean(t, 220)).filter(Boolean).slice(0, 6),
      sources: (raw.companyFacts.sources ?? []).map((s) => toSource(s, trace.urls)).filter((s): s is Source => !!s).slice(0, 5),
    };
  }

  return {
    topic: r.topic,
    status: "ok",
    items,
    notes: clean(raw.notes, 700),
    queries: trace.queries.slice(0, 12),
    searchedSources: trace.urls.size,
    carbonPrice,
    companyFacts,
  };
}

/** Runs one web-grounded research topic (single JSON response). */
export async function runResearchTopic(r: ResearchRequest, signal?: AbortSignal): Promise<TopicResult> {
  try {
    const resp = await generateResponse(payload(r), { signal });
    return finalizeResearch(r, resp);
  } catch (err) {
    console.error(`research ${r.topic} failed`, err);
    return { topic: r.topic, status: "failed", items: [], notes: "", queries: [], searchedSources: 0, error: gatewayFailure(err).message };
  }
}

export type ResearchEvent =
  | { type: "query"; query: string }
  | { type: "sources"; count: number }
  | { type: "writing" }
  | { type: "result"; result: TopicResult };

interface StreamEventLike {
  type?: string;
  item?: { type?: string; action?: { query?: string; queries?: string[]; sources?: unknown[] } };
  response?: unknown;
}

/** Streams progress (search queries as they run) and finishes with the validated result. */
export async function streamResearchTopic(r: ResearchRequest, emit: (e: ResearchEvent) => void, signal?: AbortSignal): Promise<void> {
  let sources = 0;
  let writing = false;
  try {
    const stream = await streamResponse(payload(r), { signal });
    for await (const raw of stream) {
      const ev = raw as StreamEventLike;
      if (ev.type === "response.output_item.done" && ev.item?.type === "web_search_call") {
        const qs = ev.item.action?.queries ?? (ev.item.action?.query ? [ev.item.action.query] : []);
        for (const q of qs) if (q) emit({ type: "query", query: q.slice(0, 200) });
        sources += ev.item.action?.sources?.length ?? 0;
        if (sources) emit({ type: "sources", count: sources });
      } else if (ev.type === "response.output_text.delta" && !writing) {
        writing = true;
        emit({ type: "writing" });
      } else if (ev.type === "response.completed" && ev.response) {
        emit({ type: "result", result: finalizeResearch(r, ev.response) });
        return;
      } else if (ev.type === "response.failed" || ev.type === "error") {
        throw new Error("research stream failed");
      }
    }
    emit({ type: "result", result: { topic: r.topic, status: "failed", items: [], notes: "", queries: [], searchedSources: 0, error: "The research ended before it finished. Try again." } });
  } catch (err) {
    console.error(`research ${r.topic} stream failed`, err);
    emit({ type: "result", result: { topic: r.topic, status: "failed", items: [], notes: "", queries: [], searchedSources: 0, error: gatewayFailure(err).message } });
  }
}
