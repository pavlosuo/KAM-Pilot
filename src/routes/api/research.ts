import { createFileRoute } from "@tanstack/react-router";
import { researchRequestSchema } from "@/lib/regulation/request-schema";
import { streamResearchTopic, type ResearchEvent } from "@/lib/regulation/research.server";
import type { ResearchRequest } from "@/lib/regulation/types";

/**
 * Web-grounded country research for one avatar topic. Streams NDJSON progress
 * events (search queries) and ends with a validated, source-checked result.
 */
export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = researchRequestSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid research request" }, { status: 400 });
        const req = parsed.data as ResearchRequest;

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (e: ResearchEvent) => {
              try {
                controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
              } catch {
                // client went away
              }
            };
            await streamResearchTopic(req, emit, request.signal);
            try {
              controller.close();
            } catch {
              // already closed
            }
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
