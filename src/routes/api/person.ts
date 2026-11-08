import { createFileRoute } from "@tanstack/react-router";
import { streamPersonResearch } from "@/lib/people/research.server";
import { hasPersonInput, personRequestSchema, type PersonEvent } from "@/lib/people/types";

/**
 * Researches one customer stakeholder from the KAM's material and the web.
 * Streams NDJSON progress events and ends with a validated profile.
 */
export const Route = createFileRoute("/api/person")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = personRequestSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid person request" }, { status: 400 });
        if (!hasPersonInput(parsed.data)) return Response.json({ error: "Add a LinkedIn link, a file or a few words about the person." }, { status: 400 });

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (e: PersonEvent) => {
              try {
                controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
              } catch {
                // client went away
              }
            };
            await streamPersonResearch(parsed.data, emit, request.signal);
            try {
              controller.close();
            } catch {
              // already closed
            }
          },
        });
        return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
