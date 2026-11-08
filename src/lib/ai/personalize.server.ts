import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { REASONING_OPTIONS, createGatewayModel, createRunIdFetch, describeGatewayError, getApiKey } from "./gateway.server";
import { personalizeSystemPrompt } from "./prompts";

const schema = z.object({
  water: z.number(),
  emissions: z.number(),
  cost: z.number(),
  circularity: z.number(),
  service: z.number(),
  hygiene: z.number(),
  evidence: z.number(),
  improvement: z.number(),
  rationale: z.string(),
  focusSites: z.array(z.string()),
});

export interface PersonalizeInput {
  text: string;
  customerName: string;
  industry: string;
  siteNames: string[];
}

export type PersonalizeResult =
  | { ok: true; weights: Record<string, number>; rationale: string; focusSites: string[] }
  | { ok: false; error: string };

export async function interpretPriorities(input: PersonalizeInput): Promise<PersonalizeResult> {
  try {
    const apiKey = getApiKey();
    const gw = createRunIdFetch();
    const result = streamText({
      model: createGatewayModel(apiKey, gw),
      system: personalizeSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Customer: ${input.customerName} (${input.industry}).\nSites: ${input.siteNames.join(", ")}.\nKAM note: """${input.text.slice(0, 1200)}"""`,
        },
      ],
      output: Output.object({ schema }),
      providerOptions: REASONING_OPTIONS("low"),
    });
    let out: z.infer<typeof schema>;
    try {
      out = (await result.output) as z.infer<typeof schema>;
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) return { ok: false, error: "The AI answer could not be read. The rules-based reading is used instead." };
      throw e;
    }
    const clamp = (v: number) => Math.max(0, Math.min(3, Math.round(v)));
    const { rationale, focusSites, ...w } = out;
    const weights = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, clamp(v)]));
    return { ok: true, weights, rationale, focusSites: focusSites.filter((s) => input.siteNames.includes(s)).slice(0, 3) };
  } catch (err) {
    console.error("personalize error", err);
    return { ok: false, error: describeGatewayError(err).message };
  }
}
