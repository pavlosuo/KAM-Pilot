
export type Row = Record<string, string | number>;

export function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function kpiRows(supabaseAdmin: any, programId: string): Promise<Row[]> {
  const { data: assignments } = await supabaseAdmin
    .from("program_kpi_assignments")
    .select(
      "startup_id, current_value, completed_at, updated_at, program_kpis(title, target_value, unit, due_date)",
    )
    .eq("program_id", programId);

  const list = (assignments ?? []) as Array<{
    startup_id: string;
    current_value: number;
    completed_at: string | null;
    updated_at: string;
    program_kpis: {
      title: string;
      target_value: number;
      unit: string | null;
      due_date: string | null;
    } | null;
  }>;
  const ids = Array.from(new Set(list.map((a) => a.startup_id)));
  const { data: startups } = await supabaseAdmin
    .from("startups")
    .select("id, name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map(
    ((startups ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]),
  );

  return list.map((a) => {
    const target = Number(a.program_kpis?.target_value ?? 0);
    return {
      Startup: nameById.get(a.startup_id) ?? a.startup_id,
      KPI: a.program_kpis?.title ?? "",
      Target: target,
      Current: Number(a.current_value ?? 0),
      Unit: a.program_kpis?.unit ?? "",
      "Progress %": target > 0 ? Math.round((Number(a.current_value ?? 0) / target) * 100) : 0,
      Deadline: a.program_kpis?.due_date ?? "",
      Completed: a.completed_at ? "Yes" : "No",
      "Last update": a.updated_at ? new Date(a.updated_at).toISOString().slice(0, 10) : "",
    };
  });
}

export async function portfolioRows(supabaseAdmin: any, programId: string): Promise<Row[]> {
  const { data: members } = await supabaseAdmin
    .from("program_startups")
    .select("startup_id, status, joined_at, investor_ready")
    .eq("program_id", programId)
    .eq("status", "approved");
  const list = (members ?? []) as Array<{
    startup_id: string;

    joined_at: string | null;
    investor_ready: boolean | null;
  }>;
  const ids = list.map((m) => m.startup_id);
  if (!ids.length) return [];

  const [{ data: startups }, { data: teamRows }] = await Promise.all([
    supabaseAdmin
      .from("startups")
      .select(
        "id, name, one_liner, stage, industry, industry_tags, owner_id, slug, problem, solution, team_members",
      )
      .in("id", ids),
    supabaseAdmin
      .from("startup_members")
      .select("startup_id, profiles(full_name)")
      .in("startup_id", ids),
  ]);

  const teamByStartup = new Map<string, string[]>();
  for (const r of (teamRows ?? []) as Array<{
    startup_id: string;
    profiles: { full_name: string | null } | null;
  }>) {
    const name = r.profiles?.full_name?.trim();
    if (!name) continue;
    const arr = teamByStartup.get(r.startup_id) ?? [];
    if (!arr.includes(name)) arr.push(name);
    teamByStartup.set(r.startup_id, arr);
  }

  const sMap = new Map(
    ((startups ?? []) as Array<Record<string, any>>).map((s) => [s.id as string, s]),
  );

  return list.map((m) => {
    const s = sMap.get(m.startup_id) ?? ({} as Record<string, any>);
    const industry =
      (typeof s.industry === "string" && s.industry.trim()) ||
      (Array.isArray(s.industry_tags) ? s.industry_tags.filter(Boolean).join(", ") : "") ||
      "";
    const profileTeam = Array.isArray(s.team_members)
      ? s.team_members
          .map((t: any) => (typeof t === "string" ? t : t?.name ?? t?.full_name ?? ""))
          .filter(Boolean)
      : [];
    const team = Array.from(
      new Set([...(teamByStartup.get(m.startup_id) ?? []), ...profileTeam]),
    ).join(", ");
    return {
      Startup: s.name ?? m.startup_id,
      "One-liner": s.one_liner ?? "",
      Stage: s.stage ?? "",
      Industry: industry,
      Team: team,
      Problem: s.problem ?? "",
      Solution: s.solution ?? "",
    };
  });
}


