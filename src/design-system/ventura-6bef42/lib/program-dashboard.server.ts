import { computeCurrentWeekBounds } from "@/design-system/ventura-6bef42/lib/week-bounds";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type ActivityStatus = "active" | "at_risk" | "inactive";

export type PortfolioStartup = {
  startupId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  oneLiner: string | null;
  stage: string | null;
  industry: string | null;
  founderName: string | null;
  teamNames: string[];
  founderEmail: string | null;

  coachName: string | null;
  latestUpdateWeek: string | null;
  latestUpdateSummary: string | null;
  totalXp: number;
  /** XP earned since the program's cohort start date (falls back to all-time). */
  cohortXp: number;
  cohortStartDate: string | null;
  status: ActivityStatus;
  postedThisWeek: boolean;
  currentWeekStart: string | null;
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00Z").getTime();
  return Math.floor((Date.now() - then) / 86400000);
}

function activityStatus(latestWeek: string | null): ActivityStatus {
  const d = daysSince(latestWeek);
  if (d === null) return "inactive";
  if (d <= 10) return "active";
  if (d <= 21) return "at_risk";
  return "inactive";
}

export async function loadPortfolio(
  supabaseAdmin: SB,
  programId: string,
  status: "approved" | "pending" | "declined" = "approved",
): Promise<PortfolioStartup[]> {
  const { data: members } = await supabaseAdmin
    .from("program_startups")
    .select("startup_id, coach_name, status, created_at")
    .eq("program_id", programId)
    .eq("status", status);

  const rows = (members ?? []) as Array<{
    startup_id: string;
    coach_name: string | null;
  }>;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.startup_id);

  const [{ data: startups }, { data: updates }, { data: xp }] = await Promise.all([
    supabaseAdmin
      .from("startups")
      .select("id, name, slug, logo_url, one_liner, tagline, stage, industry, owner_id, published_at")
      .in("id", ids),
    supabaseAdmin
      .from("weekly_updates")
      .select("startup_id, week_of, summary, transcript, published_at")
      .in("startup_id", ids)
      .eq("is_published", true)
      .order("week_of", { ascending: false }),
    supabaseAdmin
      .from("startup_xp_events")
      .select("startup_id, xp, created_at, kind")
      .in("startup_id", ids),
  ]);

  const { data: programRow } = await supabaseAdmin
    .from("programs")
    .select("cohort_start_date")
    .eq("id", programId)
    .maybeSingle();
  const cohortStartDate = (programRow as { cohort_start_date: string | null } | null)
    ?.cohort_start_date ?? null;
  const cohortStartMs = cohortStartDate ? Date.parse(`${cohortStartDate}T00:00:00Z`) : null;

  const startupRows = (startups ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    one_liner: string | null;
    tagline: string | null;
    stage: string | null;
    industry: string | null;
    owner_id: string;
    published_at: string | null;
  }>;

  const ownerIds = Array.from(new Set(startupRows.map((s) => s.owner_id)));
  const startupIdList = startupRows.map((s) => s.id);
  const { data: memberRows } = await supabaseAdmin
    .from("startup_members")
    .select("startup_id, user_id")
    .in("startup_id", startupIdList.length ? startupIdList : ["00000000-0000-0000-0000-000000000000"]);
  const teamMembers = (memberRows ?? []) as Array<{ startup_id: string; user_id: string }>;
  const peopleIds = Array.from(new Set([...ownerIds, ...teamMembers.map((m) => m.user_id)]));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", peopleIds.length ? peopleIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameByOwner = new Map<string, string | null>();
  for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
    nameByOwner.set(p.id, p.full_name);
  }
  const teamByStartup = new Map<string, string[]>();
  for (const s of startupRows) {
    const ids = [s.owner_id, ...teamMembers.filter((m) => m.startup_id === s.id).map((m) => m.user_id)];
    const names: string[] = [];
    for (const id of Array.from(new Set(ids))) {
      const n = nameByOwner.get(id);
      if (n && !names.includes(n)) names.push(n);
    }
    teamByStartup.set(s.id, names);
  }



  const latest = new Map<string, { week_of: string; summary: string | null; transcript: string | null }>();
  const weeksByStartup = new Map<string, Set<string>>();
  for (const u of (updates ?? []) as Array<{
    startup_id: string;
    week_of: string;
    summary: string | null;
    transcript: string | null;
  }>) {
    if (!latest.has(u.startup_id)) latest.set(u.startup_id, u);
    const set = weeksByStartup.get(u.startup_id) ?? new Set<string>();
    set.add(u.week_of);
    weeksByStartup.set(u.startup_id, set);
  }

  const xpByStartup = new Map<string, number>();
  const cohortXpByStartup = new Map<string, number>();
  for (const e of (xp ?? []) as Array<{ startup_id: string; xp: number; created_at: string; kind: string }>) {
    xpByStartup.set(e.startup_id, (xpByStartup.get(e.startup_id) ?? 0) + (e.xp ?? 0));
    const inCohort =
      cohortStartMs === null || Date.parse(e.created_at) >= cohortStartMs;
    // The one-time "startup profile created" reward never counts toward program XP.
    if (inCohort && e.kind !== "startup_created") {
      cohortXpByStartup.set(
        e.startup_id,
        (cohortXpByStartup.get(e.startup_id) ?? 0) + (e.xp ?? 0),
      );
    }
  }

  const coachById = new Map(rows.map((r) => [r.startup_id, r.coach_name] as const));

  // Stable, deterministic order so cards never shuffle between refreshes.
  const orderedRows = startupRows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  return orderedRows.map((s) => {
    const last = latest.get(s.id) ?? null;
    const bounds = computeCurrentWeekBounds(s.published_at);
    const currentWeekStart = bounds?.weekStart ?? null;
    return {
      startupId: s.id,
      name: s.name,
      slug: s.slug,
      logoUrl: s.logo_url,
      oneLiner: s.one_liner ?? s.tagline ?? null,
      stage: s.stage,
      industry: s.industry,
      founderName: nameByOwner.get(s.owner_id) ?? null,
      teamNames: teamByStartup.get(s.id) ?? [],
      founderEmail: null,
      coachName: coachById.get(s.id) ?? null,
      latestUpdateWeek: last?.week_of ?? null,
      latestUpdateSummary:
        (last?.summary && last.summary.trim()) || last?.transcript?.slice(0, 240) || null,
      totalXp: xpByStartup.get(s.id) ?? 0,
      cohortXp: cohortXpByStartup.get(s.id) ?? 0,
      cohortStartDate,
      status: activityStatus(last?.week_of ?? null),
      postedThisWeek: currentWeekStart
        ? (weeksByStartup.get(s.id)?.has(currentWeekStart) ?? false)
        : false,
      currentWeekStart,
    };
  });
}

export async function loadOverview(supabaseAdmin: SB, programId: string) {
  const portfolio = await loadPortfolio(supabaseAdmin, programId, "approved");
  const pending = await loadPortfolio(supabaseAdmin, programId, "pending");

  const tracked = portfolio.filter((p) => p.currentWeekStart !== null);
  const posted = tracked.filter((p) => p.postedThisWeek);

  // Reviews: a startup's latest published update counts as reviewed once a
  // program user has opened its full weekly update.
  const withUpdates = portfolio.filter((p) => p.latestUpdateWeek !== null);
  const { data: reviewRows } = await supabaseAdmin
    .from("program_update_reviews")
    .select("startup_id, week_of")
    .eq("program_id", programId);
  const reviewed = new Set(
    ((reviewRows ?? []) as Array<{ startup_id: string; week_of: string }>).map(
      (r) => `${r.startup_id}:${r.week_of}`,
    ),
  );
  const unreviewed = withUpdates.filter(
    (p) => !reviewed.has(`${p.startupId}:${p.latestUpdateWeek}`),
  );
  const reviewedCount = withUpdates.length - unreviewed.length;

  const inactive = portfolio.filter((p) => p.status !== "active");

  // Pending challenge submissions awaiting lead review.
  const { data: assignmentRows } = await supabaseAdmin
    .from("program_kpi_assignments")
    .select("id, startup_id, kpi_id, program_kpis(title, unit)")
    .eq("program_id", programId);

  const assignmentIds = ((assignmentRows ?? []) as Array<{
    id: string;
    startup_id: string;
    kpi_id: string;
    program_kpis?: { title: string; unit: string | null } | null;
  }>).map((a) => a.id);

  const { data: pendingSubmissions } = assignmentIds.length
    ? await supabaseAdmin
        .from("program_kpi_entries")
        .select("id, assignment_id, value, created_at")
        .eq("submitted_for_check", true)
        .eq("review_status", "pending")
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const latestPendingByAssignment = new Map<
    string,
    { id: string; assignment_id: string; value: number; created_at: string }
  >();
  for (const e of (pendingSubmissions ?? []) as Array<{
    id: string;
    assignment_id: string;
    value: number;
    created_at: string;
  }>) {
    const prev = latestPendingByAssignment.get(e.assignment_id);
    if (!prev || new Date(e.created_at).getTime() > new Date(prev.created_at).getTime()) {
      latestPendingByAssignment.set(e.assignment_id, e);
    }
  }

  const assignmentById = new Map(
    ((assignmentRows ?? []) as Array<{
      id: string;
      startup_id: string;
      program_kpis?: { title: string; unit: string | null } | null;
    }>).map((a) => [a.id, a]),
  );

  const challengeSubmissions = [...latestPendingByAssignment.values()].map((e) => {
    const a = assignmentById.get(e.assignment_id);
    return {
      entryId: e.id,
      startupId: a?.startup_id ?? "",
      startupName: portfolio.find((p) => p.startupId === a?.startup_id)?.name ?? "Startup",
      challengeTitle: a?.program_kpis?.title ?? "Challenge",
      value: Number(e.value),
      unit: a?.program_kpis?.unit ?? null,
    };
  });

  const needsAttention = [
    ...challengeSubmissions.map((s) => ({
      startupId: s.startupId,
      name: s.startupName,
      status: "challenge_submission" as const,
      latestUpdateWeek: null as string | null,
      challengeTitle: s.challengeTitle,
      value: s.value,
      unit: s.unit,
      entryId: s.entryId,
    })),
    ...unreviewed.map((p) => ({
      startupId: p.startupId,
      name: p.name,
      status: "new_update" as const,
      latestUpdateWeek: p.latestUpdateWeek,
      challengeTitle: null as string | null,
      value: null as number | null,
      unit: null as string | null,
      entryId: null as string | null,
    })),
    ...inactive
      .filter((p) => !unreviewed.some((u) => u.startupId === p.startupId))
      .map((p) => ({
        startupId: p.startupId,
        name: p.name,
        status: p.status as string,
        latestUpdateWeek: p.latestUpdateWeek,
        challengeTitle: null as string | null,
        value: null as number | null,
        unit: null as string | null,
        entryId: null as string | null,
      })),
  ];

  // Founder-initiated asks: "connect us with this mentor/investor".
  const { data: requestRows } = await supabaseAdmin
    .from("program_connection_requests")
    .select("id, startup_id, connection_id, kind, created_at")
    .eq("program_id", programId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  const requests = (requestRows ?? []) as Array<{
    id: string;
    startup_id: string;
    connection_id: string;
    kind: string;
    created_at: string;
  }>;
  const { data: connectionRows } = await supabaseAdmin
    .from("program_connections")
    .select("id, name")
    .in(
      "id",
      requests.length
        ? requests.map((r) => r.connection_id)
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const connectionName = new Map(
    ((connectionRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );
  const introRequests = requests.map((r) => ({
    id: r.id,
    startupId: r.startup_id,
    startupName: portfolio.find((p) => p.startupId === r.startup_id)?.name ?? "Startup",
    personName: connectionName.get(r.connection_id) ?? "a contact",
    kind: r.kind,
  }));

  // Program-wide counter only counts XP earned in the cohort, never the startup-profile reward.
  const totalXp = portfolio.reduce((sum, p) => sum + p.cohortXp, 0);

  const milestones = tracked
    .filter((p) => !p.postedThisWeek && p.currentWeekStart)
    .map((p) => {
      const end = new Date(new Date(p.currentWeekStart! + "T00:00:00Z").getTime() + 6 * 86400000);
      return {
        startupId: p.startupId,
        name: p.name,
        label: "Weekly update due",
        dueOn: end.toISOString().slice(0, 10),
      };
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .slice(0, 6);

  return {
    startupCount: portfolio.length,
    pendingCount: pending.length,
    weeklyPosted: posted.length,
    weeklyTracked: tracked.length,
    reviewedCount,
    reviewTotal: withUpdates.length,
    notPosted: tracked
      .filter((p) => !p.postedThisWeek)
      .map((p) => ({ startupId: p.startupId, name: p.name })),
    needsAttention,
    introRequests,
    milestones,
    totalXp,
  };
}


export async function loadStartupDetail(
  supabaseAdmin: SB,
  programId: string,
  startupId: string,
) {
  const { data: membership } = await supabaseAdmin
    .from("program_startups")
    .select("id, status, coach_id, coach_name, joined_at")
    .eq("program_id", programId)
    .eq("startup_id", startupId)
    .maybeSingle();
  if (!membership) throw new Error("Not found");

  const [{ data: startup }, { data: updates }, { data: goals }, { data: notes }, { data: conv }, { data: tracked }] =
    await Promise.all([
      supabaseAdmin
        .from("startups")
        .select(
          "id, name, slug, logo_url, one_liner, tagline, description, stage, industry, location, website, pitch_deck_url, pitch_video_uid, owner_id, published_at, looking_for, traction",
        )
        .eq("id", startupId)
        .maybeSingle(),
      supabaseAdmin
        .from("weekly_updates")
        .select("id, week_of, summary, transcript, published_at, author_id")
        .eq("startup_id", startupId)
        .eq("is_published", true)
        .order("week_of", { ascending: false }),
      supabaseAdmin
        .from("startup_weekly_goals")
        .select("id, week_of, title, status, order_index")
        .eq("startup_id", startupId)
        .order("week_of", { ascending: false })
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("program_notes")
        .select("id, body, created_at")
        .eq("program_id", programId)
        .eq("startup_id", startupId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("weekly_customer_conversations")
        .select("week_of, customers_talked_to, question, slot")
        .eq("startup_id", startupId),
      supabaseAdmin
        .from("startup_tracked_questions")
        .select("slot, question")
        .eq("startup_id", startupId)
        .order("slot", { ascending: true }),
    ]);

  if (!startup) throw new Error("Not found");

  const { data: xpRows } = await supabaseAdmin
    .from("startup_xp_events")
    .select("xp")
    .eq("startup_id", startupId);
  const totalXp = ((xpRows ?? []) as Array<{ xp: number }>).reduce((s, r) => s + (r.xp ?? 0), 0);

  const trackedList = ((tracked ?? []) as Array<{ slot: number; question: string }>).map((t) => t);
  const convRows = (conv ?? []) as Array<{
    week_of: string;
    customers_talked_to: number;
    question: string | null;
    slot: number;
  }>;
  const kpiSeries = trackedList.map((t) => {
    const points = convRows
      .filter((r) => r.slot === t.slot)
      .sort((a, b) => a.week_of.localeCompare(b.week_of))
      .map((r) => ({ weekOf: r.week_of, total: r.customers_talked_to ?? 0 }));
    return { slot: t.slot, question: t.question, points };
  });

  const { data: memberRows } = await supabaseAdmin
    .from("startup_members")
    .select("user_id, role")
    .eq("startup_id", startupId);
  const memberList = (memberRows ?? []) as Array<{ user_id: string; role: string | null }>;
  const teamIds = Array.from(new Set([startup.owner_id, ...memberList.map((m) => m.user_id)]));
  const { data: teamProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url, headline")
    .in("id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileById = new Map(
    ((teamProfiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      headline: string | null;
    }>).map((p) => [p.id, p]),
  );
  const team = teamIds.map((id) => {
    const p = profileById.get(id);
    const m = memberList.find((x) => x.user_id === id);
    return {
      userId: id,
      name: p?.full_name ?? "Team member",
      avatarUrl: p?.avatar_url ?? null,
      headline: p?.headline ?? null,
      role: id === startup.owner_id ? "Founder" : m?.role ?? "Member",
    };
  });

  const coachId = (membership as { coach_id: string | null }).coach_id;
  const { data: coach } = coachId
    ? await supabaseAdmin
        .from("program_coaches")
        .select("id, name, headline, photo_url, linkedin_url, expertise, match_reason, match_points")
        .eq("id", coachId)
        .maybeSingle()
    : { data: null };

  const coachName = coach?.name ?? membership.coach_name ?? null;
  let coachLinkedInUrl = coach?.linkedin_url ?? null;
  if (!coachLinkedInUrl && coachName) {
    const { data: coachConnection } = await supabaseAdmin
      .from("program_connections")
      .select("linkedin_url")
      .eq("program_id", programId)
      .eq("kind", "mentor")
      .ilike("name", coachName)
      .maybeSingle();
    coachLinkedInUrl = (coachConnection as { linkedin_url: string | null } | null)?.linkedin_url ?? null;
  }


  return {
    membership,
    coach,
    coachLinkedInUrl,
    startup,
    totalXp,
    updates: updates ?? [],
    goals: goals ?? [],
    notes: notes ?? [],
    kpiSeries,
    team,
  };
}

