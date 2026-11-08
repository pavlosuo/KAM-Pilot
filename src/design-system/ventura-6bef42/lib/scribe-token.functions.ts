import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

export const createScribeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ElevenLabs is not connected");
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: { "xi-api-key": apiKey },
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("ElevenLabs token request failed", response.status, errText);
      throw new Error(`Token request failed (${response.status})`);
    }

    const json = (await response.json()) as { token?: string };
    if (!json.token) {
      throw new Error("No token returned from ElevenLabs");
    }
    return { token: json.token };
  });
