import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const exportProgramData = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        dataset: z.enum(["kpis", "portfolio"]),
        format: z.enum(["csv", "xlsx"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { toCsv, b64, kpiRows, portfolioRows } = await import(
      "@/design-system/ventura-6bef42/lib/program-export-helpers.server"
    );
    const programId = await requireProgram(data.slug);

    const rows =
      data.dataset === "kpis"
        ? await kpiRows(supabaseAdmin, programId)
        : await portfolioRows(supabaseAdmin, programId);

    const stamp = new Date().toISOString().slice(0, 10);
    if (data.format === "csv") {
      const csv = toCsv(rows);
      return {
        fileName: `${data.slug}-${data.dataset}-${stamp}.csv`,
        mimeType: "text/csv",
        base64: b64(new TextEncoder().encode(csv)),
      };
    }

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No data" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, data.dataset === "kpis" ? "KPIs" : "Portfolio");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return {
      fileName: `${data.slug}-${data.dataset}-${stamp}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: b64(new Uint8Array(out)),
    };
  });

export const exportStartupReport = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), startupId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const { b64 } = await import("@/design-system/ventura-6bef42/lib/program-export-helpers.server");
    const programId = await requireProgram(data.slug);

    const [
      { data: startup },
      { data: updates },
      { data: assignments },
      { data: conversations },
      { data: trackedQuestions },
      { data: goals },
    ] = await Promise.all([
      supabaseAdmin
        .from("startups")
        .select("id, name, one_liner, stage, industry, location, website")
        .eq("id", data.startupId)
        .maybeSingle(),
      supabaseAdmin
        .from("weekly_updates")
        .select("week_of, title, summary, published_at")
        .eq("startup_id", data.startupId)
        .eq("is_published", true)
        .order("week_of", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("program_kpi_assignments")
        .select("current_value, completed_at, program_kpis(title, target_value, unit, due_date)")
        .eq("program_id", programId)
        .eq("startup_id", data.startupId),
      supabaseAdmin
        .from("weekly_customer_conversations")
        .select("week_of, customers_talked_to, question, slot")
        .eq("startup_id", data.startupId)
        .order("week_of", { ascending: false }),
      supabaseAdmin
        .from("startup_tracked_questions")
        .select("slot, question, is_hidden")
        .eq("startup_id", data.startupId)
        .order("slot", { ascending: true }),
      supabaseAdmin
        .from("startup_weekly_goals")
        .select("week_of, title, status, source_label")
        .eq("startup_id", data.startupId)
        .order("week_of", { ascending: false })
        .order("order_index", { ascending: true }),
    ]);

    if (!startup) throw new Error("Not found");

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595, 842]);
    let y = 790;
    const margin = 48;
    const maxWidth = 595 - margin * 2;

    const wrap = (text: string, size: number, f = font) => {
      const words = String(text ?? "").split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) > maxWidth) {
          if (line) lines.push(line);
          line = w;
        } else line = next;
      }
      if (line) lines.push(line);
      return lines;
    };

    const write = (text: string, size = 10, f = font, gap = 4) => {
      for (const line of wrap(text, size, f)) {
        if (y < 60) {
          page = pdf.addPage([595, 842]);
          y = 790;
        }
        page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
        y -= size + gap;
      }
    };

    const s = startup as Record<string, string>;
    write(s.name ?? "Startup", 20, bold, 8);
    if (s.one_liner) write(s.one_liner, 11, font, 10);
    write(
      [s.stage, s.industry, s.location, s.website].filter(Boolean).join("  •  "),
      9,
      font,
      16,
    );

    write("Challenge progress", 13, bold, 8);
    const kpiList = (assignments ?? []) as Array<{
      current_value: number;
      completed_at: string | null;
      program_kpis: { title: string; target_value: number; unit: string | null; due_date: string | null } | null;
    }>;
    if (!kpiList.length) write("No challenges assigned.", 10, font, 12);
    for (const a of kpiList) {
      const t = Number(a.program_kpis?.target_value ?? 0);
      const c = Number(a.current_value ?? 0);
      const pct = t > 0 ? Math.round((c / t) * 100) : 0;
      write(
        `${a.program_kpis?.title ?? "Challenge"} — ${c}${t > 0 ? `/${t}` : ""}${a.program_kpis?.unit ? " " + a.program_kpis.unit : ""}${t > 0 ? ` (${pct}%)` : ""}${a.program_kpis?.due_date ? `, due ${a.program_kpis.due_date}` : ""}${a.completed_at ? " — completed" : ""}`,
        10,
        font,
        4,
      );
    }
    y -= 10;

    // Weekly numbers (tracked questions answered during weekly updates)
    write("Weekly numbers", 13, bold, 8);
    const tracked = ((trackedQuestions ?? []) as Array<{
      slot: number;
      question: string;
      is_hidden: boolean;
    }>).filter((t) => !t.is_hidden);
    const convs = (conversations ?? []) as Array<{
      week_of: string;
      customers_talked_to: number;
      question: string | null;
      slot: number;
    }>;
    const visibleSlots = new Set(tracked.map((t) => t.slot));
    const numberRows = convs.filter((c) => !visibleSlots.size || visibleSlots.has(c.slot));
    if (!numberRows.length) write("No numbers recorded yet.", 10, font, 12);
    const byWeek = new Map<string, typeof numberRows>();
    for (const r of numberRows) {
      const list = byWeek.get(r.week_of) ?? [];
      list.push(r);
      byWeek.set(r.week_of, list);
    }
    for (const [week, rows] of Array.from(byWeek.entries()).sort((a, b) =>
      a[0] < b[0] ? 1 : -1,
    )) {
      write(week, 10, bold, 2);
      for (const r of rows) {
        const label =
          r.question ?? tracked.find((t) => t.slot === r.slot)?.question ?? "Tracked number";
        write(`• ${label}: ${Number(r.customers_talked_to ?? 0)}`, 9.5, font, 3);
      }
      y -= 4;
    }
    y -= 6;

    // Weekly goals
    write("Weekly goals", 13, bold, 8);
    const goalList = (goals ?? []) as Array<{
      week_of: string;
      title: string;
      status: string;
      source_label: string | null;
    }>;
    if (!goalList.length) write("No goals recorded yet.", 10, font, 12);
    const goalsByWeek = new Map<string, typeof goalList>();
    for (const g of goalList) {
      const list = goalsByWeek.get(g.week_of) ?? [];
      list.push(g);
      goalsByWeek.set(g.week_of, list);
    }
    for (const [week, rows] of Array.from(goalsByWeek.entries()).sort((a, b) =>
      a[0] < b[0] ? 1 : -1,
    )) {
      write(week, 10, bold, 2);
      for (const g of rows) {
        write(
          `• ${g.title} — ${String(g.status ?? "").replace(/_/g, " ")}${g.source_label ? ` [${g.source_label}]` : ""}`,
          9.5,
          font,
          3,
        );
      }
      y -= 4;
    }
    y -= 6;

    write("Weekly updates", 13, bold, 8);
    const upd = (updates ?? []) as Array<{ week_of: string; title: string | null; summary: string | null }>;
    if (!upd.length) write("No published updates.", 10, font, 12);
    for (const u of upd) {
      write(`${u.week_of} — ${u.title ?? "Weekly update"}`, 10, bold, 2);
      if (u.summary) write(u.summary, 9.5, font, 8);
    }

    const bytes = await pdf.save();
    const safe = (s.name ?? "startup").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    return {
      fileName: `${safe}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      mimeType: "application/pdf",
      base64: b64(new Uint8Array(bytes)),
    };
  });
