import { tool } from "ai";
import { z } from "zod";
import { computeCurrentWeekBounds } from "@/design-system/ventura-6bef42/lib/week-bounds";
import { isSectorAgnostic } from "@/design-system/ventura-6bef42/lib/onboarding-tags";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type MatchKind = "mentor" | "investor";

export type MatchSource = "program" | "ventura" | "web";

export type MatchPerson = {
  id: string;
  rank: number;
  name: string;
  headline: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  reason: string | null;
  connection_id: string | null;
  intro_requested: boolean;
  from_program: boolean;
  source: MatchSource;
  ventura_handle: string | null;
};

/** Everything the founder-side matching block renders. */
export async function loadMatchBoard(supabaseAdmin: SB, startupId: string, programId: string) {
  const [{ data: suggestions }, { data: leadMatches }, { data: startup }] = await Promise.all([
    supabaseAdmin
      .from("startup_match_suggestions")
      .select(
        "id, kind, rank, name, headline, photo_url, linkedin_url, reason, connection_id, intro_requested, source, ventura_handle, created_at",
      )
      .eq("startup_id", startupId)
      .eq("program_id", programId)
      .order("rank", { ascending: true }),
    supabaseAdmin
      .from("program_connection_matches")
      .select("id, kind, connection_id, points, reason, created_at")
      .eq("startup_id", startupId)
      .eq("program_id", programId)
      .eq("source", "lead")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("startups").select("id, published_at").eq("id", startupId).maybeSingle(),
  ]);

  const leadRows = (leadMatches ?? []) as Array<{
    id: string;
    kind: MatchKind;
    connection_id: string;
    points: string[] | null;
    reason: string | null;
    created_at: string;
  }>;
  const connectionIds = leadRows.map((r) => r.connection_id);
  const { data: connections } = await supabaseAdmin
    .from("program_connections")
    .select("id, name, headline, photo_url, linkedin_url")
    .in("id", connectionIds.length ? connectionIds : ["00000000-0000-0000-0000-000000000000"]);
  const connById = new Map(
    ((connections ?? []) as Array<{
      id: string;
      name: string;
      headline: string | null;
      photo_url: string | null;
      linkedin_url: string | null;
    }>).map((c) => [c.id, c]),
  );

  const suggestionRows = (suggestions ?? []) as Array<
    Omit<MatchPerson, "from_program"> & { kind: MatchKind; created_at: string }
  >;

  const ts = (v?: string | null) => (v ? new Date(v).getTime() : 0);

  const pick = (kind: MatchKind): MatchPerson[] => {
    const own = suggestionRows
      .filter((s) => s.kind === kind)
      .map((s) => ({ ...s, from_program: !!s.connection_id }));
    const lead = leadRows.find((r) => r.kind === kind);
    const conn = lead ? connById.get(lead.connection_id) : null;
    const ownNewest = own.reduce((max, s) => Math.max(max, ts(s.created_at)), 0);
    const leadIsFresher = !!(lead && conn && ts(lead.created_at) > ownNewest);
    if (own.length && !leadIsFresher) return own.slice(0, 3);
    if (!lead || !conn) return [];

    const leadPerson: MatchPerson = {
      id: lead.id,
      rank: 1,
      name: conn.name,
      headline: conn.headline,
      photo_url: conn.photo_url,
      linkedin_url: conn.linkedin_url,
      reason: (lead.points ?? []).join("\n") || lead.reason,
      connection_id: conn.id,
      intro_requested: true, // lead already knows about their own match
      from_program: true,
      source: "program",
      ventura_handle: null,
    };

    // A fresher lead re-match only replaces the crowned slot; the founder's own
    // other two matches stay until they run the AI matching again.
    const rest = own
      .filter((s) => s.connection_id !== conn.id)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 2)
      .map((s, i) => ({ ...s, rank: i + 2 }));

    return [leadPerson, ...rest];

  };

  // Weekly update gate: an update published for the current week unlocks matching.
  const bounds = computeCurrentWeekBounds(
    (startup as { published_at?: string | null } | null)?.published_at ?? null,
  );
  let postedThisWeek = false;
  if (bounds) {
    const { count } = await supabaseAdmin
      .from("weekly_updates")
      .select("id", { count: "exact", head: true })
      .eq("startup_id", startupId)
      .eq("is_published", true)
      .gte("week_of", bounds.weekStart)
      .lte("week_of", bounds.weekEnd);
    postedThisWeek = (count ?? 0) > 0;
  }

  return { mentor: pick("mentor"), investor: pick("investor"), postedThisWeek };
}

/** The program's own network for this kind — used both as a tool result and inline in the prompt. */
export async function loadProgramConnections(supabaseAdmin: SB, programId: string, kind: MatchKind) {
  const { data } = await supabaseAdmin
    .from("program_connections")
    .select("id, name, headline, expertise, location, summary, linkedin_url, photo_url")
    .eq("program_id", programId)
    .eq("kind", kind);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    headline: string | null;
    expertise: string[] | null;
    location: string | null;
    summary: string | null;
    linkedin_url: string | null;
    photo_url: string | null;
  }>;
}

export type VenturaPerson = {
  user_id: string;
  handle: string | null;
  name: string;
  headline: string | null;
  location: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  expertise: string[];
  summary: string | null;
};

/** Ventura's own mentors / investors — the second priority tier after the program network. */
export async function loadVenturaNetwork(
  supabaseAdmin: SB,
  kind: MatchKind,
): Promise<VenturaPerson[]> {
  const table = kind === "mentor" ? "coach_profiles" : "investor_profiles";
  const columns =
    kind === "mentor"
      ? "user_id, full_name, headline, location, linkedin_url, photo_url, bio, coaching_areas, help_types, founder_problems, industries, stages"
      : "user_id, full_name, headline, location, linkedin_url, photo_url, bio, industries, stages, check_size, company_types, open_to";
  const { data } = await supabaseAdmin
    .from(table)
    .select(columns)
    .not("completed_at", "is", null)
    .limit(200);
  const rows = (data ?? []) as Array<Record<string, unknown> & { user_id: string }>;
  if (!rows.length) return [];
  const { data: profileRows } = await supabaseAdmin
    .from("profiles")
    .select("id, handle")
    .in(
      "id",
      rows.map((r) => r.user_id),
    );
  const handles = new Map(
    ((profileRows ?? []) as Array<{ id: string; handle: string | null }>).map((p) => [
      p.id,
      p.handle,
    ]),
  );
  const list = (value: unknown) => (Array.isArray(value) ? (value as string[]) : []);
  return rows.map((row) => ({
    user_id: row.user_id,
    handle: handles.get(row.user_id) ?? null,
    name: (row.full_name as string) || "Ventura member",
    headline: (row.headline as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
    photo_url: (row.photo_url as string | null) ?? null,
    expertise:
      kind === "mentor"
        ? [
            ...list(row.coaching_areas),
            ...list(row.help_types),
            ...list(row.founder_problems),
            ...list(row.industries),
            ...list(row.stages),
          ].slice(0, 20)
        : [
            ...(isSectorAgnostic(list(row.industries))
              ? ["Sector agnostic — every industry is in range"]
              : list(row.industries)),
            ...list(row.stages),
            ...list(row.company_types),
            ...list(row.open_to),
            ...(row.check_size ? [String(row.check_size)] : []),
          ].slice(0, 20),
    summary: ((row.bio as string | null) ?? "").slice(0, 600) || null,
  }));
}

/** Tools the AI uses while running a matching conversation. */
export function buildFounderMatchTools(
  supabaseAdmin: SB,
  startupId: string,
  programId: string,
  kind: MatchKind,
) {
  return {
    program_connections: tool({
      description: `The ${kind}s the accelerator has in its own network. Always check these first — a relevant one must be ranked #1.`,
      inputSchema: z.object({}),
      execute: async () => {
        const connections = await loadProgramConnections(supabaseAdmin, programId, kind);
        return { connections };
      },
    }),


    ventura_network: tool({
      description: `The ${kind}s who already have a Ventura profile. Check these SECOND, right after the program network and always before searching the web. Use the exact handle as ventura_handle when you pick one.`,
      inputSchema: z.object({}),
      execute: async () => {
        const people = await loadVenturaNetwork(supabaseAdmin, kind);
        return {
          people: people
            .filter((p) => p.handle)
            .map((p) => ({
              ventura_handle: p.handle,
              name: p.name,
              headline: p.headline,
              location: p.location,
              expertise: p.expertise,
              summary: p.summary,
              linkedin_url: p.linkedin_url,
            })),
        };
      },
    }),

    find_people: tool({
      description:
        "Search real people with LinkedIn profiles outside the program network. Prefer people close to the founder's location. Returns verified profiles only.",
      inputSchema: z.object({
        titles: z.array(z.string()).describe("Job titles to look for, e.g. ['VP Sales','Head of Growth']"),
        skills: z.array(z.string()).describe("Skills or domains, e.g. ['b2b saas','pricing']"),
        locations: z.array(z.string()).describe("Cities, regions or countries, most local first"),
      }),
      execute: async ({
        titles,
        skills,
        locations,
      }: {
        titles: string[];
        skills: string[];
        locations: string[];
      }) => {
        const { searchPdlPeople } = await import("@/design-system/ventura-6bef42/lib/program-people.server");
        const esc = (v: string) => v.replace(/'/g, "''").toLowerCase();
        const clauses: string[] = ["linkedin_url IS NOT NULL"];
        if (titles.length)
          clauses.push(`(${titles.map((t) => `job_title LIKE '%${esc(t)}%'`).join(" OR ")})`);
        if (skills.length)
          clauses.push(`(${skills.map((s) => `skills LIKE '%${esc(s)}%'`).join(" OR ")})`);
        if (locations.length)
          clauses.push(
            `(${locations.map((l) => `location_name LIKE '%${esc(l)}%'`).join(" OR ")})`,
          );
        const sql = `SELECT * FROM person WHERE ${clauses.join(" AND ")}`;
        const people = await searchPdlPeople(sql, 8);
        return {
          people: people.map((p) => ({
            name: p.full_name ?? null,
            headline: p.headline ?? p.job_title ?? null,
            company: p.job_company_name ?? null,
            location: p.location_name ?? null,
            skills: (p.skills ?? []).slice(0, 12),
            linkedin_url: p.linkedin_url
              ? p.linkedin_url.startsWith("http")
                ? p.linkedin_url
                : `https://www.${p.linkedin_url}`
              : null,
            photo_url: p.profile_pic_url ?? null,
          })),
        };
      },
    }),

    verify_linkedin_profile: tool({
      description:
        "Verify one candidate by LinkedIn URL and get their photo and role history. Use it before proposing anyone you did not get from find_people.",
      inputSchema: z.object({ linkedin_url: z.string() }),
      execute: async ({ linkedin_url }: { linkedin_url: string }) => {
        const { normalizeLinkedInUrl, fetchPdlProfile, pdlKnownData, resolvePhoto } = await import(
          "@/design-system/ventura-6bef42/lib/program-people.server"
        );
        const parsed = normalizeLinkedInUrl(linkedin_url);
        if (!parsed) return { valid: false };
        const pdl = await fetchPdlProfile(parsed.url);
        return {
          valid: !!pdl,
          linkedin_url: parsed.url,
          photo_url: resolvePhoto(parsed.handle, pdl?.full_name ?? "", pdl),
          data: pdlKnownData(pdl),
        };
      },
    }),

    save_matches: tool({
      description: `Save the final ranked ${kind}s. ALWAYS exactly 3 people, ranked 1-3. Priority order: program connections first, then Ventura network people, then people you researched on the web. Call this once, at the end, after the clarifying questions.`,

      inputSchema: z.object({
        people: z
          .array(
            z.object({
              name: z.string(),
              headline: z.string(),
              linkedin_url: z.string(),
              photo_url: z.string().nullable(),
              reason: z.string(),
              connection_id: z
                .string()
                .nullable()
                .describe("Program connection id if from the program network, else null"),
              ventura_handle: z
                .string()
                .nullable()
                .describe(
                  "Ventura profile handle from the ventura_network tool if this person is a Ventura member, else null",
                ),
            }),
          )
          .length(3, "Exactly three ranked people are required"),
      }),
      execute: async ({
        people,
      }: {
        people: Array<{
          name: string;
          headline: string;
          linkedin_url: string;
          photo_url: string | null;
          reason: string;
          connection_id: string | null;
          ventura_handle?: string | null;
        }>;
      }) => {
        if (people.length !== 3) {
          return {
            saved: false,
            error: `${people.length} ${kind}(s) supplied. Exactly 3 are required. Broaden the search and call save_matches again with 3 people.`,
          };
        }
        // At most one person may come from the program network, and only as rank 1.
        const fromNetwork = people.filter((p) => Boolean(p.connection_id));
        if (fromNetwork.length > 1 || (fromNetwork.length === 1 && !people[0]?.connection_id)) {
          return {
            saved: false,
            error: `Only ONE person may come from the program network, and they must be rank 1. You supplied ${fromNetwork.length} program connection(s). Keep the single best program ${kind} at rank 1 and use find_people to source the other two from OUTSIDE the network, then call save_matches again.`,
          };
        }
        const { normalizeLinkedInUrl, resolvePhoto, fetchPdlProfile } = await import(
          "@/design-system/ventura-6bef42/lib/program-people.server"
        );

        // No person may appear twice — same LinkedIn profile, same connection, or same name.
        const dupKey = (value: string) =>
          value
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const person of people) {
          const parsed = normalizeLinkedInUrl(person.linkedin_url);
          const keys = [
            person.connection_id ? `c:${person.connection_id}` : null,
            parsed ? `l:${dupKey(parsed.handle)}` : `l:${dupKey(person.linkedin_url)}`,
            `n:${dupKey(person.name)}`,
          ].filter(Boolean) as string[];
          if (keys.some((key) => seen.has(key))) duplicates.push(person.name);
          keys.forEach((key) => seen.add(key));
        }
        if (duplicates.length) {
          return {
            saved: false,
            error: `Duplicate ${kind}(s) supplied: ${duplicates.join(", ")}. All 3 people must be different individuals with different LinkedIn profiles. Use find_people to source distinct replacements and call save_matches again with 3 unique people.`,
          };
        }


        // Ranks 2 and 3 must be researched outside the program network. The AI
        // sometimes re-lists program people with connection_id null, so match
        // them against the real network by LinkedIn handle and by name.
        const network = await loadProgramConnections(supabaseAdmin, programId, kind);
        const networkKeys = new Map<string, string>();
        for (const c of network) {
          const parsed = c.linkedin_url ? normalizeLinkedInUrl(c.linkedin_url) : null;
          if (parsed) networkKeys.set(`l:${dupKey(parsed.handle)}`, c.name);
          networkKeys.set(`n:${dupKey(c.name)}`, c.name);
        }
        // Ventura members are a legitimate second tier — resolve the handles the
        // AI supplied against real Ventura profiles.
        const venturaList = await loadVenturaNetwork(supabaseAdmin, kind);
        const venturaByHandle = new Map(
          venturaList.filter((p) => p.handle).map((p) => [p.handle as string, p]),
        );
        const badHandles = people
          .map((p) => p.ventura_handle)
          .filter((h): h is string => Boolean(h) && !venturaByHandle.has(h as string));
        if (badHandles.length) {
          return {
            saved: false,
            error: `Unknown ventura_handle(s): ${badHandles.join(
              ", ",
            )}. Call ventura_network and copy the handle verbatim, or set ventura_handle to null.`,
          };
        }
        const venturaFor = (person: { ventura_handle?: string | null }) =>
          person.ventura_handle ? venturaByHandle.get(person.ventura_handle) ?? null : null;

        const smuggled: string[] = [];
        people.forEach((person, index) => {
          if (index === 0) return;
          if (venturaFor(person)) return;
          const parsed = normalizeLinkedInUrl(person.linkedin_url);
          const keys = [
            parsed ? `l:${dupKey(parsed.handle)}` : null,
            `n:${dupKey(person.name)}`,
          ].filter(Boolean) as string[];
          if (person.connection_id || keys.some((k) => networkKeys.has(k))) {
            smuggled.push(person.name);
          }
        });
        if (smuggled.length) {
          return {
            saved: false,
            error: `${smuggled.join(", ")} ${
              smuggled.length > 1 ? "are" : "is"
            } part of the program network but placed at rank 2/3. Only rank 1 may come from the program network. Use find_people to source ${
              smuggled.length > 1 ? "two replacements" : "a replacement"
            } from OUTSIDE the network (different people, real LinkedIn profiles from the tool result) and call save_matches again with 3 people.`,
          };
        }


        // Verify every non-network LinkedIn URL actually belongs to the person
        // the AI named, so we never hand the founder a same-name stranger.
        const norm = (v: string) =>
          v
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, " ")
            .split(/\s+/)
            .filter(Boolean);

        const verified = new Map<
          string,
          { headline: string | null; photo: string | null; url: string }
        >();
        const problems: string[] = [];

        for (const person of people) {
          if (person.connection_id || venturaFor(person)) continue;
          const parsed = normalizeLinkedInUrl(person.linkedin_url);
          if (!parsed) {
            problems.push(`${person.name}: "${person.linkedin_url}" is not a valid LinkedIn profile URL.`);
            continue;
          }
          const pdl = await fetchPdlProfile(parsed.url);
          if (!pdl) {
            problems.push(
              `${person.name}: ${parsed.url} could not be verified — no real profile found. Use find_people and take the linkedin_url straight from the tool result.`,
            );
            continue;
          }
          const claimed = norm(person.name);
          const actual = norm(pdl.full_name ?? "");
          const nameMatches =
            actual.length > 0 &&
            claimed.length > 0 &&
            claimed.filter((part) => actual.includes(part)).length >= Math.min(2, claimed.length);
          if (!nameMatches) {
            problems.push(
              `${person.name}: ${parsed.url} belongs to "${pdl.full_name ?? "someone else"}". Wrong profile — find the correct person with find_people / verify_linkedin_profile.`,
            );
            continue;
          }
          verified.set(person.linkedin_url, {
            headline: pdl.headline ?? [pdl.job_title, pdl.job_company_name].filter(Boolean).join(" at ") ?? null,
            photo: resolvePhoto(parsed.handle, pdl.full_name ?? person.name, pdl),
            url: parsed.url,
          });
        }

        if (problems.length) {
          return {
            saved: false,
            error: `LinkedIn verification failed for ${problems.length} person(s):\n- ${problems.join(
              "\n- ",
            )}\nReplace them with verified people and call save_matches again with 3 people.`,
          };
        }

        await supabaseAdmin
          .from("startup_match_suggestions")
          .delete()
          .eq("startup_id", startupId)
          .eq("program_id", programId)
          .eq("kind", kind);

        const rows = people.slice(0, 3).map((person, index) => {
          const parsed = normalizeLinkedInUrl(person.linkedin_url);
          const check = verified.get(person.linkedin_url);
          const ventura = venturaFor(person);
          return {
            program_id: programId,
            startup_id: startupId,
            kind,
            rank: index + 1,
            name: ventura?.name || person.name,
            headline: ventura?.headline || check?.headline || person.headline || null,
            photo_url:
              ventura?.photo_url ||
              check?.photo ||
              person.photo_url ||
              (parsed ? resolvePhoto(parsed.handle, person.name, null) : null),
            linkedin_url:
              ventura?.linkedin_url ?? check?.url ?? parsed?.url ?? person.linkedin_url ?? null,
            reason: person.reason || null,
            connection_id: person.connection_id || null,
            intro_requested: false,
            source: person.connection_id ? "program" : ventura ? "ventura" : "web",
            ventura_user_id: ventura?.user_id ?? null,
            ventura_handle: ventura?.handle ?? null,
          };
        });

        const { data, error } = await supabaseAdmin
          .from("startup_match_suggestions")
          .insert(rows)
          .select(
            "id, rank, name, headline, photo_url, linkedin_url, reason, connection_id, intro_requested, source, ventura_handle",
          );
        if (error) return { saved: false, error: error.message };

        // Mirror program-network picks into the lead dashboard, replacing any
        // earlier founder-side match for this startup and kind.
        await supabaseAdmin
          .from("program_connection_matches")
          .delete()
          .eq("program_id", programId)
          .eq("startup_id", startupId)
          .eq("kind", kind)
          .eq("source", "founder");
        const networkRows = rows
          .filter((r) => r.connection_id)
          .map((r) => ({
            program_id: programId,
            startup_id: startupId,
            connection_id: r.connection_id as string,
            kind,
            points: [],
            reason: r.reason,
            source: "founder",
          }));
        if (networkRows.length) {
          await supabaseAdmin.from("program_connection_matches").insert(networkRows);
        }

        return { saved: true, people: data ?? [] };

      },
    }),
  };
}

export function founderMatchSystemPrompt(opts: {
  kind: MatchKind;
  startupName: string;
  programName: string;
  founderLocation: string;
  today: string;
  connections?: Array<{
    id: string;
    name: string;
    headline: string | null;
    expertise: string[] | null;
    location: string | null;
    summary: string | null;
    linkedin_url: string | null;
  }>;
}) {
  const who = opts.kind === "mentor" ? "mentors/advisors" : "investors";
  const focus =
    opts.kind === "mentor"
      ? `Ask about the concrete problem: what exactly is stuck, what they already tried, what a good outcome looks like, and what kind of person would unblock it.`
      : `Ask only for the investor-search criteria you still need: how much they raise and what for, ticket size, angels vs VC, stage, traction, geography, timeline, and existing investors. The answers exist only to find three real people; never assess or summarize them.`;
  const search =
    opts.kind === "mentor"
      ? `Search operator titles and domain skills that match the problem.`
      : `Search investor titles (angel investor, partner, general partner, principal, investment manager, venture partner, LP-facing roles) plus fund/thesis keywords that match their stage, sector and ticket size.`;


  const list = opts.connections?.length
    ? opts.connections
        .map(
          (c) =>
            `- id: ${c.id} | ${c.name}${c.headline ? ` — ${c.headline}` : ""}${
              c.location ? ` (${c.location})` : ""
            }${c.expertise?.length ? ` | expertise: ${c.expertise.join(", ")}` : ""}${
              c.summary ? ` | ${c.summary}` : ""
            }${c.linkedin_url ? ` | ${c.linkedin_url}` : ""}`,
        )
        .join("\n")
    : `(the program has no ${who} in its network yet)`;

  return `You are Ventura's matchmaking AI, running a ${opts.kind} matching session for "${opts.startupName}" in the "${opts.programName}" program. Today is ${opts.today}. The founder is based in ${opts.founderLocation || "an unknown location"}.

The program's own ${who} (use the exact id as connection_id when you pick one):
${list}
You can re-read this list any time with the program_connections tool.

Flow — follow it strictly:
1. Silently read the startup's data first (profile, weekly updates, goals, metrics) using the reading tools. Do not dump it back at the founder.
2. Ask clarifying questions — minimum 3, maximum 5 in total. Never ask a 6th; if the picture is still imperfect after 5, proceed with what you have. ONE question per message, short, concrete. ${focus}
3. Then call program_connections and decide about the program network FIRST — this step is mandatory for both mentors and investors. AT MOST ONE person may come from the program network, and only at rank 1. If a program ${opts.kind} is good enough for the need, that single person is rank 1 — the program network wins even when someone outside looks stronger — and their connection_id must be set. Never force a program person with no relevant background, and never put a second program connection at rank 2 or 3.
4. Then call ventura_network — the ${who} who already have a Ventura profile. This is the SECOND priority tier and it is mandatory: fill every remaining slot with a relevant Ventura member before you search the web. Set their ventura_handle exactly as returned (connection_id stays null). There is no cap on Ventura people — ranks 2 and 3 may both be Ventura members. Never force someone whose background does not fit the need.
5. Only if slots remain after the program network and the Ventura network, use find_people (and verify_linkedin_profile) to fill them from the web. ${search} Search the founder's own city/region first, then widen the titles, skills and geography until you have enough people. Only people with a real LinkedIn profile can be proposed.
6. Call save_matches with EXACTLY 3 people, ranked 1-3 — never 1 or 2, always ordered program connection first, then Ventura members, then web finds. Each person carries either connection_id (program), ventura_handle (Ventura), or neither (web). If you cannot fill 3, broaden the search and try again instead of saving a shorter list.

7. After saving, reply with two short sentences telling them who to talk to first and why. Do not repeat the profiles as a list — the app renders the cards.

Hard output rules — the ONLY two things you may ever send as text are (a) a single clarifying question, or (b) the two-sentence wrap-up AFTER save_matches succeeded. Anything else is forbidden: no readiness assessment, no critique or "inconsistencies" list, no fundraising assessment, no snapshot, no summary of their answers, no advice, no plan, no bullet lists of profile facts, no "best investor profile" description. As soon as the founder answers the third question, stop asking unless a fourth or fifth answer is genuinely essential. After the final answer, your next action MUST be a tool call (find_people / program_connections), not prose. If you notice gaps or contradictions in their data, ignore them for the conversation and simply factor them into the search — never report them. A turn that ends without either a question or a completed save_matches is a failure.

Rules: never invent a person or a LinkedIn URL. Never propose someone you did not get from a tool, from the program network list above, or from ventura_network. Every LinkedIn URL must come verbatim from find_people or from verify_linkedin_profile that returned valid:true for that exact person — never guess a /in/ handle from a name, and never reuse a same-name profile whose role, company or location does not match the person you intend. Saving is blocked server-side if a URL belongs to someone else. Be concise, direct and warm. No filler preamble.`;
}

