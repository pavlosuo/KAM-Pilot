import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const voiceRequest = z.object({ text: z.string().trim().min(1).max(60_000) });

export const Route = createFileRoute("/api/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) {
          return Response.json({ error: "Voice requests must come from this app." }, { status: 403 });
        }
        const parsed = voiceRequest.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Enter text to voice." }, { status: 400 });
        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) return Response.json({ error: "ElevenLabs is not connected." }, { status: 503 });
        try {
          const response = await fetch(
            "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream?output_format=mp3_44100_128",
            {
              method: "POST",
              headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                text: parsed.data.text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
              }),
              signal: request.signal,
            },
          );
          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`ElevenLabs voice failed [${response.status}]: ${errorBody}`);
            return Response.json({ error: `ElevenLabs [${response.status}]: ${errorBody}` }, { status: response.status });
          }
          if (!response.body) return Response.json({ error: "ElevenLabs returned no audio." }, { status: 502 });
          return new Response(response.body, {
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error("ElevenLabs voice connection failed", error);
          return Response.json({ error: "Could not load the stakeholder voice. Try the voice button again." }, { status: 502 });
        }
      },
    },
  },
});