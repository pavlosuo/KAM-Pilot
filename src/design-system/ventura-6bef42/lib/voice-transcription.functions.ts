import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().default("audio/webm"),
});

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) {
      throw new Error("ElevenLabs is not connected to this project.");
    }

    const base64 = data.audio.includes(",") ? data.audio.split(",")[1] : data.audio;
    const bytes = Buffer.from(base64, "base64");
    const ext = data.mimeType.includes("mp4")
      ? "mp4"
      : data.mimeType.includes("webm")
        ? "webm"
        : "mp3";

    const blob = new Blob([bytes], { type: data.mimeType });
    const form = new FormData();
    form.append("file", blob, `recording.${ext}`);
    form.append("model_id", "scribe_v2");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Transcription failed: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as { text?: string };
    return json.text?.trim() ?? "";
  });
