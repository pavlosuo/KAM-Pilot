import { GatewayError } from "@lovable.dev/ai-gateway";

/** Model used for the avatar interview and the web research (Responses surface). */
export const RESEARCH_MODEL = "openai/gpt-6-astra" as const;

/** User-safe explanation of a final gateway failure (after SDK retries). */
export function gatewayFailure(err: unknown): { message: string; retryable: boolean } {
  if (err instanceof GatewayError) {
    switch (err.code) {
      case "payment_required":
        return { message: "AI credits are used up for this workspace. Add credits in Settings → Plans & credits, then try again.", retryable: false };
      case "rate_limited":
        return { message: "The AI service is busy. Wait a few seconds and try again.", retryable: true };
      case "permission_denied":
        return { message: "AI access is blocked for this workspace by an admin setting.", retryable: false };
      case "configuration_error":
      case "authentication_error":
        return { message: "The AI service is not configured for this project.", retryable: false };
      case "request_rejected":
        return { message: "The AI service could not process this request. Try shorter answers.", retryable: false };
      case "timeout":
      case "network_error":
        return { message: "The AI service took too long to answer. Try again.", retryable: true };
      default:
        return { message: "The AI service is unavailable right now. Try again in a moment.", retryable: true };
    }
  }
  return { message: "Something went wrong while talking to the AI service. Try again.", retryable: true };
}

interface OutputItem {
  type?: string;
  content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }>;
  action?: { type?: string; query?: string; queries?: string[]; sources?: Array<{ type?: string; url?: string }> };
}

function items(resp: unknown): OutputItem[] {
  const out = (resp as { output?: unknown })?.output;
  return Array.isArray(out) ? (out as OutputItem[]) : [];
}

/** Concatenated assistant text of a Responses API result. */
export function responseText(resp: unknown): string {
  return items(resp)
    .filter((i) => i.type === "message")
    .flatMap((i) => i.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
}

/** Search queries the model ran and the URLs the live search actually returned or cited. */
export function searchTrace(resp: unknown): { queries: string[]; urls: Set<string> } {
  const queries: string[] = [];
  const urls = new Set<string>();
  for (const it of items(resp)) {
    if (it.type === "web_search_call" && it.action) {
      for (const q of it.action.queries ?? (it.action.query ? [it.action.query] : [])) if (q && !queries.includes(q)) queries.push(q);
      for (const s of it.action.sources ?? []) if (s.url) urls.add(normalizeUrl(s.url));
    }
    if (it.type === "message") {
      for (const c of it.content ?? []) for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) urls.add(normalizeUrl(a.url));
    }
  }
  return { queries, urls };
}

/** Drops tracking parameters, fragments and trailing slashes so search and model URLs compare equal. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    const s = u.toString();
    return s.endsWith("/") ? s.slice(0, -1) : s;
  } catch {
    return raw.trim();
  }
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Parses the model's JSON answer; tolerates code fences around it. */
export function parseJson<T>(text: string): T | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(t) as T;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
