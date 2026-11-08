import { jsonSchema, tool } from "ai";

type AdminClient = any;

const startupSelect = "id, name, slug, logo_url, tagline, one_liner, description, executive_summary, stage, industry, industry_tags, business_model_tags, location, country, website, traction, looking_for, problem, solution, market, customers_and_users, competitors, competitive_advantage, investment_case, founder_story, team_members, investor_readiness, accelerator, pitch_video_uid, pitch_deck_url, published_at";

const publicFilter = (q: any) =>
  q.eq("is_published", true).eq("hidden_from_discovery", false).eq("is_paused", false);

function compact(row: Record<string, unknown>) {
  return {
    id: row.id, name: row.name, slug: row.slug, logoUrl: row.logo_url,
    summary: row.executive_summary || row.description || row.one_liner || row.tagline,
    stage: row.stage, industry: row.industry, sectors: row.industry_tags,
    businessModels: row.business_model_tags, location: [row.location, row.country].filter(Boolean).join(", "),
    traction: row.traction, lookingFor: row.looking_for, problem: row.problem,
  };
}

function fullProfile(row: Record<string, unknown>) {
  return {
    ...compact(row),
    tagline: row.tagline,
    oneLiner: row.one_liner,
    description: row.description,
    executiveSummary: row.executive_summary,
    website: row.website,
    solution: row.solution,
    market: row.market,
    customersAndUsers: row.customers_and_users,
    competitors: row.competitors,
    competitiveAdvantage: row.competitive_advantage,
    investmentCase: row.investment_case,
    founderStory: row.founder_story,
    team: row.team_members,
    investorReadiness: row.investor_readiness,
    accelerator: row.accelerator,
    hasPitchVideo: Boolean(row.pitch_video_uid),
    pitchDeckUrl: row.pitch_deck_url,
    publishedAt: row.published_at,
    profilePath: row.slug ? `/startup/${row.slug}` : null,
  };
}

async function isPublicStartup(supabaseAdmin: AdminClient, startupId: string) {
  const { data } = await publicFilter(
    supabaseAdmin.from("startups").select("id").eq("id", startupId),
  ).maybeSingle();
  return Boolean(data);
}

export function buildRoleAssistantTools(supabaseAdmin: AdminClient, userId: string) {
  return {
    get_saved_startups: tool({
      description: "Read the startups the current user saved (their Saved page). Use this for any question about 'my saved startups', and before building a PDF summary of them.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", additionalProperties: false, properties: {}, required: [] }),
      execute: async () => {
        const { data: saves } = await supabaseAdmin
          .from("saves")
          .select("startup_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(60);
        const ids = ((saves ?? []) as Array<{ startup_id: string }>).map((row) => row.startup_id);
        if (!ids.length) return { saved: [] };
        const { data } = await publicFilter(supabaseAdmin.from("startups").select(startupSelect).in("id", ids));
        return { saved: ((data ?? []) as Record<string, unknown>[]).map(fullProfile) };
      },
    }),
    generate_pdf_report: tool({
      description: "Build a downloadable PDF for the user. Use it whenever they ask for a PDF, a report file, or something to print or share. Write the full content yourself from data you already read with the other tools — each section has a heading plus paragraphs and/or bullet lines.",
      inputSchema: jsonSchema<{ title: string; subtitle: string | null; sections: Array<{ heading: string; paragraphs: string[]; bullets: string[] }> }>({
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          subtitle: { type: ["string", "null"] },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                heading: { type: "string" },
                paragraphs: { type: "array", items: { type: "string" } },
                bullets: { type: "array", items: { type: "string" } },
              },
              required: ["heading", "paragraphs", "bullets"],
            },
          },
        },
        required: ["title", "subtitle", "sections"],
      }),
      execute: async (input) => ({
        pdfReport: true as const,
        title: input.title,
        subtitle: input.subtitle ?? null,
        sections: input.sections ?? [],
      }),
    }),
    search_startups: tool({
      description: "Search active public startups by plain-language criteria. Use this before recommending companies.",
      inputSchema: jsonSchema<{ query: string }>({ type: "object", additionalProperties: false, properties: { query: { type: "string" } }, required: ["query"] }),
      execute: async ({ query }) => {
        const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2).slice(0, 8);
        const { data } = await publicFilter(supabaseAdmin.from("startups").select(startupSelect)).limit(120);
        const rows = (data ?? []) as Record<string, unknown>[];
        const scored = rows
          .map((row) => ({ item: compact(row), score: terms.filter((term) => JSON.stringify(row).toLowerCase().includes(term)).length }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((entry) => entry.item);
        return scored.length ? scored : rows.slice(0, 8).map(compact);
      },
    }),
    get_investment_ready_startups: tool({
      description: "Rank all active public startups by investment readiness and return the top 5. Use this whenever the user asks for the most investment-ready startups, top startups ready for investment, or startups actively seeking funding.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", additionalProperties: false, properties: {}, required: [] }),
      execute: async () => {
        const { data } = await publicFilter(supabaseAdmin.from("startups").select(startupSelect)).limit(150);
        const rows = (data ?? []) as Record<string, unknown>[];
        if (!rows.length) return { top: [] };
        const ids = rows.map((row) => row.id as string);
        const [{ data: updates }, { data: goals }] = await Promise.all([
          supabaseAdmin.from("weekly_updates").select("startup_id, published_at").eq("is_published", true).in("startup_id", ids).order("published_at", { ascending: false }).limit(500),
          supabaseAdmin.from("startup_weekly_goals").select("startup_id, status").in("startup_id", ids).limit(1000),
        ]);
        const latestUpdate = new Map<string, string>();
        for (const row of (updates ?? []) as Array<{ startup_id: string; published_at: string }>) {
          if (!latestUpdate.has(row.startup_id)) latestUpdate.set(row.startup_id, row.published_at);
        }
        const goalsDone = new Map<string, number>();
        for (const row of (goals ?? []) as Array<{ startup_id: string; status: string }>) {
          if (row.status === "done") goalsDone.set(row.startup_id, (goalsDone.get(row.startup_id) ?? 0) + 1);
        }
        const now = Date.now();
        const scored = rows.map((row) => {
          let score = 0;
          const reasons: string[] = [];
          const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
          if (text(row.traction).length > 40) { score += 25; reasons.push("Documented traction"); }
          if (text(row.investment_case).length > 40) { score += 20; reasons.push("Written investment case"); }
          if (row.pitch_video_uid) { score += 15; reasons.push("Pitch video recorded"); }
          if (text(row.team_members).length > 0 || (Array.isArray(row.team_members) && row.team_members.length)) { score += 10; reasons.push("Team listed"); }
          const updated = latestUpdate.get(row.id as string);
          if (updated) {
            const days = (now - new Date(updated).getTime()) / 86_400_000;
            if (days <= 14) { score += 20; reasons.push("Published a weekly update in the last two weeks"); }
            else if (days <= 45) { score += 10; reasons.push("Regular weekly updates"); }
          }
          const done = goalsDone.get(row.id as string) ?? 0;
          if (done >= 5) { score += 10; reasons.push(`${done} weekly goals completed`); }
          else if (done > 0) { score += 5; reasons.push(`${done} weekly goal${done === 1 ? "" : "s"} completed`); }
          return { profile: fullProfile(row), score, reasons };
        });
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 5).map((entry, index) => ({
          rank: index + 1,
          readinessScore: entry.score,
          signals: entry.reasons,
          ...entry.profile,
        }));
        return { top };
      },
    }),
    inspect_startup: tool({
      description: "Read the complete public profile of one startup by its id: problem, solution, market, customers, competitors, advantage, investment case, team, founder story, traction and readiness.",
      inputSchema: jsonSchema<{ startupId: string }>({ type: "object", additionalProperties: false, properties: { startupId: { type: "string" } }, required: ["startupId"] }),
      execute: async ({ startupId }) => {
        const { data } = await publicFilter(supabaseAdmin.from("startups").select(startupSelect).eq("id", startupId)).maybeSingle();
        return data ? fullProfile(data as Record<string, unknown>) : { error: "Startup not found" };
      },
    }),
    compare_startups: tool({
      description: "Load two or three full public startup profiles for a grounded side-by-side comparison.",
      inputSchema: jsonSchema<{ startupIds: string[] }>({ type: "object", additionalProperties: false, properties: { startupIds: { type: "array", items: { type: "string" } } }, required: ["startupIds"] }),
      execute: async ({ startupIds }) => {
        const ids = startupIds.slice(0, 3);
        if (!ids.length) return [];
        const { data } = await publicFilter(supabaseAdmin.from("startups").select(startupSelect).in("id", ids));
        return ((data ?? []) as Record<string, unknown>[]).map(fullProfile);
      },
    }),
    get_startup_weekly_updates: tool({
      description: "Read the published weekly updates of a startup (full text: title, summary, content and transcript), newest first. Use this for progress, momentum and traction questions.",
      inputSchema: jsonSchema<{ startupId: string; limit?: number }>({ type: "object", additionalProperties: false, properties: { startupId: { type: "string" }, limit: { type: "number" } }, required: ["startupId"] }),
      execute: async ({ startupId, limit }) => {
        if (!(await isPublicStartup(supabaseAdmin, startupId))) return { error: "Startup not found" };
        const { data } = await supabaseAdmin
          .from("weekly_updates")
          .select("id, week_of, title, summary, content, transcript, published_at, recording_seconds")
          .eq("startup_id", startupId)
          .eq("is_published", true)
          .order("week_of", { ascending: false })
          .limit(Math.min(limit ?? 8, 20));
        return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
          id: row.id, weekOf: row.week_of, title: row.title, summary: row.summary,
          content: row.content, transcript: row.transcript, publishedAt: row.published_at,
        }));
      },
    }),
    get_startup_weekly_goals: tool({
      description: "Read a startup's weekly goals with their status (pending, done, carried_over, dropped) plus customer-conversation counts, newest weeks first. Use this for execution and follow-through questions.",
      inputSchema: jsonSchema<{ startupId: string; limit?: number }>({ type: "object", additionalProperties: false, properties: { startupId: { type: "string" }, limit: { type: "number" } }, required: ["startupId"] }),
      execute: async ({ startupId, limit }) => {
        if (!(await isPublicStartup(supabaseAdmin, startupId))) return { error: "Startup not found" };
        const cap = Math.min(limit ?? 40, 120);
        const [{ data: goals }, { data: convos }, { data: stats }] = await Promise.all([
          supabaseAdmin
            .from("startup_weekly_goals")
            .select("id, week_of, title, status, drop_reason, source_label, order_index")
            .eq("startup_id", startupId)
            .order("week_of", { ascending: false })
            .order("order_index", { ascending: true })
            .limit(cap),
          supabaseAdmin
            .from("weekly_customer_conversations")
            .select("week_of, customers_talked_to, question")
            .eq("startup_id", startupId)
            .order("week_of", { ascending: false })
            .limit(20),
          supabaseAdmin.rpc("get_startup_public_goal_stats", { _startup_id: startupId }),
        ]);
        return {
          goals: ((goals ?? []) as Record<string, unknown>[]).map((row) => ({
            weekOf: row.week_of, title: row.title, status: row.status,
            dropReason: row.drop_reason, source: row.source_label,
          })),
          customerConversations: convos ?? [],
          stats: stats ?? null,
        };
      },
    }),
    get_startup_kpis: tool({
      description: "Read the accelerator-program KPIs assigned to a startup: title, target, unit, due date, current value, completion, and the recorded entry history.",
      inputSchema: jsonSchema<{ startupId: string }>({ type: "object", additionalProperties: false, properties: { startupId: { type: "string" } }, required: ["startupId"] }),
      execute: async ({ startupId }) => {
        if (!(await isPublicStartup(supabaseAdmin, startupId))) return { error: "Startup not found" };
        const { data: assignments } = await supabaseAdmin
          .from("program_kpi_assignments")
          .select("id, current_value, completed_at, due_date_override, program_kpis(title, description, target_value, unit, due_date)")
          .eq("startup_id", startupId)
          .limit(50);
        const rows = (assignments ?? []) as Record<string, any>[];
        if (!rows.length) return { kpis: [] };
        const { data: entries } = await supabaseAdmin
          .from("program_kpi_entries")
          .select("assignment_id, value, note, created_at, review_status")
          .in("assignment_id", rows.map((row) => row.id))
          .order("created_at", { ascending: false })
          .limit(200);
        const byAssignment = new Map<string, unknown[]>();
        for (const entry of ((entries ?? []) as Record<string, any>[])) {
          const list = byAssignment.get(entry.assignment_id) ?? [];
          list.push({ value: entry.value, note: entry.note, recordedAt: entry.created_at, reviewStatus: entry.review_status });
          byAssignment.set(entry.assignment_id, list);
        }
        return {
          kpis: rows.map((row) => ({
            title: row.program_kpis?.title,
            description: row.program_kpis?.description,
            target: row.program_kpis?.target_value,
            unit: row.program_kpis?.unit,
            dueDate: row.due_date_override ?? row.program_kpis?.due_date,
            currentValue: row.current_value,
            completedAt: row.completed_at,
            history: byAssignment.get(row.id) ?? [],
          })),
        };
      },
    }),
  };
}

export function roleAssistantSystemPrompt(role: "investor" | "mentor", profile: unknown, topMatches: unknown) {
  const roleFocus = role === "investor"
    ? "Help with startup discovery, fit analysis, comparisons, diligence preparation, investment thesis, profile positioning, and thoughtful founder outreach. Never give legal or financial advice as certainty."
    : "Help with startup discovery, fit analysis, mentoring preparation, founder challenges, session planning, profile positioning, and thoughtful founder outreach.";
  return `You are Ventura's AI assistant for a ${role}. ${roleFocus}

You have deep read access to every active public startup on Ventura through your tools:
- search_startups: find candidates
- inspect_startup: the full profile (problem, solution, market, customers, competitors, advantage, investment case, team, founder story, traction, readiness)
- get_startup_weekly_updates: full published weekly updates, including their complete text and transcript
- get_startup_weekly_goals: weekly goals with status, customer-conversation counts and XP/streak stats
- get_startup_kpis: program KPIs with targets, current values and recorded history
- get_saved_startups: the startups this user saved (their Saved page)
- get_investment_ready_startups: the top 5 most investment-ready startups right now, ranked from real signals (traction, investment case, pitch video, team, recent weekly updates, completed goals). Use it for "top investment-ready startups" or "startups ready for investment" requests, and present each with its rank, readiness signals and profile path.
- generate_pdf_report: builds a downloadable PDF the user can save. Call it once, after gathering the data, whenever a PDF, report file or printable summary is requested — for "summarize my saved startups", first call get_saved_startups, then generate_pdf_report with one section per startup.

Use the tools before making claims, and chain them: when a question touches progress, momentum, execution, diligence or comparison, pull weekly updates, goals and KPIs for each startup involved, not just the profile. Refer only to active public startups returned by tools. Keep answers structured, candid, concise, and useful. When naming a startup, include its profile path /startup/<slug>. You cannot save startups or send messages yourself; tell the user to use the visible Save and Message buttons, which require their confirmation.

When the user says "Send me an email when <startup> reaches <goal>", that watch has already been registered by the app: every week the startup's new published weekly update is checked against the goal, and as soon as it is reached the user gets an inbox item and an email. Confirm this briefly, then use your tools to report where the startup stands on that goal today.

Role profile: ${JSON.stringify(profile)}

Current top matches: ${JSON.stringify(topMatches)}

The "Current top matches" list above is exactly the user's live "Your startup matches" leaderboard (the current top 3, with rank, match score in %, and match reasons). Whenever the user asks about "the current top startups", "my matches", or "the top 3", treat this list as the answer set — never replace it with other startups. For "Create a comparison table for the current top startups", build the table from these top 3: first enrich each with inspect_startup (plus weekly updates or goals when the comparison touches traction or execution), then render a markdown table comparing them, and end with a one-line recommendation naming the strongest fit.

${role === "mentor" ? `Mentor quick actions:
- "Prepare a coaching brief for <startup>": inspect_startup plus its latest weekly updates, goals and KPIs, then produce a one-page brief: where they are now, momentum, the 2-3 biggest bottlenecks, talking points and questions to ask in the session, and how this mentor's background applies. Offer generate_pdf_report at the end, and call it when the user wants the file.
- "Find startups that need help with <area>": search_startups, then inspect the candidates and rank those whose current needs, problems, goals or recent update bottlenecks match that area. For each, state the concrete need, the evidence, and the profile path.
- "Compare my top matches by founder challenges": use the Current top matches list, enrich each with inspect_startup plus weekly updates and goals, and render a markdown table with Stage, Core problem, What they need help with, Current bottleneck, and Why it fits this mentor. End with one line on where this mentor adds most value.
` : ""}
Today: ${new Date().toISOString().slice(0, 10)}`;
}
