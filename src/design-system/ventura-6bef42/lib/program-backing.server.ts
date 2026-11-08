// Keeps the "Backed by" list on startup profiles in sync with program membership.
// Once a startup joins a program, the program name + logo are stored on the
// startup itself, so the credit survives even if the startup is later removed.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function parseList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Add the program's name + logo to the startup's "Backed by" list. */
export async function applyProgramBacking(
  supabaseAdmin: SB,
  programId: string,
  startupId: string,
): Promise<void> {
  const { data: program } = await supabaseAdmin
    .from("programs")
    .select("name, logo_url")
    .eq("id", programId)
    .maybeSingle();
  const name = (program as { name?: string } | null)?.name?.trim();
  if (!name) return;
  const logoUrl = (program as { logo_url?: string | null } | null)?.logo_url ?? null;

  const { data: startup } = await supabaseAdmin
    .from("startups")
    .select("accelerator, program_logos")
    .eq("id", startupId)
    .maybeSingle();
  if (!startup) return;

  const names = parseList((startup as { accelerator: string | null }).accelerator);
  if (!names.includes(name)) names.push(name);

  const logos = {
    ...(((startup as { program_logos: Record<string, string> | null }).program_logos ?? {}) as Record<
      string,
      string
    >),
  };
  if (logoUrl) logos[name] = logoUrl;
  else delete logos[name];

  await supabaseAdmin
    .from("startups")
    .update({ accelerator: names.join(", "), program_logos: logos })
    .eq("id", startupId);
}

/** Refresh the stored logo for every startup that credits this program. */
export async function syncProgramBackingLogos(supabaseAdmin: SB, programId: string): Promise<void> {
  const { data: program } = await supabaseAdmin
    .from("programs")
    .select("name, logo_url")
    .eq("id", programId)
    .maybeSingle();
  const name = (program as { name?: string } | null)?.name?.trim();
  if (!name) return;
  const logoUrl = (program as { logo_url?: string | null } | null)?.logo_url ?? null;

  const { data: startups } = await supabaseAdmin
    .from("startups")
    .select("id, accelerator, program_logos")
    .ilike("accelerator", `%${name}%`);

  const rows = (startups ?? []) as Array<{
    id: string;
    accelerator: string | null;
    program_logos: Record<string, string> | null;
  }>;

  await Promise.all(
    rows
      .filter((r) => parseList(r.accelerator).includes(name))
      .map((r) => {
        const logos = { ...((r.program_logos ?? {}) as Record<string, string>) };
        if (logos[name] === (logoUrl ?? undefined)) return null;
        if (logoUrl) logos[name] = logoUrl;
        else delete logos[name];
        return supabaseAdmin.from("startups").update({ program_logos: logos }).eq("id", r.id);
      })
      .filter(Boolean),
  );
}
