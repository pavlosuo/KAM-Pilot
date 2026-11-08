import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { setJoinRole } from "@/design-system/ventura-6bef42/lib/join-role.functions";
import { pickActiveRole, readActiveRole, writeActiveRole } from "@/design-system/ventura-6bef42/hooks/use-auth";


export type JoinAs = "founder" | "investor" | "coach" | "accelerator";
export type AccountRole = "founder" | "investor" | "mentor" | "admin";

const KEY = "ventura:joinAs";

export function rememberJoinIntent(as: JoinAs | undefined | null) {
  if (typeof window === "undefined" || !as) return;
  try {
    localStorage.setItem(KEY, as);
  } catch {
    /* ignore */
  }
}

export function readJoinIntent(): JoinAs | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v === "investor" || v === "coach" || v === "founder" || v === "accelerator" ? v : null;
  } catch {
    return null;
  }
}

export function clearJoinIntent() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Applies a pending "join as" choice to the signed-in account, once. */
export async function applyPendingJoinRole(): Promise<void> {
  const intent = readJoinIntent();
  if (!intent || intent === "accelerator") return;
  const role = intent === "coach" ? "mentor" : intent;
  try {
    await setJoinRole({ data: { role } });
    writeActiveRole(role);
  } catch (err) {
    console.error(err);
    return;
  }
  clearJoinIntent();
}

/** Adds a role to the signed-in account and makes it the one they're acting as. */
export async function addRole(role: Exclude<AccountRole, "admin">): Promise<void> {
  await setJoinRole({ data: { role } });
  writeActiveRole(role);
}

export type RoleLandingPath =
  | "/admin"
  | "/"
  | "/investor-onboarding"
  | "/coach-onboarding"
  | "/startups"
  | "/founder-onboarding";

const ONBOARDING_KEYS = {
  founder: "ventura:onboardingComplete",
  investor: "ventura:investorOnboarded",
  mentor: "ventura:mentorOnboarded",
} as const;

export function cachedRoleOnboardingState() {
  if (typeof window === "undefined") return {};
  return {
    founder: localStorage.getItem(ONBOARDING_KEYS.founder) === "1",
    investor: localStorage.getItem(ONBOARDING_KEYS.investor) === "1",
    mentor: localStorage.getItem(ONBOARDING_KEYS.mentor) === "1",
  };
}

export function cacheRoleOnboardingState(
  role: keyof typeof ONBOARDING_KEYS,
  complete: boolean,
) {
  if (typeof window === "undefined") return;
  if (complete) localStorage.setItem(ONBOARDING_KEYS[role], "1");
  else localStorage.removeItem(ONBOARDING_KEYS[role]);
}

/** Landing path for a role, given already-known onboarding state. */
export function roleLandingPath(
  role: AccountRole,
  done: { founder?: boolean; investor?: boolean; mentor?: boolean },
): RoleLandingPath {
  if (role === "admin") return "/admin";
  if (role === "investor") return done.investor ? "/" : "/investor-onboarding";
  if (role === "mentor") return done.mentor ? "/" : "/coach-onboarding";
  return done.founder ? "/startups" : "/founder-onboarding";
}


/** Where a signed-in user should land, based on their account type and onboarding state. */
export async function resolvePostAuthPath(): Promise<RoleLandingPath | "/auth"> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return "/auth";

  // One round trip: roles and all three onboarding markers at once.
  const [roleRes, investorRes, coachRes, founderRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("investor_profiles").select("completed_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("coach_profiles").select("completed_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("founder_accounts").select("onboarding_completed_at").eq("user_id", user.id).maybeSingle(),
  ]);

  const roles = (roleRes.data ?? []).map((r) => r.role as AccountRole);
  const role = (pickActiveRole(roles, readActiveRole()) ?? "founder") as AccountRole;

  return roleLandingPath(role, {
    founder: Boolean(founderRes.data?.onboarding_completed_at),
    investor: Boolean(investorRes.data?.completed_at),
    mentor: Boolean(coachRes.data?.completed_at),
  });
}


