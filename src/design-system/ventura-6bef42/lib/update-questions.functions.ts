import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  startupId: z.string().uuid(),
  previousAnswers: z.array(z.string()).default([]),
  previousQuestions: z.array(z.string()).default([]),
});

export const generateUpdateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: startup, error: sErr } = await supabase
      .from("startups")
      .select("name, one_liner, solution, traction, customers_and_users")
      .eq("id", data.startupId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!startup) throw new Error("Startup not found");

    const { data: pastUpdates } = await supabase
      .from("weekly_updates")
      .select("week_of, transcript, summary")
      .eq("startup_id", data.startupId)
      .order("week_of", { ascending: false })
      .limit(4);

    const s = startup as Record<string, unknown>;
    const pastUpdatesText =
      (pastUpdates ?? [])
        .map(
          (u: Record<string, unknown>, i: number) =>
            `Update ${i + 1} (week of ${u.week_of ?? "n/a"}):\n${u.summary ?? u.transcript ?? "(empty)"}`,
        )
        .join("\n\n") || "(no prior updates)";

    const qaHistory = data.previousQuestions
      .map((q, i) => `Q: ${q}\nA: ${data.previousAnswers[i] ?? "(no answer)"}`)
      .join("\n\n");

    const { createLovableAiGatewayProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are an experienced startup investor helping a founder give their weekly update.
You ask ONE concise, specific question at a time that an investor would most want answered about progress this week.
Focus on traction, metrics, customers, blockers, and concrete deltas. Avoid generic questions.
Return ONLY the question text — no preamble, no quotes, no numbering.`;

    const prompt = `Startup: ${s.name ?? ""}
One-liner: ${s.one_liner ?? "(none)"}
Solution: ${s.solution ?? "(none)"}
Customers/Users: ${s.customers_and_users ?? "(none)"}
Traction: ${s.traction ?? "(none)"}

Past weekly updates:
${pastUpdatesText}

${
  qaHistory
    ? `So far in this week's update, the founder has answered:\n${qaHistory}\n\nAsk the next most useful follow-up question (do NOT repeat earlier questions).`
    : `Ask the FIRST question for this week's update.`
}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      system,
      prompt,
    });

    return { question: text.trim().replace(/^["']|["']$/g, "") };
  });
