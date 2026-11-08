import { pdlFetch } from "@/design-system/ventura-6bef42/lib/pdl-ai.server";
/** Server-only helpers that gather public material about an investor. */

export type ResearchSource = { url: string; kind: "linkedin" | "website" | "web"; title?: string };

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSite(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function fetchText(url: string, budget = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "VenturaBot/1.0 (+https://venturafund.eu)", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/i.test(ct)) return null;
    const html = await res.text();
    const text = stripHtml(html);
    return text ? text.slice(0, budget) : null;
  } catch {
    return null;
  }
}

/** Read the firm's own website: home plus a few likely-relevant pages. */
export async function readFirmWebsite(
  website: string,
): Promise<{ pages: Array<{ url: string; text: string }>; sources: ResearchSource[] }> {
  const origin = normalizeSite(website);
  if (!origin) return { pages: [], sources: [] };
  const candidates = [
    origin,
    `${origin}/about`,
    `${origin}/team`,
    `${origin}/portfolio`,
    `${origin}/investments`,
    `${origin}/thesis`,
  ];
  const results = await Promise.all(
    candidates.map(async (url) => {
      const text = await fetchText(url);
      return text ? { url, text } : null;
    }),
  );
  const pages = results.filter((p): p is { url: string; text: string } => Boolean(p));
  return {
    pages,
    sources: pages.map((p) => ({ url: p.url, kind: "website" as const })),
  };
}

/**
 * Open-web pass. Uses a search provider when one is configured for the project
 * (SEARCH_API_KEY / Exa-compatible endpoint); otherwise returns nothing and the
 * profile is written from LinkedIn plus the firm site only.
 */
export async function searchWeb(
  queries: string[],
): Promise<{ results: Array<{ title: string; url: string; text: string }>; sources: ResearchSource[] }> {
  const key = process.env["SEARCH_API_KEY"];
  if (!key) return { results: [], sources: [] };
  const all: Array<{ title: string; url: string; text: string }> = [];
  for (const query of queries.slice(0, 3)) {
    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ query, numResults: 4, contents: { text: { maxCharacters: 1500 } } }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; text?: string }>;
      };
      for (const r of json.results ?? []) {
        if (!r.url) continue;
        all.push({ title: r.title ?? r.url, url: r.url, text: (r.text ?? "").slice(0, 1500) });
      }
    } catch {
      // ignore a failing query; the rest of the research still runs
    }
  }
  return {
    results: all,
    sources: all.map((r) => ({ url: r.url, kind: "web" as const, title: r.title })),
  };
}

const RESEARCH_TOOL = {
  type: "function",
  function: {
    name: "write_investor_profile",
    description:
      "Write the structured, match-oriented profile blocks for an investor from the supplied material.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        positioning: {
          type: "string",
          description:
            "One sentence, max 160 chars, naming stage, sectors, geography and cheque size where known.",
        },
        help_with: {
          type: "array",
          description: "4-6 concrete things this investor can help a founder with.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", description: "Max 22 words, specific, no fluff." },
              source_url: { type: "string", description: "Source URL, or empty string." },
            },
            required: ["text", "source_url"],
          },
        },
        specialisations: {
          type: "array",
          description: "3-5 domains this person genuinely knows, evidenced by their history.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", description: "Max 22 words." },
              source_url: { type: "string" },
            },
            required: ["text", "source_url"],
          },
        },
        track_record: {
          type: "array",
          description: "Up to 6 past roles, funds or notable investments actually found in the material.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", description: "e.g. 'Partner at X Ventures, 2019-2024'." },
              source_url: { type: "string" },
              company: {
                type: "string",
                description: "The company, fund or organisation this entry is about, exactly as named. Empty string if none.",
              },
              company_domain: {
                type: "string",
                description:
                  "The organisation's primary website domain, e.g. 'pikapay.com'. No protocol, no path. Empty string if unknown.",
              },
            },
            required: ["text", "source_url", "company", "company_domain"],
          },
        },
        best_fit_for: {
          type: "array",
          description: "3-4 bullets describing the founder this investor is the strongest match for.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", description: "Max 22 words." },
              source_url: { type: "string" },
            },
            required: ["text", "source_url"],
          },
        },
      },
      required: ["positioning", "help_with", "specialisations", "track_record", "best_fit_for"],
    },
  },
};

export type ResearchBullet = {
  text: string;
  source_url: string | null;
  company?: string | null;
  company_domain?: string | null;
};
export type ResearchOutput = {
  positioning: string;
  help_with: ResearchBullet[];
  specialisations: ResearchBullet[];
  track_record: ResearchBullet[];
  best_fit_for: ResearchBullet[];
};

const SYSTEM = `You build investor profiles for a startup platform where founders look for the right investor.
You are given: the investor's own onboarding answers, structured LinkedIn data, text from their firm's website, and (sometimes) public web results.
Rules:
- Be factual. Never invent employers, funds, portfolio companies, numbers or dates. If the material does not support a claim, leave the bullet out.
- Prefer specifics over adjectives. "Scaled a B2B SaaS sales team from 0 to 40 in the Nordics" beats "experienced operator".
- Every bullet is one short line. No markdown, no bullet characters, no trailing full stops longer than one sentence.
- source_url must be one of the supplied URLs that supports the bullet, or an empty string when it comes from the investor's own answers.
- Write in the third person, plain English.`;

const MENTOR_SYSTEM = `You build mentor profiles for a startup platform where founders look for the right mentor or coach.
You are given: the mentor's own onboarding answers, structured LinkedIn data, text from their company website, and (sometimes) public web results.
Rules:
- Be factual. Never invent employers, companies, numbers or dates. If the material does not support a claim, leave the bullet out.
- Prefer specifics over adjectives. "Scaled a B2B SaaS sales team from 0 to 40 in the Nordics" beats "experienced operator".
- Every bullet is one short line. No markdown, no bullet characters, no trailing full stops longer than one sentence.
- source_url must be one of the supplied URLs that supports the bullet, or an empty string when it comes from the mentor's own answers.
- "best_fit_for" describes the founders this mentor helps best; "help_with" is concrete help they can give.
- The "positioning" sentence is the profile's one-liner. Pack it with specifics: background, what they help with, stage and sector. E.g. "Ex-SaaS CEO and two-time founder coaching pre-seed and seed teams on go-to-market, pricing and early sales across the Nordics."
- Write in the third person, plain English.`;

function cleanBullets(raw: unknown): ResearchBullet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const item = b as { text?: unknown; source_url?: unknown; company?: unknown; company_domain?: unknown };
      const text = typeof item.text === "string" ? item.text.replace(/^[-•*]\s*/, "").trim() : "";
      const url = typeof item.source_url === "string" && item.source_url.trim() ? item.source_url.trim() : null;
      const company = typeof item.company === "string" && item.company.trim() ? item.company.trim() : null;
      const domain =
        typeof item.company_domain === "string" && item.company_domain.trim()
          ? item.company_domain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()
          : null;
      return { text, source_url: url, company, company_domain: domain };
    })
    .filter((b) => b.text.length > 0)
    .slice(0, 6);
}

export async function writeInvestorProfile(
  payload: unknown,
  persona: "investor" | "mentor" = "investor",
): Promise<ResearchOutput> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project.");
  const tool =
    persona === "mentor"
      ? {
          ...RESEARCH_TOOL,
          function: {
            ...RESEARCH_TOOL.function,
            parameters: {
              ...RESEARCH_TOOL.function.parameters,
              properties: {
                ...RESEARCH_TOOL.function.parameters.properties,
                positioning: {
                  type: "string",
                  description:
                    "One sentence, max 160 chars, naming the mentor's background, the concrete areas they help with, and the stages or sectors they know best.",
                },
              },
            },
          },
        }
      : RESEARCH_TOOL;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      messages: [
        { role: "system", content: persona === "mentor" ? MENTOR_SYSTEM : SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "write_investor_profile" } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[investor-research] AI gateway ${res.status}: ${body.slice(0, 500)}`);
    if (res.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`AI request failed (${res.status}).`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI did not return a profile.");
  const parsed = JSON.parse(args) as Record<string, unknown>;
  return {
    positioning: typeof parsed.positioning === "string" ? parsed.positioning.trim() : "",
    help_with: cleanBullets(parsed.help_with),
    specialisations: cleanBullets(parsed.specialisations),
    track_record: cleanBullets(parsed.track_record),
    best_fit_for: cleanBullets(parsed.best_fit_for),
  };
}

/** Raw People Data Labs person/company record for a LinkedIn URL. */
export async function fetchLinkedInRecord(
  linkedinUrl: string,
): Promise<{ kind: "person" | "company"; data: Record<string, unknown> } | null> {
  const isCompany = /linkedin\.com\/company\//i.test(linkedinUrl);
  const endpoint = isCompany
    ? "https://api.peopledatalabs.com/v5/company/enrich"
    : "https://api.peopledatalabs.com/v5/person/enrich";
  const url = new URL(endpoint);
  url.searchParams.set("profile", linkedinUrl);
  if (!isCompany) url.searchParams.set("min_likelihood", "1");
  try {
    const res = await pdlFetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
    const data = isCompany ? json : (json.data ?? null);
    if (!data) return null;
    return { kind: isCompany ? "company" : "person", data };
  } catch {
    return null;
  }
}
