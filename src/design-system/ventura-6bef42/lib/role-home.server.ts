import { streamText } from "ai";
import { createLovableResponsesProvider } from "@/design-system/ventura-6bef42/lib/ai-gateway.server";
import type { RoleHomeRole, StartupMatch } from "@/design-system/ventura-6bef42/lib/role-home.functions";
import { isSectorAgnostic } from "@/design-system/ventura-6bef42/lib/onboarding-tags";

type Profile = Record<string, unknown>;
type Startup = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  pitch_video_uid: string | null;
  tagline: string | null;
  one_liner: string | null;
  description: string | null;
  executive_summary: string | null;
  stage: string | null;
  industry: string | null;
  industry_tags: string[] | null;
  business_model_tags: string[] | null;
  location: string | null;
  country: string | null;
  traction: string | null;
  looking_for: string | null;
  problem: string | null;
  investment_case: string | null;
  updated_at: string;
};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
const overlap = (left: string[], right: string[]) => {
  const b = right.map(norm);
  return left.filter((item) => b.some((other) => other.includes(norm(item)) || norm(item).includes(other)));
};

async function fingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// What the person says they can help with / look for, split into comparable keywords.
function helpVocabulary(role: RoleHomeRole, profile: Profile): string[] {
  const research = (profile.research ?? {}) as Record<string, unknown>;
  const researched = [
    ...asStrings(research.help_with),
    ...asStrings(research.specialisations),
    ...asStrings(research.best_fit_for),
  ];
  const stated = role === "investor"
    ? [...asStrings(profile.evaluation_priorities), ...asStrings(profile.open_to)]
    : [
        ...asStrings(profile.coaching_areas),
        ...asStrings(profile.help_types),
        ...asStrings(profile.founder_problems),
        ...asStrings(profile.audiences),
      ];
  const extra = [profile.headline, profile.bio, research.positioning]
    .map((item) => String(item ?? ""))
    .join(" ");
  return Array.from(new Set([...stated, ...researched, ...extra.split(/[,.;\n]+/)]))
    .map((item) => item.trim())
    .filter((item) => item.length >= 4 && item.length <= 60);
}

function scoreStartup(
  role: RoleHomeRole,
  profile: Profile,
  startup: Startup,
  problemSignals: string,
) {
  const profileIndustries = asStrings(profile.industries);
  const sectorAgnostic = isSectorAgnostic(profileIndustries);
  const profileStages = asStrings(profile.stages);
  const startupSectors = [startup.industry ?? "", ...(startup.industry_tags ?? [])].filter(Boolean);
  // A sector-agnostic investor has every sector in range, so sector never filters them.
  const industryHits = sectorAgnostic
    ? startupSectors
    : overlap(profileIndustries, startupSectors);
  const stageHits = overlap(profileStages, [startup.stage ?? ""]);
  const profileModels = role === "investor" ? asStrings(profile.company_types) : asStrings(profile.audiences);
  const modelHits = overlap(profileModels, startup.business_model_tags ?? []);
  const expertise = helpVocabulary(role, profile);
  const needText = norm(
    [startup.looking_for, startup.problem, startup.description, startup.executive_summary, problemSignals]
      .filter(Boolean)
      .join(" "),
  );
  const expertiseHits = Array.from(
    new Set(expertise.filter((item) => needText.includes(norm(item)))),
  );
  const profileLocations = role === "investor" ? asStrings(profile.locations) : [String(profile.location ?? "")];
  const locationHits = overlap(profileLocations, [startup.location ?? "", startup.country ?? ""]);
  const completeness = [startup.traction, startup.looking_for, startup.executive_summary].filter(Boolean).length;
  // Mentors are matched primarily on the problems a startup states vs. what the mentor can help with.
  const problemWeight = role === "investor" ? 7 : 18;
  const problemCap = role === "investor" ? 3 : 4;
  const points =
    Math.min(industryHits.length, 2) * (role === "investor" ? 14 : 8) +
    (stageHits.length ? (role === "investor" ? 20 : 10) : 0) +
    Math.min(modelHits.length, 2) * (role === "investor" ? 8 : 5) +
    Math.min(expertiseHits.length, problemCap) * problemWeight +
    (locationHits.length ? (role === "investor" ? 10 : 6) : 0) +
    completeness * 2;
  const score = Math.max(12, Math.min(96, points));
  const reasons = [
    expertiseHits.length
      ? `They need help with ${expertiseHits.slice(0, 2).join(" and ")} — exactly what you offer`
      : null,
    sectorAgnostic
      ? (startup.industry ? `Open to every sector — ${startup.industry} fits` : "Open to every sector")
      : industryHits.length
        ? `Strong ${industryHits.slice(0, 2).join(" and ")} sector alignment`
        : null,
    stageHits.length ? `Fits your ${startup.stage ?? "preferred"} stage focus` : null,
    startup.problem ? `Their core problem: ${startup.problem.slice(0, 120)}` : null,
    modelHits.length ? `Business model matches your preferred company types` : null,
    locationHits.length ? `Geography fits your stated coverage` : null,
    startup.looking_for ? `Currently looking for ${startup.looking_for}` : null,
  ].filter((item): item is string => Boolean(item));
  return { score, reasons: reasons.slice(0, 3), problemSignals, expertiseHits };

}

function extractJson(text: string): Array<{ startupId: string; score: number | null; reasons: string[] }> | null {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const value = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(value)) return null;
    return value
      .filter((item): item is { startupId: string; score?: unknown; reasons?: unknown } =>
        Boolean(item && typeof item === "object" && typeof (item as { startupId?: unknown }).startupId === "string"),
      )
      .map((item) => {
        const raw = Number(item.score);
        const score = Number.isFinite(raw) ? Math.max(5, Math.min(99, Math.round(raw))) : null;
        return { startupId: item.startupId, score, reasons: asStrings(item.reasons).slice(0, 3) };
      });
  } catch {
    return null;
  }
}

async function aiRerank(
  role: RoleHomeRole,
  profile: Profile,
  candidates: Array<Startup & { score: number; reasons: string[]; problemSignals: string; expertiseHits: string[] }>,
) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || candidates.length < 2) return candidates.slice(0, 3);
  const provider = createLovableResponsesProvider(key);
  const compact = candidates.slice(0, 12).map((item) => ({
    startupId: item.id, name: item.name, stage: item.stage, sectors: item.industry_tags,
    businessModels: item.business_model_tags, location: [item.location, item.country].filter(Boolean).join(", "),
    summary: item.executive_summary || item.description || item.one_liner, traction: item.traction,
    lookingFor: item.looking_for, statedProblem: item.problem,
    currentStruggles: item.problemSignals.slice(0, 1200),
    matchedHelpAreas: item.expertiseHits.slice(0, 5),
    baselineScore: item.score,
  }));
  const helpAreas = helpVocabulary(role, profile).slice(0, 30);
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: `You rank startup matches for a ${role}. Return only a JSON array with exactly three objects: {"startupId":"uuid","score":0-100,"reasons":["short specific reason","short specific reason"]}. THE PRIMARY RANKING CRITERION is the fit between the problems this startup states or clearly faces (statedProblem, lookingFor, currentStruggles from their recent weekly updates and open goals, summary) and what this ${role} says they can help with (helpAreas below, plus their profile). Sector, stage, geography and traction are secondary tie-breakers only. Infer likely problems from stage and context when they are not stated, but never invent facts. Each reason is read BY the ${role} themselves on their own dashboard, so write every reason in second person addressed to them ("matches your expertise", "fits your focus") — never third person ("his", "her", "their", "the investor's", "the mentor's"). At least one reason per startup must name the concrete problem or need you matched. "score" is your honest percentage fit: 85-99 only when their pressing problems map directly onto this person's help areas; 60-84 solid fit with gaps; 35-59 partial fit; below 35 weak fit. Scores must differ between the three startups unless the evidence is genuinely identical, and must never all be the same number. Do not copy baselineScore. Use only supplied facts.`,
      prompt: `Role profile:\n${JSON.stringify(profile)}\n\nWhat this ${role} can help with:\n${JSON.stringify(helpAreas)}\n\nCandidate startups:\n${JSON.stringify(compact)}`,

      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "concise", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const ranked = extractJson(await result.text);
    if (!ranked?.length) return candidates.slice(0, 3);
    const byId = new Map(candidates.map((item) => [item.id, item]));
    const mapped = ranked.map((item) => {
      const startup = byId.get(item.startupId);
      return startup
        ? { ...startup, score: item.score ?? startup.score, reasons: item.reasons.length ? item.reasons : startup.reasons }
        : null;
    }).filter((item): item is (typeof candidates)[number] => Boolean(item)).slice(0, 3);
    // If the model returned identical scores, fall back to the deterministic spread.
    const unique = new Set(mapped.map((item) => item.score));
    if (mapped.length > 1 && unique.size === 1) {
      return mapped.map((item) => ({ ...item, score: byId.get(item.id)?.score ?? item.score }));
    }
    return mapped.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("[role-home] AI reranking fell back to deterministic ranking", error);
    return candidates.slice(0, 3);
  }
}

export const SHUFFLE_DAILY_LIMIT = 5;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadRoleHome(userId: string, role: RoleHomeRole, shuffle: boolean) {
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const profileTable = role === "investor" ? "investor_profiles" : "coach_profiles";
  const [{ data: profile }, { data: research }, { data: startups }, { data: savedRows }, { data: shuffleRow }] = await Promise.all([
    supabaseAdmin.from(profileTable).select("*").eq("user_id", userId).maybeSingle(),
    role === "investor"
      ? supabaseAdmin.from("investor_research").select("*").eq("user_id", userId).maybeSingle()
      : supabaseAdmin.from("coach_research").select("*").eq("user_id", userId).maybeSingle(),

    supabaseAdmin.from("startups").select("id, owner_id, name, slug, logo_url, pitch_video_uid, tagline, one_liner, description, executive_summary, stage, industry, industry_tags, business_model_tags, location, country, traction, looking_for, problem, investment_case, updated_at").eq("is_published", true).eq("hidden_from_discovery", false).eq("is_paused", false).limit(200),
    supabaseAdmin.from("saves").select("startup_id").eq("user_id", userId),
    supabaseAdmin.from("role_home_shuffle_state").select("*").eq("user_id", userId).eq("role", role).maybeSingle(),
  ]);
  const day = today();
  const sameDay = shuffleRow?.shuffle_date === day;
  const usedToday = sameDay ? (shuffleRow?.uses ?? 0) : 0;
  let excluded: string[] = sameDay ? ((shuffleRow?.excluded_startup_ids ?? []) as string[]) : [];
  let shufflesLeft = Math.max(0, SHUFFLE_DAILY_LIMIT - usedToday);

  if (!profile || !profile.completed_at) {
    return { profileComplete: false, role, matches: [] as StartupMatch[], generatedAt: null, shufflesLeft, shuffleLimit: SHUFFLE_DAILY_LIMIT };
  }
  if (shuffle && shufflesLeft <= 0) {
    throw new Error(`You've used all ${SHUFFLE_DAILY_LIMIT} new trios for today. Come back tomorrow.`);
  }

  // Problem signals: what startups say they struggle with in recent published updates and open goals.
  const startupIds = ((startups ?? []) as Startup[]).map((item) => item.id);
  const problemSignals = new Map<string, string>();
  if (startupIds.length) {
    const [{ data: updateRows }, { data: goalRows }] = await Promise.all([
      supabaseAdmin
        .from("weekly_updates")
        .select("startup_id, title, summary, content, published_at")
        .in("startup_id", startupIds)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(400),
      supabaseAdmin
        .from("startup_weekly_goals")
        .select("startup_id, title, status, week_of")
        .in("startup_id", startupIds)
        .in("status", ["pending", "carried_over"])
        .order("week_of", { ascending: false })
        .limit(600),
    ]);
    const push = (id: string, text: string) => {
      if (!text.trim()) return;
      const current = problemSignals.get(id) ?? "";
      if (current.length > 1500) return;
      problemSignals.set(id, `${current} ${text}`.trim());
    };
    const perStartup = new Map<string, number>();
    for (const row of (updateRows ?? []) as Array<{ startup_id: string; title: string | null; summary: string | null; content: string | null }>) {
      const seen = perStartup.get(row.startup_id) ?? 0;
      if (seen >= 3) continue;
      perStartup.set(row.startup_id, seen + 1);
      push(row.startup_id, [row.title, row.summary, typeof row.content === "string" ? row.content.slice(0, 600) : ""].filter(Boolean).join(" — "));
    }
    for (const row of (goalRows ?? []) as Array<{ startup_id: string; title: string | null }>) {
      push(row.startup_id, row.title ? `Open goal: ${row.title}.` : "");
    }
  }

  const context = research ? { ...profile, research } : profile;

  const profileFingerprint = await fingerprint(context);
  const { data: existing } = await supabaseAdmin.from("role_home_matches").select("*").eq("user_id", userId).eq("role", role).order("rank");
  const stale = !existing?.length || existing.some((row) => row.profile_fingerprint !== profileFingerprint);
  let rows = existing ?? [];

  if (shuffle || stale) {
    if (shuffle) {
      excluded = Array.from(new Set([...excluded, ...(existing ?? []).map((row) => row.startup_id)]));
    }
    const all = (startups ?? []) as Startup[];
    let pool = shuffle ? all.filter((item) => !excluded.includes(item.id)) : all;
    if (shuffle && pool.length < 3) {
      // Every startup (or not enough for a full trio) has been shown today —
      // start the rotation over from the beginning, but skip the trio on screen
      // right now so the refresh always shows something new.
      const currentIds = (existing ?? []).map((row) => row.startup_id);
      excluded = currentIds;
      pool = all.filter((item) => !currentIds.includes(item.id));
      if (pool.length < 3) {
        excluded = [];
        pool = all;
      }
    }
    const scored = pool
      .map((startup) => ({ ...startup, ...scoreStartup(role, context, startup, problemSignals.get(startup.id) ?? "") }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    const reranked = await aiRerank(role, context, scored);
    const seenIds = new Set<string>();
    const selected = reranked.filter((item) => !seenIds.has(item.id) && seenIds.add(item.id));
    if (selected.length) {
      // Upsert on the (user_id, role, rank) unique key so concurrent refreshes can never duplicate a rank.
      const { data: upserted, error } = await supabaseAdmin.from("role_home_matches").upsert(selected.map((item, index) => ({
        user_id: userId, role, startup_id: item.id, rank: index + 1, score: item.score,
        reasons: item.reasons, profile_fingerprint: profileFingerprint, generated_at: new Date().toISOString(),
      })), { onConflict: "user_id,role,rank" }).select("*");
      if (error) throw new Error(error.message);
      // Drop any leftover ranks beyond the new selection.
      const keepIds = (upserted ?? []).map((row) => row.id);
      let cleanup = supabaseAdmin.from("role_home_matches").delete().eq("user_id", userId).eq("role", role);
      cleanup = keepIds.length ? cleanup.not("id", "in", `(${keepIds.join(",")})`) : cleanup;
      await cleanup;
      rows = (upserted ?? []).sort((a, b) => a.rank - b.rank);
    } else {
      await supabaseAdmin.from("role_home_matches").delete().eq("user_id", userId).eq("role", role);
      rows = [];
    }

    if (shuffle) {
      shufflesLeft = Math.max(0, shufflesLeft - 1);
      await supabaseAdmin.from("role_home_shuffle_state").upsert({
        user_id: userId, role, shuffle_date: day, uses: usedToday + 1, excluded_startup_ids: excluded,
      }, { onConflict: "user_id,role" });
    }
  }

  const startupById = new Map(((startups ?? []) as Startup[]).map((item) => [item.id, item]));
  const saved = new Set(((savedRows ?? []) as Array<{ startup_id: string }>).map((item) => item.startup_id));
  const matches: StartupMatch[] = rows.flatMap((row) => {
    const startup = startupById.get(row.startup_id);
    if (!startup) return [];
    return [{ id: row.id, startupId: startup.id, rank: row.rank, score: row.score, reasons: asStrings(row.reasons), generatedAt: row.generated_at, name: startup.name, slug: startup.slug, logoUrl: startup.logo_url, tagline: startup.tagline || startup.one_liner, stage: startup.stage, industry: startup.industry, industryTags: startup.industry_tags ?? [], businessModels: startup.business_model_tags ?? [], location: [startup.location, startup.country].filter(Boolean).join(", ") || null, ownerId: startup.owner_id, pitchVideoUid: startup.pitch_video_uid ?? null, saved: saved.has(startup.id) }];
  });
  return { profileComplete: true, role, matches, generatedAt: matches[0]?.generatedAt ?? null, shufflesLeft, shuffleLimit: SHUFFLE_DAILY_LIMIT };
}