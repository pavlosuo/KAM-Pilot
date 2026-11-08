/**
 * A user may be affiliated with at most this many startups — whether they own
 * them or joined someone else's team.
 */
export const MAX_STARTUPS_PER_USER = 2;

type CountClient = {
  from: (table: string) => any;
};

/**
 * Distinct startups a user is affiliated with: startups they own plus startups
 * they are a team member of. Demo startups are still included here — callers
 * that enforce the cap drop them with `withoutDemoStartups`.
 */
async function affiliatedStartupIds(client: CountClient, userId: string) {
  const [owned, memberships] = await Promise.all([
    client.from("startups").select("id").eq("owner_id", userId),
    client.from("startup_members").select("startup_id").eq("user_id", userId),
  ]);
  if (owned.error) throw owned.error;
  if (memberships.error) throw memberships.error;

  const ids = new Set<string>();
  for (const r of (owned.data ?? []) as Array<{ id: string }>) ids.add(r.id);
  for (const r of (memberships.data ?? []) as Array<{ startup_id: string }>) {
    ids.add(r.startup_id);
  }
  return ids;
}

/**
 * Demo startups live only inside a demo program's dashboard, so they must not
 * use up a real founder's allowance.
 */
async function withoutDemoStartups(client: CountClient, ids: Set<string>) {
  const idList = [...ids];
  if (idList.length === 0) return new Set<string>();
  const { data, error } = await client
    .from("startups")
    .select("id")
    .in("id", idList)
    .eq("is_demo", false);
  if (error) throw error;
  return new Set<string>(((data ?? []) as Array<{ id: string }>).map((r) => r.id));
}

export async function countUserStartups(client: CountClient, userId: string) {
  const ids = await affiliatedStartupIds(client, userId);
  const real = await withoutDemoStartups(client, ids);
  return real.size;
}

export async function assertCanJoinAnotherStartup(
  client: CountClient,
  userId: string,
  startupId?: string,
) {
  const ids = await affiliatedStartupIds(client, userId);
  // Already affiliated with this exact startup → nothing to enforce.
  if (startupId && ids.has(startupId)) return;
  const real = await withoutDemoStartups(client, ids);
  if (real.size >= MAX_STARTUPS_PER_USER) {
    throw new Error(
      `You're already part of ${MAX_STARTUPS_PER_USER} startups. Leave one before joining or creating another.`,
    );
  }
}
