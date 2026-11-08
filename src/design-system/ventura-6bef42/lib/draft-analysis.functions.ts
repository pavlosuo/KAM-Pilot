import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  draft: z.record(z.string(), z.unknown()),
});

export const analyzeDraftGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You review a startup profile draft written by a founder.
Identify what important information is missing, vague, or too thin for investors.
Focus on: market size and evidence, customers/users, traction and metrics, competitors,
competitive advantage, business model, and the clarity of problem/solution.
Return ONLY a JSON array of short strings (max 6 items), each one concrete and actionable,
e.g. "No market size figures (TAM/SAM) provided". If nothing meaningful is missing, return [].
No prose, no markdown fences.`;

    const { text } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      system,
      prompt: JSON.stringify(data.draft),
    });

    let items: string[] = [];
    try {
      const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed: unknown = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        items = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 6);
      }
    } catch {
      items = [];
    }

    return { missing_information: items };
  });
