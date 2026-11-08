import { generateResponse } from "@lovable.dev/ai-gateway";
import { ARCHETYPE_IDS } from "@/lib/engine/avatars";
import { PRIORITY_KEYS, PRIORITY_META } from "@/lib/engine/priorities";
import { RESEARCH_MODEL, gatewayFailure, parseJson, responseText } from "@/lib/ai/sdk.server";
import { missingParams, type InterviewDraft, type InterviewInput, type InterviewTurn } from "./interview-types";
import { sanitizeDraft } from "./sanitize";

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ anyOf: [{ type: "null" }, { type, ...extra }] });
const strings = { type: "array", items: { type: "string" } };

const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "quickReplies", "draft"],
  properties: {
    reply: { type: "string" },
    quickReplies: strings,
    draft: {
      type: "object",
      additionalProperties: false,
      required: [
        "customerId",
        "personName",
        "role",
        "country",
        "archetype",
        "decisions",
        "goals",
        "reporting",
        "moments",
        "avoid",
        "detail",
        "tone",
        "showMoney",
        "skepticism",
        "weights",
        "concerns",
        "lookups",
      ],
      properties: {
        customerId: nullable("string"),
        personName: nullable("string"),
        role: nullable("string"),
        country: nullable("string"),
        archetype: nullable("string", { enum: ARCHETYPE_IDS }),
        decisions: strings,
        goals: strings,
        reporting: strings,
        moments: strings,
        avoid: strings,
        detail: nullable("string", { enum: ["headline", "balanced", "deep"] }),
        tone: nullable("string", { enum: ["executive", "operational", "technical"] }),
        showMoney: nullable("boolean"),
        skepticism: nullable("integer"),
        weights: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: PRIORITY_KEYS,
              properties: Object.fromEntries(PRIORITY_KEYS.map((k) => [k, { type: "integer" }])),
            },
          ],
        },
        concerns: strings,
        lookups: strings,
      },
    },
  },
} as const;

function systemPrompt(input: InterviewInput): string {
  const companies = input.companies
    .map(
      (c) =>
        `- id ${c.id}: ${c.name} - ${c.industry}, ${c.segment}, HQ ${c.hqCountry}; sites: ${c.countries.map((x) => `${x.name} (${x.sites})`).join(", ")}; stated topics: ${c.topics.join(", ") || "none"}${c.synthetic ? " [synthetic test company]" : ""}`,
    )
    .join("\n");
  const priorities = PRIORITY_KEYS.map((k) => `${k} = ${PRIORITY_META[k].label} (${PRIORITY_META[k].description})`).join("; ");
  return `You interview a Lindström key account manager (KAM) to build a "stakeholder avatar": the customer-side person a value & sustainability review is prepared for. Lindström rents workwear and washes it in industrial laundries. Today is ${input.today}.

Goal: collect, in as few turns as possible, only what CANNOT be looked up on the web. After the interview the app researches country rules automatically.

Companies in the uploaded data (only these can be chosen):
${companies}

HARD LIMIT: the whole interview is at most 5 questions. The KAM has answered ${input.messages.filter((m) => m.role === "user").length} so far. Never ask the KAM to confirm, review or approve anything, never repeat a question that was answered, and never ask optional extra questions - the app saves the avatar automatically as soon as the five items below are known.

Ask only the next missing item, one short question per turn, in this order (skip anything already in the draft):
1. Company - offer the company names as quick replies.
2. The person's role / job title (a name is optional; take it if given). If several roles are chosen, store them joined with " / ".
3. Location - the country they operate in. Offer that company's site countries (with site counts) and "All countries". Store the exact country name, or "ALL". If several countries are chosen, store "ALL".
4. Decisions they own or approve (budget & contracts, sustainability reporting, site operations, hygiene & quality, procurement…).
5. What they are measured on: KPIs or targets (e.g. "−30% Scope 3 by 2030", "cost per wearer −5% in 2027").
Answers may list several options separated by ";" - keep every one. If an answer also mentions reporting duties, upcoming moments or things to avoid, store them, but do not ask for them.

Never ask about laws, carbon taxes, tax incentives, EU or national regulation, or the company's public targets - instead tell the KAM you will look these up, and list the concrete lookups you plan in draft.lookups (e.g. "Swedish carbon tax rate 2026", "CSRD timeline for Swedish companies after the Omnibus", "textile EPR timeline in Sweden", "energy-efficiency tax deductions in Sweden").

Draft rules - return the COMPLETE updated draft every turn, keeping earlier answers:
- customerId: the company id from the list. country: exact country name from that company's sites, or "ALL".
- archetype: closest of ${ARCHETYPE_IDS.join(", ")} (kam-balanced = general/other).
- weights: 0–3 per priority for what this person values, from role and answers. Priorities: ${priorities}.
- detail / tone / showMoney / skepticism (1 friendly … 5 tough): infer sensible defaults from the role when not stated.
- concerns: 2–4 questions this person would likely ask in the review, in their own voice.
- Lists hold short phrases, not sentences. Never invent facts the KAM did not say for decisions, goals, reporting, moments or avoid.

Reply style: warm, crisp, max 2 short sentences. Briefly acknowledge what you captured (a few words), then ask the next question. When all five items are known, reply with a one-line summary and "Saving the avatar and researching the country rules now." - no question, and quickReplies must be empty. Otherwise quickReplies: 3–6 options (max 40 characters each) for the question; the KAM can pick several and add their own, so make them distinct, realistic choices for this role and industry. Return JSON.`;
}

export async function interviewTurn(input: InterviewInput): Promise<InterviewTurn> {
  const previous = input.draft as InterviewDraft;
  try {
    const resp = await generateResponse({
      model: RESEARCH_MODEL,
      instructions: systemPrompt(input),
      input: [
        ...input.messages.slice(-30).map((m) =>
          m.role === "user"
            ? { role: "user" as const, content: m.text }
            : { role: "assistant" as const, content: m.text },
        ),
        { role: "user" as const, content: `Current draft (JSON): ${JSON.stringify(previous)}\nReturn JSON with reply, quickReplies and the full updated draft.` },
      ],
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "interview_turn", schema: TURN_SCHEMA as unknown as Record<string, unknown>, strict: true } },
    });
    const raw = parseJson<{ reply: string; quickReplies: string[]; draft: Partial<InterviewDraft> }>(responseText(resp));
    if (!raw || typeof raw.reply !== "string") return { ok: false, error: "The interviewer's answer could not be read. Send your answer again." };
    const draft = sanitizeDraft(raw.draft ?? {}, input.companies, previous);
    const quickReplies = (Array.isArray(raw.quickReplies) ? raw.quickReplies : [])
      .filter((q): q is string => typeof q === "string" && !!q.trim())
      .map((q) => q.trim().slice(0, 60))
      .slice(0, 6);
    return { ok: true, reply: raw.reply.trim().slice(0, 1200), quickReplies, draft, missing: missingParams(draft) };
  } catch (err) {
    console.error("interview turn failed", err);
    return { ok: false, error: gatewayFailure(err).message };
  }
}
