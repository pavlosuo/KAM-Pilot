import { createOpenAI } from "@ai-sdk/openai";

/** Lovable AI Gateway helpers (server-only). */
export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const CHAT_MODEL = "openai/gpt-6-astra";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new GatewayConfigError("LOVABLE_API_KEY is not configured");
  return key;
}

export class GatewayConfigError extends Error {}

export function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (v: string | undefined) => void = () => {};
  let resolved = false;
  const ready = new Promise<string | undefined>((r) => (resolveRunId = r));
  const publish = (v?: string) => {
    const next = v?.trim() || undefined;
    if (!runId && next) runId = next;
    if (!resolved) {
      resolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publish(runId);
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      try {
        const res = await fetch(input, { ...init, headers });
        publish(res.headers.get(RUN_ID_HEADER) ?? undefined);
        return res;
      } catch (e) {
        publish(undefined);
        throw e;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : ready),
  };
}

export function createGatewayModel(apiKey: string, runIdFetch: ReturnType<typeof createRunIdFetch>) {
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return provider.responses(CHAT_MODEL);
}

export const REASONING_OPTIONS = (effort: "low" | "medium" = "low") => ({
  openai: {
    forceReasoning: true,
    reasoningEffort: effort,
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
});

/** Re-emit a streaming response with the gateway run id header once known. */
export async function withRunIdHeader(response: Response, gw: ReturnType<typeof createRunIdFetch>): Promise<Response> {
  if (!response.body) return response;
  const reader = response.body.getReader();
  const first = reader.read();
  const runId = await gw.waitForRunId();
  const headers = new Headers(response.headers);
  if (runId) {
    headers.set(RUN_ID_HEADER, runId);
    headers.set("Access-Control-Expose-Headers", RUN_ID_HEADER);
  }
  const body = new ReadableStream({
    async start(controller) {
      try {
        const f = await first;
        if (f.done) return controller.close();
        controller.enqueue(f.value);
        for (;;) {
          const c = await reader.read();
          if (c.done) break;
          controller.enqueue(c.value);
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

/** Maps gateway/provider errors to a status and a message safe to show users. */
export function describeGatewayError(err: unknown): { status: number; message: string } {
  const e = err as { statusCode?: number; status?: number; responseBody?: string; message?: string };
  const status = e?.statusCode ?? e?.status ?? 500;
  let message = "The assistant is unavailable right now. Please try again in a moment.";
  if (status === 402) message = "AI credits are used up for this workspace. Add credits in Settings → Plans & credits to continue.";
  else if (status === 429) message = "The assistant is busy. Please wait a few seconds and try again.";
  else if (status === 403) message = "AI access is blocked for this workspace by an admin setting.";
  else if (status === 400) message = "The request could not be processed. Try a shorter question.";
  if (err instanceof GatewayConfigError) message = "The AI service is not configured for this project.";
  return { status, message };
}
