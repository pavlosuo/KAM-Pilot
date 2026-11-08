// Weekly AI-picked learning resources for startups in a program.
// Generation runs server-side only (cron on Mondays, or lazily on first view).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const RESOURCE_COUNT = 12;

export type AiResource = {
  position: number;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  source_label: string | null;
};

/** Monday (UTC) of the week a date falls in, as YYYY-MM-DD. */
export function mondayOf(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/** Public profile + recent full weekly updates (texts, progress cards, goals). */
export async function collectStartupContext(supabase: SB, startupId: string) {
  const { data: startup } = await supabase
    .from("startups")
    .select(
      "id, name, tagline, one_liner, description, industry, industry_tags, business_model_tags, stage, location, country, problem, solution, market, customers_and_users, competitors, competitive_advantage, investment_case, traction, looking_for, team_members",
    )
    .eq("id", startupId)
    .maybeSingle();
  if (!startup) throw new Error("Startup not found");

  const { data: updates } = await supabase
    .from("weekly_updates")
    .select("week_of, title, summary, transcript, content")
    .eq("startup_id", startupId)
    .eq("is_published", true)
    .order("week_of", { ascending: false })
    .limit(4);

  const { data: cards } = await supabase
    .from("startup_progression_cards")
    .select("label, value, subtitle, weekly_delta, card_type, description")
    .eq("startup_id", startupId)
    .order("updated_at", { ascending: false })
    .limit(20);

  const { data: goals } = await supabase
    .from("startup_weekly_goals")
    .select("title, status, week_of, source_label")
    .eq("startup_id", startupId)
    .order("week_of", { ascending: false })
    .limit(20);

  const s = startup as Record<string, unknown>;
  return {
    profile: {
      name: clip(s.name, 160),
      tagline: clip(s.tagline ?? s.one_liner, 300),
      description: clip(s.description, 1500),
      industry: clip(s.industry, 120),
      tags: [s.industry_tags, s.business_model_tags]
        .flatMap((t) => (Array.isArray(t) ? t : []))
        .slice(0, 20),
      stage: clip(s.stage, 80),
      location: clip(s.location ?? s.country, 120),
      problem: clip(s.problem, 1200),
      solution: clip(s.solution, 1200),
      market: clip(s.market, 1000),
      customers: clip(s.customers_and_users, 1000),
      competitors: clip(s.competitors, 800),
      advantage: clip(s.competitive_advantage, 800),
      traction: clip(s.traction, 800),
      lookingFor: clip(s.looking_for, 600),
    },
    updates: ((updates ?? []) as Array<Record<string, unknown>>).map((u) => ({
      weekOf: u.week_of,
      title: clip(u.title, 200),
      summary: clip(u.summary, 1500),
      transcript: clip(u.transcript, 2500),
    })),
    progressCards: ((cards ?? []) as Array<Record<string, unknown>>).map((c) => ({
      label: clip(c.label, 120),
      value: clip(String(c.value ?? ""), 60),
      subtitle: clip(c.subtitle, 160),
      delta: c.weekly_delta ?? null,
    })),
    // Only founder-set goals from weekly updates — program-lead challenges are excluded.
    goals: ((goals ?? []) as Array<Record<string, unknown>>)
      .filter((g) => !/challenge/i.test(clip(g.source_label, 120)))
      .map((g) => ({
        title: clip(g.title, 200),
        status: clip(g.status, 40),
        weekOf: g.week_of,
      })),
  };
}

const SYSTEM = `You are Ventura AI, an analyst who curates learning material for early-stage startup founders.

You get a startup's public profile and its recent full weekly updates (texts, progress numbers, goals).
Pick exactly ${RESOURCE_COUNT} resources that would genuinely help THIS startup at THIS stage right now.

Rules:
- Mix the kinds: "video", "essay", "interview", "book", "template", "framework", "legal", "program", "tool".
- Only reference real, well-known, stable public materials (YC/Startup School videos, Paul Graham essays,
  The Mom Test, Lean Canvas, Sequoia deck template, EU/Nordic grant or accelerator programs, standard
  legal doc sets like Y Combinator SAFE, etc.). Never invent a URL. If you are not confident about an exact
  URL, use the homepage of the source instead.
- Tie each pick to what the startup is actually working on (their goals, blockers, metrics, stage).
- Order them by usefulness, most useful first.

Return ONLY a JSON array of ${RESOURCE_COUNT} objects, no markdown fences, each:
{"kind":"video","title":"...","description":"one short sentence on why it helps them now (max 160 chars)","url":"https://...","source":"YC Startup School"}`;

/** Calls the AI gateway and returns parsed resource rows. */
export async function generateResources(context: unknown): Promise<AiResource[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const { streamText } = await import("ai");
  const { createLovableResponsesProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");
  const provider = createLovableResponsesProvider(key);

  const result = streamText({
    model: provider.responses("openai/gpt-5.6-sol"),
    system: SYSTEM,
    prompt: JSON.stringify(context),
    providerOptions: { openai: { store: false } },
  });
  const text = await result.text;

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("AI returned an unreadable response");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (!Array.isArray(parsed)) throw new Error("AI returned an unreadable response");

  return parsed
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .slice(0, RESOURCE_COUNT)
    .map((r, i) => ({
      position: i,
      kind: clip(r.kind, 30).toLowerCase() || "resource",
      title: clip(r.title, 200) || "Resource",
      description: clip(r.description, 300) || null,
      url: clip(r.url, 500) || null,
      source_label: clip(r.source ?? r.source_label, 120) || null,
    }))
    .filter((r) => r.title.length > 0);
}

/** Regenerates and stores the week's resources for one startup. */
export async function refreshStartupResources(
  supabaseAdmin: SB,
  startupId: string,
  programId: string | null,
  weekOf = mondayOf(),
) {
  const context = await collectStartupContext(supabaseAdmin, startupId);
  const resources = await generateResources(context);
  if (!resources.length) return { inserted: 0 };

  await supabaseAdmin
    .from("startup_ai_resources")
    .delete()
    .eq("startup_id", startupId)
    .eq("week_of", weekOf);

  const { error } = await supabaseAdmin.from("startup_ai_resources").insert(
    resources.map((r) => ({
      startup_id: startupId,
      program_id: programId,
      week_of: weekOf,
      position: r.position,
      kind: r.kind,
      title: r.title,
      description: r.description,
      url: r.url,
      source_label: r.source_label,
    })),
  );
  if (error) throw new Error(error.message);
  return { inserted: resources.length };
}
