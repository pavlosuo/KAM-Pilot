import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  REASONING_OPTIONS,
  createGatewayModel,
  createRunIdFetch,
  describeGatewayError,
  getApiKey,
  withRunIdHeader,
} from "@/lib/ai/gateway.server";
import { assistantSystemPrompt } from "@/lib/ai/prompts";
import { rehearsalSystemPrompt } from "@/lib/ai/rehearsal-prompts";

const MAX_CONTEXT_CHARS = 60_000;

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: UIMessage[]; context?: unknown; mode?: string; rehearsal?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        if (!messages.length) return Response.json({ error: "No messages" }, { status: 400 });
        const contextJson = JSON.stringify(body.context ?? {});
        if (contextJson.length > MAX_CONTEXT_CHARS) return Response.json({ error: "Context too large" }, { status: 413 });

        try {
          const apiKey = getApiKey();
          const gw = createRunIdFetch(request.headers.get("X-Lovable-AIG-Run-ID") ?? undefined);
          const system =
            body.mode === "rehearsal" ? rehearsalSystemPrompt(contextJson, JSON.stringify(body.rehearsal ?? {})) : assistantSystemPrompt(contextJson);
          const result = streamText({
            model: createGatewayModel(apiKey, gw),
            system,
            messages: await convertToModelMessages(messages),
            abortSignal: request.signal,
            providerOptions: REASONING_OPTIONS("low"),
          });
          return await withRunIdHeader(
            result.toUIMessageStreamResponse({
              sendReasoning: false,
              onError: (err) => {
                console.error("assistant stream error", err);
                return describeGatewayError(err).message;
              },
            }),
            gw,
          );
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return new Response(null, { status: 499 });
          console.error("assistant error", err);
          const { status, message } = describeGatewayError(err);
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
