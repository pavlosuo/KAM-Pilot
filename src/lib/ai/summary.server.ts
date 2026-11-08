import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { REASONING_OPTIONS, createGatewayModel, createRunIdFetch, describeGatewayError, getApiKey } from "./gateway.server";
import { GROUNDING_RULES } from "./prompts";

const schema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()),
});

export type SummaryResult = { ok: true; headline: string; bullets: string[] } | { ok: false; error: string };

/** Executive summary for the review deck, written for the selected stakeholder from the calculated facts. */
export async function writeSummary(contextJson: string): Promise<SummaryResult> {
  try {
    const apiKey = getApiKey();
    const gw = createRunIdFetch();
    const result = streamText({
      model: createGatewayModel(apiKey, gw),
      system: `You write the executive-summary slide of a Lindström annual customer value review.
Write for the audience avatar in the context (respect tone, detail and whether money is shown) and lead with the top-ranked priorities.
Return a one-sentence headline (max 28 words) and 3–5 bullets (max 26 words each): value delivered with the baseline named and ranges where estimated, then the most useful next-year actions with owners.

${GROUNDING_RULES}`,
      messages: [{ role: "user", content: `CONTEXT JSON:\n${contextJson}` }],
      output: Output.object({ schema }),
      providerOptions: REASONING_OPTIONS("low"),
    });
    try {
      const out = (await result.output) as z.infer<typeof schema>;
      return { ok: true, headline: out.headline.trim(), bullets: out.bullets.map((b) => b.trim()).filter(Boolean).slice(0, 5) };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) return { ok: false, error: "The AI summary could not be read. The standard summary is used." };
      throw e;
    }
  } catch (err) {
    console.error("summary error", err);
    return { ok: false, error: describeGatewayError(err).message };
  }
}
