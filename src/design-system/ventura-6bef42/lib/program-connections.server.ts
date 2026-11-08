import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type ConnectionKind = "mentor" | "investor";

export const addConnectionSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["mentor", "investor"]),
  linkedinUrl: z.string().trim().min(3).max(500),
});

export const matchCohortSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["mentor", "investor"]),
});

const assignmentsSchema = z.object({
  assignments: z.array(
    z.object({
      startup_id: z.string(),
      connection_id: z.string(),
      points: z.array(z.string()),
      reason: z.string(),
    }),
  ),
});

export const NO_STARTUPS = "NO_COHORT_STARTUPS";

/** Compact per-startup context (profile + goals + recent updates) for matching prompts. */
export async function buildCohortContext(supabaseAdmin: SB, startupIds: string[]) {
  if (!startupIds.length) return [];
  const [{ data: startups }, { data: updates }, { data: goals }] = await Promise.all([
    supabaseAdmin
      .from("startups")
      .select(
        "id, name, logo_url, stage, tagline, one_liner, description, problem, solution, market, customers_and_users, competitive_advantage, traction, looking_for, industry, industry_tags, business_model_tags, location, country",
      )
      .in("id", startupIds),
    supabaseAdmin
      .from("weekly_updates")
      .select("startup_id, summary, week_of")
      .in("startup_id", startupIds)
      .order("week_of", { ascending: false })
      .limit(150),
    supabaseAdmin
      .from("startup_weekly_goals")
      .select("startup_id, title, status, week_of")
      .in("startup_id", startupIds)
      .order("week_of", { ascending: false })
      .limit(250),
  ]);

  const updateRows = (updates ?? []) as Array<{
    startup_id: string;
    summary: string | null;
    week_of: string | null;
  }>;
  const goalRows = (goals ?? []) as Array<{
    startup_id: string;
    title: string | null;
    status: string | null;
    week_of: string | null;
  }>;

  return ((startups ?? []) as Array<Record<string, unknown> & { id: string }>).map((startup) => ({
    ...startup,
    recent_updates: updateRows
      .filter((u) => u.startup_id === startup.id)
      .slice(0, 3)
      .map((u) => ({ week_of: u.week_of, summary: (u.summary ?? "").slice(0, 700) })),
    recent_goals: goalRows
      .filter((g) => g.startup_id === startup.id)
      .slice(0, 8)
      .map((g) => ({ title: g.title, status: g.status, week_of: g.week_of })),
  }));
}

export async function addProgramConnection(data: z.infer<typeof addConnectionSchema>) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const { researchLinkedInPerson } = await import("@/design-system/ventura-6bef42/lib/program-people.server");
  const programId = await requireProgram(data.slug);

  const person = await researchLinkedInPerson(data.linkedinUrl, data.kind);
  const admin = supabaseAdmin as SB;

  const { data: existing } = await admin
    .from("program_connections")
    .select("id")
    .eq("program_id", programId)
    .eq("kind", data.kind)
    .ilike("linkedin_url", person.linkedin_url)
    .maybeSingle();
  if (existing) throw new Error("This person is already in your connections.");

  const { data: row, error } = await admin
    .from("program_connections")
    .insert({
      program_id: programId,
      kind: data.kind,
      name: person.name,
      headline: person.headline || null,
      photo_url: person.photo_url || null,
      linkedin_url: person.linkedin_url,
      expertise: person.expertise,
      location: person.location || null,
      summary: person.summary || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: row.id as string, person };
}

export async function deleteProgramConnection(slug: string, id: string) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const programId = await requireProgram(slug);
  const { error } = await (supabaseAdmin as SB)
    .from("program_connections")
    .delete()
    .eq("program_id", programId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Distributes every saved connection of one kind across the cohort so each
 * startup gets at least one, and each person as few startups as possible.
 */
export async function matchCohortConnections(data: z.infer<typeof matchCohortSchema>) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const { streamText, Output } = await import("ai");
  const { createLovableResponsesProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");

  const programId = await requireProgram(data.slug);
  const admin = supabaseAdmin as SB;
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const [{ data: members }, { data: connections }] = await Promise.all([
    admin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("status", "approved"),
    admin
      .from("program_connections")
      .select("id, name, headline, expertise, location, summary")
      .eq("program_id", programId)
      .eq("kind", data.kind),
  ]);

  const startupIds = ((members ?? []) as Array<{ startup_id: string }>).map((m) => m.startup_id);
  if (!startupIds.length) throw new Error(NO_STARTUPS);
  const people = (connections ?? []) as Array<{
    id: string;
    name: string;
    headline: string | null;
    expertise: string[] | null;
    location: string | null;
    summary: string | null;
  }>;
  if (!people.length) throw new Error(`Add at least one ${data.kind} first.`);

  const cohort = await buildCohortContext(admin, startupIds);
  const maxPerPerson = Math.max(1, Math.ceil(startupIds.length / people.length));

  const provider = createLovableResponsesProvider(apiKey);
  const result = streamText({
    model: provider.responses("openai/gpt-5.6-sol"),
    system: `You allocate ${data.kind}s to startups in an accelerator cohort.
Rules:
- Return exactly one assignment per startup — every startup must appear once.
- Spread the ${data.kind}s: no person should take more than ${maxPerPerson} startups unless unavoidable.
- Base the fit on domain, stage, business model, go-to-market needs, current goals and recent weekly updates.
- points: 3-5 short "Label — specifics" bullets naming concrete overlaps. reason: one or two sentences.
- Use only the supplied ids.`,
    prompt: JSON.stringify({ people, cohort }),
    output: Output.object({ schema: assignmentsSchema }),
    providerOptions: { openai: { store: false } },
  });

  const parsed = (await result.output) as z.infer<typeof assignmentsSchema>;
  const peopleIds = new Set(people.map((p) => p.id));
  const byStartup = new Map<string, { connection_id: string; points: string[]; reason: string }>();
  for (const a of parsed.assignments) {
    if (!startupIds.includes(a.startup_id) || !peopleIds.has(a.connection_id)) continue;
    if (byStartup.has(a.startup_id)) continue;
    byStartup.set(a.startup_id, {
      connection_id: a.connection_id,
      points: (a.points ?? [])
        .map((p) => p.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 5),
      reason: (a.reason ?? "").trim(),
    });
  }
  // Round-robin fallback for any startup the model skipped.
  let cursor = 0;
  for (const startupId of startupIds) {
    if (byStartup.has(startupId)) continue;
    byStartup.set(startupId, {
      connection_id: people[cursor % people.length].id,
      points: [],
      reason: "Assigned to make sure every startup has a contact.",
    });
    cursor += 1;
  }

  // A fresh cohort re-match replaces every previous distribution of this kind,
  // including the ones founders produced through their own AI matching.
  await admin
    .from("program_connection_matches")
    .delete()
    .eq("program_id", programId)
    .eq("kind", data.kind)
    .in("source", ["lead", "founder"]);


  const rows = Array.from(byStartup.entries()).map(([startupId, value]) => ({
    program_id: programId,
    connection_id: value.connection_id,
    startup_id: startupId,
    kind: data.kind,
    points: value.points,
    reason: value.reason,
    source: "lead",
  }));
  const { error } = await admin.from("program_connection_matches").insert(rows);
  if (error) throw new Error(error.message);

  if (data.kind === "mentor") {
    const nameById = new Map(people.map((p) => [p.id, p.name] as const));
    await Promise.all(
      rows.map((row) =>
        admin
          .from("program_startups")
          .update({ coach_id: null, coach_name: nameById.get(row.connection_id) ?? null })
          .eq("program_id", programId)
          .eq("startup_id", row.startup_id),
      ),
    );
  }

  return { matched: rows.length };
}

export async function listProgramConnectionsData(supabaseAdmin: SB, programId: string) {
  const [{ data: connections }, { data: matches }, { data: requests }] = await Promise.all([
    supabaseAdmin
      .from("program_connections")
      .select("id, kind, name, headline, photo_url, linkedin_url, expertise, location, summary")
      .eq("program_id", programId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("program_connection_matches")
      .select("id, connection_id, startup_id, kind, points, reason, source")
      .eq("program_id", programId),
    supabaseAdmin
      .from("program_connection_requests")
      .select("id, startup_id, connection_id, kind, note, status, created_at")
      .eq("program_id", programId)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);
  return {
    connections: connections ?? [],
    matches: matches ?? [],
    requests: requests ?? [],
  };
}

export async function resolveConnectionRequest(slug: string, id: string) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const programId = await requireProgram(slug);
  const { error } = await (supabaseAdmin as SB)
    .from("program_connection_requests")
    .update({ status: "done" })
    .eq("program_id", programId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
