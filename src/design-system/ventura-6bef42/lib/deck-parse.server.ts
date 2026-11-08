// Server-only helpers for deck parsing. Never import this from client-reachable files.
import { extractText, getDocumentProxy } from "unpdf";
import { supabaseAdmin } from "@/design-system/ventura-6bef42/integrations/supabase/client.server";

type ManifestPage = {
  page_number: number;
  title: string | null;
  text_layer: string;
  detected_numbers: string[];
  detected_emails: string[];
  detected_links: string[];
  possible_metrics: { label: string; value: string }[];
  visual_indicators: string[];
  needs_vision_ai: boolean;
  thumbnail_path: string | null;
};

type DeckManifest = {
  total_pages: number;
  pages: ManifestPage[];
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /\bhttps?:\/\/[^\s)\]]+/gi;
const NUMBER_RE =
  /\$?\s?\d[\d,.\s]*\s?(?:%|m|b|k|bn|million|billion|thousand|mrr|arr|users|customers|ltv|cac|gmv)?/gi;
const VISUAL_KEYWORDS = [
  ["chart", "chart"],
  ["graph", "chart"],
  ["bar", "chart"],
  ["map", "map"],
  ["screenshot", "screenshot"],
  ["logo", "logo"],
  ["dashboard", "screenshot"],
  ["funnel", "chart"],
] as const;

function extractPageData(rawText: string, pageNumber: number, thumbnailPath: string | null): ManifestPage {
  const text = (rawText ?? "").trim();
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 200) ?? null;

  const emails = Array.from(new Set(text.match(EMAIL_RE) ?? []));
  const links = Array.from(new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;]+$/, ""))));
  const numbersRaw = Array.from(new Set((text.match(NUMBER_RE) ?? []).map((n) => n.trim()))).filter(
    (n) => /\d/.test(n) && n.length <= 40,
  );
  const numbers = numbersRaw.slice(0, 30);

  const possible_metrics: { label: string; value: string }[] = [];
  for (const line of lines) {
    const m = line.match(
      /([A-Za-z][\w\s/&-]{2,40})[:\-–]\s*(\$?\s?\d[\d,.\s]*\s?(?:%|m|b|k|bn|million|billion|users|customers|mrr|arr)?)/i,
    );
    if (m) possible_metrics.push({ label: m[1].trim(), value: m[2].trim() });
    if (possible_metrics.length >= 10) break;
  }

  const lower = text.toLowerCase();
  const visual_indicators = Array.from(
    new Set(
      VISUAL_KEYWORDS.filter(([kw]) => lower.includes(kw)).map(([, tag]) => tag),
    ),
  );

  const needs_vision_ai = text.length < 120 || lines.length < 3;

  return {
    page_number: pageNumber,
    title,
    text_layer: text.slice(0, 6000),
    detected_numbers: numbers,
    detected_emails: emails,
    detected_links: links.slice(0, 20),
    possible_metrics,
    visual_indicators,
    needs_vision_ai,
    thumbnail_path: thumbnailPath,
  };
}

async function buildManifest(pdfBytes: Uint8Array, thumbnailPaths: string[]): Promise<DeckManifest> {
  const proxy = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(proxy, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const total = pages.length;
  return {
    total_pages: total,
    pages: pages.map((t, i) => extractPageData(t, i + 1, thumbnailPaths[i] ?? null)),
  };
}

async function thumbnailToDataUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage.from("deck-thumbnails").download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = path.toLowerCase().endsWith(".jpg") || path.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

const STARTUP_PROFILE_TOOL = {
  type: "function",
  function: {
    name: "emit_startup_profile",
    description: "Emit a structured Ventura startup profile extracted from a pitch deck.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        company_name: { type: ["string", "null"] },
        one_liner: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
        industry_tags: { type: "array", items: { type: "string" } },
        business_model_tags: { type: "array", items: { type: "string" } },
        investor_readiness: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
        executive_summary: { type: ["string", "null"] },
        problem: { type: ["string", "null"] },
        solution: { type: ["string", "null"] },
        market: { type: ["string", "null"] },
        customers_and_users: { type: ["string", "null"] },
        competitors: { type: "array", items: { type: "string" } },
        competitive_advantage: { type: ["string", "null"] },
        investment_case: { type: ["string", "null"] },
        traction: { type: ["string", "null"] },
        team_members: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              role: { type: ["string", "null"] },
              bio: { type: ["string", "null"] },
              linkedin: { type: ["string", "null"] },
            },
            required: ["name"],
          },
        },
        attachments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
            required: ["label", "url"],
          },
        },
        missing_information: { type: "array", items: { type: "string" } },
      },
      required: [
        "company_name",
        "one_liner",
        "industry_tags",
        "business_model_tags",
        "competitors",
        "team_members",
        "attachments",
        "missing_information",
      ],
    },
  },
};

const SYSTEM_PROMPT = `You are an analyst extracting a structured startup profile from a pitch deck.
You will receive:
- A compact JSON manifest of every slide with text, detected numbers, links, emails and visual indicators.
- Images of selected slides that are mostly visual.

RULES (critical):
- Use ONLY information that is actually present in the deck. Do NOT invent facts, numbers, names or quotes.
- If a field cannot be determined, set it to null (for scalars) or [] (for arrays) and add a short note to "missing_information".
- Be concise: each text field should be 1-4 sentences unless the deck provides clear long-form content.
- Industry and business model tags should be short (1-3 words), lowercase, no punctuation.
- Use the deck's own wording when possible.
- DO NOT extract or look for the following fields (they are collected separately from the founder): company_name, website, country, team_members, team biographical information, investor_readiness, investment_case, attachments, links, financial projections, funding ask. Always set these to null or []. NEVER mention any of them (including team bios, financial projections, or funding ask) in "missing_information".
Return the result via the emit_startup_profile tool.`;

async function callAi(manifest: DeckManifest): Promise<Record<string, unknown>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  // Pick vision pages (cap to 8)
  const visionPages = manifest.pages.filter((p) => p.needs_vision_ai && p.thumbnail_path).slice(0, 8);
  const visionParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
  for (const p of visionPages) {
    const url = await thumbnailToDataUrl(p.thumbnail_path!);
    if (url) visionParts.push({ type: "image_url", image_url: { url } });
  }

  // Slim manifest for prompt (drop very long text_layer)
  const slimManifest = {
    total_pages: manifest.total_pages,
    pages: manifest.pages.map((p) => ({
      ...p,
      text_layer: p.text_layer.slice(0, 1500),
      thumbnail_path: undefined,
    })),
  };

  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Pitch deck manifest (JSON):\n\n${JSON.stringify(slimManifest)}\n\nFor visually heavy slides, see the attached images (in order).`,
    },
    ...visionParts,
  ];

  const models = ["google/gemini-2.5-pro", "google/gemini-2.5-flash"];

  const attemptFetch = async (model: string): Promise<Response> => {
    const body = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: [STARTUP_PROFILE_TOOL],
      tool_choice: { type: "function", function: { name: "emit_startup_profile" } },
    };

    let lastErr = "";
    // Retry on transient 5xx (502/503/504) with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      if (res.status === 429) throw new Error("AI rate limit exceeded. Please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      const txt = await res.text();
      lastErr = `AI gateway error ${res.status}: ${txt.slice(0, 300)}`;
      // Only retry on transient gateway/upstream errors
      if (res.status !== 502 && res.status !== 503 && res.status !== 504 && res.status !== 408) {
        throw new Error(lastErr);
      }
      await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
    }
    throw new Error(lastErr || "AI gateway unavailable");
  };

  let res: Response;
  try {
    res = await attemptFetch(models[0]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Fall back to faster model on persistent upstream failure
    if (/502|503|504|408|unavailable/i.test(msg)) {
      res = await attemptFetch(models[1]);
    } else {
      throw e;
    }
  }

  const json = await res.json() as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{ function?: { arguments?: string } }>;
        content?: string;
      };
    }>;
  };
  const toolArgs = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (toolArgs) {
    try {
      return JSON.parse(toolArgs);
    } catch {
      throw new Error("AI returned invalid JSON in tool call.");
    }
  }
  const content = json.choices?.[0]?.message?.content ?? "";
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  throw new Error("AI did not return a structured profile.");
}

export async function runJob(jobId: string, userId: string): Promise<{ draftId: string }> {
  const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    await supabaseAdmin.from("deck_parse_jobs").update({ status, ...extra }).eq("id", jobId);
  };

  const { data: job, error: jErr } = await supabaseAdmin
    .from("deck_parse_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (jErr) throw jErr;
  if (!job) throw new Error("Job not found");

  try {
    await setStatus("parsing");

    const { data: file, error: dErr } = await supabaseAdmin.storage
      .from("pitch-decks-private")
      .download(job.pdf_path);
    if (dErr || !file) throw new Error(`Could not read deck: ${dErr?.message ?? "unknown"}`);
    const bytes = new Uint8Array(await file.arrayBuffer());

    const thumbs = Array.isArray(job.thumbnail_paths) ? (job.thumbnail_paths as string[]) : [];
    const manifest = await buildManifest(bytes, thumbs);

    await supabaseAdmin
      .from("deck_parse_jobs")
      .update({ manifest: manifest as never, status: "ai" })
      .eq("id", jobId);

    const profile = await callAi(manifest);

    // Save result and create/update draft
    await supabaseAdmin
      .from("deck_parse_jobs")
      .update({ result: profile as never, status: "done" })
      .eq("id", jobId);

    // Upsert draft for this user
    const { data: existing } = await supabaseAdmin
      .from("startup_drafts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let draftId: string;
    if (existing) {
      await supabaseAdmin
        .from("startup_drafts")
        .update({ data: profile as never, source_job_id: jobId, startup_id: job.startup_id })
        .eq("id", existing.id);
      draftId = existing.id as string;
    } else {
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("startup_drafts")
        .insert({
          user_id: userId,
          startup_id: job.startup_id,
          data: profile as never,
          source_job_id: jobId,
        })
        .select("id")
        .single();
      if (iErr) throw iErr;
      draftId = inserted.id as string;
    }

    return { draftId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus("failed", { error: msg });
    throw err;
  }
}
