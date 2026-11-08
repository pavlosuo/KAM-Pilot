// Server-only XP + badge awarder. Load via dynamic import from *.functions.ts.
import { XP_REWARD } from "@/design-system/ventura-6bef42/lib/xp";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function insertXpEvent(
  admin: SB,
  row: {
    startup_id: string;
    user_id: string | null;
    week_of: string | null;
    kind: string;
    xp: number;
    meta?: Record<string, unknown>;
    dedupe_key: string;
  },
): Promise<boolean> {
  const { data: prior } = await admin
    .from("startup_xp_events")
    .select("id")
    .eq("dedupe_key", row.dedupe_key)
    .maybeSingle();
  if (prior) return false;
  const { error } = await admin.from("startup_xp_events").insert(row as never);
  if (error) return false;
  return true;
}

async function grantBadgeIfNew(admin: SB, startupId: string, code: string): Promise<boolean> {
  const { data: existing } = await admin
    .from("startup_badges")
    .select("id")
    .eq("startup_id", startupId)
    .eq("code", code)
    .maybeSingle();
  if (existing) return false;
  const { error } = await admin.from("startup_badges").insert({ startup_id: startupId, code } as never);
  return !error;
}

export async function awardMetricAnswerXp(params: {
  startupId: string;
  userId: string;
  weekOf: string;
  slot: number;
}) {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  await insertXpEvent(supabaseAdmin, {
    startup_id: params.startupId,
    user_id: params.userId,
    week_of: params.weekOf,
    kind: "metric_answer",
    xp: XP_REWARD.metricAnswer,
    meta: { slot: params.slot },
    dedupe_key: `metric:${params.startupId}:${params.weekOf}:${params.userId}:${params.slot}`,
  });
}

// Progression cards: ONLY the headline (label) earns XP, once per unique headline
// per startup. Value, description, icon and image edits never award XP.
export async function awardCardHeadlineXp(params: {
  startupId: string;
  userId: string;
  weekOf: string | null;
  labels: string[];
}) {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  for (const raw of params.labels) {
    const label = raw.trim();
    if (!label) continue;
    await insertXpEvent(supabaseAdmin, {
      startup_id: params.startupId,
      user_id: params.userId,
      week_of: params.weekOf,
      kind: "card_headline",
      xp: XP_REWARD.cardHeadline,
      meta: { label },
      dedupe_key: `card_headline:${params.startupId}:${label.toLowerCase()}`,
    });
  }
}

// Called at publish time: awards text + longform + team + streak XP and related badges.
export async function awardUpdatePublishRewards(params: {
  startupId: string;
  userId: string;
  updateId: string;
  weekOf: string | null;
  summary: string | null;
  transcript: string | null;
}) {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const admin = supabaseAdmin;

  const newBadges: string[] = [];
  const grantBadge = async (code: string) => {
    const granted = await grantBadgeIfNew(admin, params.startupId, code);
    if (granted) newBadges.push(code);
  };

  const text = (params.summary ?? params.transcript ?? "").trim();
  const hasText = text.length > 0;
  const isLong = text.length >= 500;

  // Text publish XP (once per update)
  if (hasText) {
    await insertXpEvent(admin, {
      startup_id: params.startupId,
      user_id: params.userId,
      week_of: params.weekOf,
      kind: "text_update",
      xp: XP_REWARD.textUpdatePublish + (isLong ? XP_REWARD.textUpdateLong : 0),
      meta: { updateId: params.updateId, chars: text.length, longform: isLong },
      dedupe_key: `text:${params.updateId}`,
    });
  }

  // Storyteller / longform badges
  const { count: publishedCount } = await admin
    .from("weekly_updates")
    .select("id", { count: "exact", head: true })
    .eq("startup_id", params.startupId)
    .eq("is_published", true);
  if ((publishedCount ?? 0) >= 5) await grantBadge("storyteller_5");
  if ((publishedCount ?? 0) >= 25) await grantBadge("storyteller_25");

  if (isLong) {
    // Count longform lifetime by re-checking summaries
    const { data: longRows } = await admin
      .from("weekly_updates")
      .select("summary, transcript")
      .eq("startup_id", params.startupId)
      .eq("is_published", true);
    const longCount = ((longRows as { summary: string | null; transcript: string | null }[] | null) ?? [])
      .filter((r) => ((r.summary ?? r.transcript ?? "").trim().length) >= 500).length;
    if (longCount >= 5) await grantBadge("longform_5");
  }

  // Team completion: award once per (startup, week) if every team member has published this week.
  if (params.weekOf) {
    const { data: ownerRow } = await admin
      .from("startups")
      .select("owner_id")
      .eq("id", params.startupId)
      .maybeSingle();
    const ownerId = (ownerRow as { owner_id: string } | null)?.owner_id ?? null;
    const { data: memberRows } = await admin
      .from("startup_members")
      .select("user_id")
      .eq("startup_id", params.startupId);
    const memberIds = ((memberRows as { user_id: string }[] | null) ?? []).map((m) => m.user_id);
    const teamIds = new Set<string>([...(ownerId ? [ownerId] : []), ...memberIds]);

    // Additional team award: only meaningful for multi-founder teams.
    if (teamIds.size > 1) {
      const { data: pubRows } = await admin
        .from("weekly_updates")
        .select("author_id")
        .eq("startup_id", params.startupId)
        .eq("week_of", params.weekOf)
        .eq("is_published", true);
      const publishedBy = new Set(
        ((pubRows as { author_id: string }[] | null) ?? []).map((r) => r.author_id),
      );
      const allPublished = Array.from(teamIds).every((id) => publishedBy.has(id));
      if (allPublished) {
        // Single shared bonus for the startup (scaled by team size) — the XP
        // pool is startup-wide, so every co-founder sees the same total.
        await insertXpEvent(admin, {
          startup_id: params.startupId,
          user_id: null,
          week_of: params.weekOf,
          kind: "team_complete",
          xp: XP_REWARD.teamAllPublished * teamIds.size,
          meta: { teamSize: teamIds.size },
          dedupe_key: `team:${params.startupId}:${params.weekOf}`,
        });
        await grantBadge("team_player");
        // Count team-complete weeks lifetime
        const { data: teamEvents } = await admin
          .from("startup_xp_events")
          .select("week_of")
          .eq("startup_id", params.startupId)
          .eq("kind", "team_complete");
        const weeks = new Set(
          ((teamEvents as { week_of: string | null }[] | null) ?? [])
            .map((r) => r.week_of)
            .filter((v): v is string => !!v),
        );
        if (weeks.size >= 10) await grantBadge("team_ten");
      }
    }

    // Streak growth XP + badges — startup-wide: any co-founder publishing keeps
    // the shared streak alive, so all co-founders see identical numbers.
    const { data: pubWeeks } = await admin
      .from("weekly_updates")
      .select("week_of")
      .eq("startup_id", params.startupId)
      .eq("is_published", true)
      .order("week_of", { ascending: false });
    const weeksSet = new Set(
      ((pubWeeks as { week_of: string }[] | null) ?? []).map((r) => r.week_of),
    );
    let streak = 0;
    let cursor = params.weekOf;
    while (weeksSet.has(cursor)) {
      streak += 1;
      const d = new Date(cursor + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 7);
      cursor = d.toISOString().slice(0, 10);
    }
    if (streak >= 2) {
      await insertXpEvent(admin, {
        startup_id: params.startupId,
        user_id: null,
        week_of: params.weekOf,
        kind: "streak_growth",
        xp: XP_REWARD.streakGrowth,
        meta: { streak },
        dedupe_key: `streak:${params.startupId}:${streak}`,
      });
    }
    if (streak >= 4) await grantBadge("streak_4");
    if (streak >= 10) await grantBadge("streak_10");
    if (streak >= 25) await grantBadge("streak_25");
    if (streak >= 52) await grantBadge("streak_52");


    // Comeback: any 2+ week gap before this publish.
    const sortedWeeks = Array.from(weeksSet).sort();
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prev = new Date(sortedWeeks[i - 1] + "T00:00:00Z");
      const cur = new Date(sortedWeeks[i] + "T00:00:00Z");
      const diffWeeks = Math.round((cur.getTime() - prev.getTime()) / (7 * 86400_000));
      if (diffWeeks >= 3) {
        await grantBadge("comeback");
        break;
      }
    }
  }

  return { newBadges };
}

// One-time reward when a startup profile is first published.
export async function awardStartupCreatedRewards(params: {
  startupId: string;
  userId: string;
}) {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const admin = supabaseAdmin;
  await insertXpEvent(admin, {
    startup_id: params.startupId,
    user_id: params.userId,
    week_of: null,
    kind: "startup_created",
    xp: XP_REWARD.startupCreated,
    meta: {},
    dedupe_key: `startup_created:${params.startupId}`,
  });
  const granted = await grantBadgeIfNew(admin, params.startupId, "founded");
  return { newBadges: granted ? ["founded"] : [] };
}

// Awarded when a program lead approves a challenge submission.
// Deduped per assignment so re-approvals never double-pay.
export async function awardChallengeApprovedRewards(params: {
  startupId: string;
  assignmentId: string;
  userId: string | null;
  challengeTitle?: string | null;
}) {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const admin = supabaseAdmin;
  const awarded = await insertXpEvent(admin, {
    startup_id: params.startupId,
    user_id: params.userId,
    week_of: null,
    kind: "challenge_approved",
    xp: XP_REWARD.challengeApproved,
    meta: { assignmentId: params.assignmentId, title: params.challengeTitle ?? null },
    dedupe_key: `challenge_approved:${params.assignmentId}`,
  });
  const granted = await grantBadgeIfNew(admin, params.startupId, "program_challenge");
  return { xpAwarded: awarded ? XP_REWARD.challengeApproved : 0, newBadges: granted ? ["program_challenge"] : [] };
}
