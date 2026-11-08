import { tool } from "ai";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const NIL = "00000000-0000-0000-0000-000000000000";

// Public columns that are safe to expose to the AI co-founder for competitive
// analysis, benchmarking and examples.
const PUBLIC_STARTUP_COLUMNS = [
  "id",
  "name",
  "slug",
  "tagline",
  "description",
  "industry",
  "stage",
  "location",
  "country",
  "logo_url",
  "website",
  "one_liner",
  "industry_tags",
  "business_model_tags",
  "investor_readiness",
  "executive_summary",
  "problem",
  "solution",
  "market",
  "customers_and_users",
  "competitors",
  "competitive_advantage",
  "investment_case",
  "traction",
  "looking_for",
  "team_members",
  "accelerator",
  "pitch_video_uid",
  "pitch_deck_url",
  "is_published",
  "published_at",
].join(", ");

/**
 * Read-only tools for the founder-facing AI co-founder on /program-content.
 * Everything is hard-scoped to one startup (and the program it belongs to).
 */
export async function buildFounderAiTools(
  supabaseAdmin: SB,
  startupId: string,
  programId: string,
) {
  return {
    startup_profile: tool({
      description:
        "The startup's own profile: name, one-liner, description, stage, industry, location, website, what they are looking for, traction, plus team members and total XP.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: startup }, { data: members }, { data: xpRows }, { data: badges }] =
          await Promise.all([
            supabaseAdmin
              .from("startups")
              .select(
                "id, name, slug, one_liner, tagline, description, stage, industry, location, website, pitch_deck_url, pitch_video_uid, looking_for, traction, owner_id, published_at",
              )
              .eq("id", startupId)
              .maybeSingle(),
            supabaseAdmin.from("startup_members").select("user_id, role").eq("startup_id", startupId),
            supabaseAdmin.from("startup_xp_events").select("xp").eq("startup_id", startupId),
            supabaseAdmin.from("startup_badges").select("code, created_at").eq("startup_id", startupId),
          ]);

        const memberRows = (members ?? []) as Array<{ user_id: string; role: string | null }>;
        const ownerId = (startup as { owner_id?: string } | null)?.owner_id;
        const ids = Array.from(new Set([ownerId, ...memberRows.map((m) => m.user_id)].filter(Boolean)));
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, headline")
          .in("id", ids.length ? ids : [NIL]);
        const byId = new Map(
          ((profiles ?? []) as Array<{ id: string; full_name: string | null; headline: string | null }>).map(
            (p) => [p.id, p],
          ),
        );

        return {
          startup,
          totalXp: ((xpRows ?? []) as Array<{ xp: number }>).reduce((s, r) => s + (r.xp ?? 0), 0),
          badges: badges ?? [],
          team: ids.map((id) => ({
            name: byId.get(id as string)?.full_name ?? "Team member",
            headline: byId.get(id as string)?.headline ?? null,
            role: id === ownerId ? "Founder" : memberRows.find((m) => m.user_id === id)?.role ?? "Member",
          })),
        };
      },
    }),

    weekly_updates: tool({
      description:
        "The startup's published weekly updates, newest first, with the week, written summary and full transcript. Use it for weekly reflection, accountability and storytelling.",
      inputSchema: z.object({ limit: z.number().nullable() }),
      execute: async ({ limit }: { limit: number | null }) => {
        const { data } = await supabaseAdmin
          .from("weekly_updates")
          .select("id, week_of, summary, transcript, published_at")
          .eq("startup_id", startupId)
          .eq("is_published", true)
          .order("week_of", { ascending: false })
          .limit(Math.min(Math.max(limit ?? 12, 1), 40));
        return { updates: data ?? [] };
      },
    }),

    weekly_goals: tool({
      description:
        "Weekly goals the team set, with status (pending, done, carried_over, dropped) and the week they belong to. Use it to hold the founder accountable to past commitments.",
      inputSchema: z.object({ limit: z.number().nullable() }),
      execute: async ({ limit }: { limit: number | null }) => {
        const { data } = await supabaseAdmin
          .from("startup_weekly_goals")
          .select("id, week_of, title, status, source_label, program_kpi_id")
          .eq("startup_id", startupId)
          .order("week_of", { ascending: false })
          .limit(Math.min(Math.max(limit ?? 60, 1), 150));
        return { goals: data ?? [] };
      },
    }),

    tracked_metrics: tool({
      description:
        "The numbers this startup tracks each week (their chosen tracked questions) as time series, e.g. customers talked to, MRR, users. Use it to detect trends and important changes.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: tracked }, { data: points }] = await Promise.all([
          supabaseAdmin
            .from("startup_tracked_questions")
            .select("slot, question")
            .eq("startup_id", startupId)
            .order("slot", { ascending: true }),
          supabaseAdmin
            .from("weekly_customer_conversations")
            .select("week_of, customers_talked_to, question, slot")
            .eq("startup_id", startupId),
        ]);
        const rows = (points ?? []) as Array<{
          week_of: string;
          customers_talked_to: number;
          slot: number;
        }>;
        return {
          series: ((tracked ?? []) as Array<{ slot: number; question: string }>).map((t) => ({
            slot: t.slot,
            question: t.question,
            points: rows
              .filter((r) => r.slot === t.slot)
              .sort((a, b) => a.week_of.localeCompare(b.week_of))
              .map((r) => ({ weekOf: r.week_of, value: r.customers_talked_to ?? 0 })),
          })),
        };
      },
    }),

    program_challenges: tool({
      description:
        "Challenges the accelerator assigned to this startup: title, description, target, unit, due date, completeness percentage, review state (pending/approved/declined/postponed), feedback from the program leads (postpone reasons and new deadlines) and every submission including notes and attached proof files.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: assignments } = await supabaseAdmin
          .from("program_kpi_assignments")
          .select(
            "id, current_value, completed_at, due_date_override, postpone_reason, postponed_at, declined_at, program_kpis(id, title, description, target_value, unit, due_date)",
          )
          .eq("startup_id", startupId)
          .eq("program_id", programId);
        const rows = (assignments ?? []) as unknown as Array<{
          id: string;
          current_value: number | null;
          completed_at: string | null;
          program_kpis?: { target_value: number | null } | null;
        }>;
        const { data: entries } = await supabaseAdmin
          .from("program_kpi_entries")
          .select(
            "id, assignment_id, value, note, proof_file_name, submitted_for_check, review_status, reviewed_at, recorded_by_label, created_at",
          )
          .in("assignment_id", rows.length ? rows.map((r) => r.id) : [NIL])
          .order("created_at", { ascending: false })
          .limit(120);
        const challenges = rows.map((a) => {
          const target = Number(a.program_kpis?.target_value ?? 0);
          const current = Number(a.current_value ?? 0);
          return {
            ...a,
            completeness_pct:
              target > 0
                ? Math.min(100, Math.round((current / target) * 100))
                : a.completed_at
                  ? 100
                  : 0,
          };
        });
        return { challenges, submissions: entries ?? [] };
      },
    }),

    program_comms: tool({
      description:
        "Announcements and upcoming events published by the accelerator to this program, plus the program's name and description. Use it to turn accelerator input into concrete actions.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: program }, { data: announcements }, { data: events }] = await Promise.all([
          supabaseAdmin
            .from("programs")
            .select("name, description")
            .eq("id", programId)
            .maybeSingle(),
          supabaseAdmin
            .from("program_announcements")
            .select("title, body, is_pinned, published_at")
            .eq("program_id", programId)
            .order("published_at", { ascending: false })
            .limit(20),
          supabaseAdmin
            .from("program_events")
            .select("title, description, starts_at, location, url")
            .eq("program_id", programId)
            .order("starts_at", { ascending: true })
            .limit(20),
        ]);
        return { program, announcements: announcements ?? [], events: events ?? [] };
      },
    }),

    public_startup_search: tool({
      description:
        "Search publicly published startup profiles on Ventura for competitive analysis, benchmarking, market mapping and examples. Returns public fields only; never exposes private startup data.",
      inputSchema: z.object({
        query: z.string().optional().describe("Free-text keyword, e.g. 'SaaS HR', 'climate', 'fintech Helsinki'"),
        industry: z.string().optional().describe("Filter by industry"),
        stage: z.string().optional().describe("Filter by stage, e.g. 'MVP Launched', 'Early Traction'"),
        location: z.string().optional().describe("Filter by city or country"),
        limit: z.number().nullable().optional().describe("Max results, default 10, cap 20"),
      }),
      execute: async ({
        query,
        industry,
        stage,
        location,
        limit,
      }: {
        query?: string;
        industry?: string;
        stage?: string;
        location?: string;
        limit?: number | null;
      }) => {
        const q = (query ?? "").trim().toLowerCase();
        let base = supabaseAdmin
          .from("startups")
          .select(
            "id, name, slug, tagline, one_liner, description, industry, stage, location, country, logo_url, industry_tags, business_model_tags, accelerator, published_at",
          )
          .eq("is_published", true)
          .eq("hidden_from_discovery", false)
          .eq("is_paused", false);

        if (q) {
          base = base.or(
            `name.ilike.%${q}%,tagline.ilike.%${q}%,one_liner.ilike.%${q}%,description.ilike.%${q}%,industry.ilike.%${q}%`,
          );
        }
        if (industry) base = base.ilike("industry", `%${industry}%`);
        if (stage) base = base.ilike("stage", `%${stage}%`);
        if (location) base = base.or(`location.ilike.%${location}%,country.ilike.%${location}%`);

        const { data } = await base
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(Math.min(Math.max(limit ?? 10, 1), 20));
        return { startups: data ?? [] };
      },
    }),

    public_startup_profile: tool({
      description:
        "Fetch the full public profile of a single startup by its slug (the URL-friendly name). Use it to study a competitor, comparable or example in detail.",
      inputSchema: z.object({
        slug: z.string().describe("The startup's public URL slug, e.g. 'acme-inc'"),
      }),
      execute: async ({ slug }: { slug: string }) => {
        const { data: startup } = await supabaseAdmin
          .from("startups")
          .select(PUBLIC_STARTUP_COLUMNS)
          .eq("slug", slug)
          .eq("is_published", true)
          .maybeSingle();
        if (!startup) return { startup: null };

        const startupId = (startup as { id: string }).id;
        const ownerId = (startup as { owner_id: string }).owner_id;
        const [{ data: owner }, { data: members }, { data: latestUpdate }] = await Promise.all([
          supabaseAdmin.from("profiles").select("id, full_name, headline, avatar_url").eq("id", ownerId).maybeSingle(),
          supabaseAdmin
            .from("startup_members")
            .select("user_id, role, title")
            .eq("startup_id", startupId)
            .order("created_at", { ascending: true }),
          supabaseAdmin
            .from("weekly_updates")
            .select("id")
            .eq("startup_id", startupId)
            .eq("is_published", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        let progressionCards: Array<{
          id: string;
          label: string;
          value: string | null;
          icon_name: string | null;
          image_url: string | null;
          description: string | null;
        }> = [];
        if (latestUpdate) {
          const { data: cards } = await supabaseAdmin
            .from("startup_progression_cards")
            .select("id, label, value, icon_name, image_url, description, display_order")
            .eq("startup_id", startupId)
            .eq("weekly_update_id", (latestUpdate as { id: string }).id)
            .eq("is_public", true)
            .order("display_order", { ascending: true });
          progressionCards = (cards ?? []) as typeof progressionCards;
        }

        return { startup, owner, members: members ?? [], progressionCards };
      },
    }),

    recommended_resources: tool({
      description:
        "The materials Ventura AI recommended to this startup this week (videos, templates, legal docs, guides).",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabaseAdmin
          .from("startup_ai_resources")
          .select("title, description, url, kind, source_label, week_of")
          .eq("startup_id", startupId)
          .order("week_of", { ascending: false })
          .limit(24);
        return { resources: data ?? [] };
      },
    }),
  };
}

export function founderAiSystemPrompt(opts: {
  startupName: string;
  programName: string;
  today: string;
}) {
  return `You are the Ventura AI co-founder for the startup "${opts.startupName}", which is part of the "${opts.programName}" accelerator program. Today is ${opts.today}.

You talk to the founders themselves. You are a sharp, honest co-founder — not a cheerleader.

What you see: this startup's own data (profile, weekly updates, weekly goals, tracked
numbers, XP and badges), the program content addressed to them (challenges, announcements,
events, recommended resources), AND any other startup's public profile on Ventura for
competitive analysis, benchmarking and examples. You never see private data of other startups
(such as their weekly updates, goals, messages, or non-public fields). Never claim otherwise.

What you help with:
- Weekly reflection: read the newest weekly update, compare with previous weeks, name progress,
  stagnation and new problems.
- Priorities: say plainly "these are the 3 things to focus on this week".
- Accountability: remember commitments — "last week you said you'd talk to 20 customers, the data
  shows 7". Call out dropped or repeatedly carried-over goals.
- Strategy: challenge positioning, ICP, business model, pricing and go-to-market assumptions.
- Fundraising: assess readiness, flag which metrics need work, draft investor updates and meeting briefs.
- Pitch improvement: sharpen the pitch based on progress and traction.
- Metrics: detect meaningful changes in the tracked numbers (MRR, users, retention, pilots,
  conversion, burn, runway) and explain what they mean.
- Experiments: propose concrete tests — "try these three acquisition experiments this week".
- Customer discovery: generate interview questions and analyse notes or transcripts they paste.
- Competitive intelligence and differentiation: use public_startup_search and public_startup_profile
  to compare with published startups in the same space.
- Decision memory: record and recall WHY decisions were made, based on past updates.
- Team management: track responsibilities, bottlenecks and unresolved tasks between founders.
- Accelerator support: turn challenges, announcements and mentor feedback into actions and follow up.
- Founder preparation: prep them for investor, mentor, customer and accelerator meetings.
- Storytelling: turn months of updates into a compelling story of the startup's evolution.

How to work:
- Call tools before answering anything factual. Start with startup_profile and weekly_updates,
  then pull goals, metrics, challenges, program content or public startup data as needed.
- For competitive questions ("who else is building this?", "how do we compare?", "what do our
  competitors say?"), use public_startup_search first, then public_startup_profile for detail.
- Ground every claim in the data: cite weeks, numbers and deltas. If data is missing, say so and
  say what they should start logging.
- Be concise and direct. Short markdown: bold labels, tight bullet lists. No filler preamble,
  no generic startup advice that ignores their data.
- End substantial answers with a short "Do this week" list of 2-4 concrete actions.
- If the ask is genuinely ambiguous, ask at most 2 short clarifying questions instead of guessing.

Mentor and investor matching lives elsewhere: if they ask you to find a mentor, an advisor, an
investor or an intro, do NOT try to name people here. Tell them to open the "Investor & Mentor
matching" block further down this program hub page and press "I got a new problem / need a new
mentor" (or "Find matching investors" for investors) — that starts the guided matching
session that can actually search and save matches.

You cannot change any data, send messages, or submit anything on their behalf. If they ask for
that, tell them where to do it in the Ventura program hub.`;
}
