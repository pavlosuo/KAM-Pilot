import { tool } from "ai";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const NIL = "00000000-0000-0000-0000-000000000000";

/* ------------------------------------------------------------------ */
/* Action proposals                                                    */
/* ------------------------------------------------------------------ */

export const programActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create_challenge"),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    targetValue: z.number().nullable(),
    unit: z.string().trim().max(40).nullable(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    startupIds: z.array(z.string().uuid()),
    assignAll: z.boolean(),
  }),
  z.object({
    kind: z.literal("assign_challenge"),
    challengeId: z.string().uuid(),
    startupIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    kind: z.literal("post_announcement"),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
    isPinned: z.boolean(),
  }),
  z.object({
    kind: z.literal("create_event"),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    startsAt: z.string().min(4),
    location: z.string().trim().max(160).nullable(),
  }),
  z.object({
    kind: z.literal("message_startup"),
    startupId: z.string().uuid(),
    body: z.string().trim().min(1).max(5000),
  }),
  z.object({
    kind: z.literal("message_person"),
    startupId: z.string().uuid(),
    userId: z.string().uuid(),
    personName: z.string().trim().max(160).nullable(),
    body: z.string().trim().min(1).max(5000),
  }),
  z.object({
    kind: z.literal("mark_reviewed"),
    startupId: z.string().uuid(),
    weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal("set_applicant_status"),
    startupId: z.string().uuid(),
    status: z.enum(["approved", "declined", "pending"]),
  }),
]);

export type ProgramAction = z.infer<typeof programActionSchema>;

export type ProgramActionProposal = {
  proposal: true;
  label: string;
  summary: string;
  action: ProgramAction;
};

function proposal(label: string, summary: string, action: ProgramAction): ProgramActionProposal {
  return { proposal: true, label, summary, action };
}

/* ------------------------------------------------------------------ */
/* Executor (runs only after the program lead confirms)                */
/* ------------------------------------------------------------------ */

export async function executeProgramAction(
  supabaseAdmin: SB,
  programId: string,
  action: ProgramAction,
): Promise<string> {
  const assertMember = async (startupId: string) => {
    const { data } = await supabaseAdmin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("startup_id", startupId)
      .maybeSingle();
    if (!data) throw new Error("That startup is not part of this program");
  };

  const approvedIds = async (): Promise<string[]> => {
    const { data } = await supabaseAdmin
      .from("program_startups")
      .select("startup_id")
      .eq("program_id", programId)
      .eq("status", "approved");
    return ((data ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id);
  };

  switch (action.kind) {
    case "create_challenge": {
      const { data: kpi, error } = await supabaseAdmin
        .from("program_kpis")
        .insert({
          program_id: programId,
          title: action.title,
          description: action.description || null,
          target_value: action.targetValue ?? null,
          unit: action.unit || null,
          due_date: action.dueDate || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      let targets = action.startupIds;
      if (action.assignAll) targets = await approvedIds();
      const allowed = new Set(await approvedIds());
      targets = targets.filter((id) => allowed.has(id));
      if (targets.length) {
        const { error: aErr } = await supabaseAdmin
          .from("program_kpi_assignments")
          .insert(
            targets.map((sid) => ({ kpi_id: kpi.id, program_id: programId, startup_id: sid })),
          );
        if (aErr) throw new Error(aErr.message);
      }
      return `Challenge "${action.title}" created${targets.length ? ` and assigned to ${targets.length} startup(s)` : ""}.`;
    }

    case "assign_challenge": {
      const { data: kpi } = await supabaseAdmin
        .from("program_kpis")
        .select("id, title")
        .eq("program_id", programId)
        .eq("id", action.challengeId)
        .maybeSingle();
      if (!kpi) throw new Error("Challenge not found in this program");

      const { data: existing } = await supabaseAdmin
        .from("program_kpi_assignments")
        .select("startup_id")
        .eq("program_id", programId)
        .eq("kpi_id", action.challengeId);
      const have = new Set(
        ((existing ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id),
      );
      const allowed = new Set(await approvedIds());
      const add = action.startupIds.filter((id) => allowed.has(id) && !have.has(id));
      if (add.length) {
        const { error } = await supabaseAdmin
          .from("program_kpi_assignments")
          .insert(
            add.map((sid) => ({ kpi_id: action.challengeId, program_id: programId, startup_id: sid })),
          );
        if (error) throw new Error(error.message);
      }
      return `Assigned "${(kpi as { title: string }).title}" to ${add.length} startup(s).`;
    }

    case "post_announcement": {
      const { error } = await supabaseAdmin.from("program_announcements").insert({
        program_id: programId,
        title: action.title,
        body: action.body,
        is_pinned: action.isPinned,
      });
      if (error) throw new Error(error.message);

      const { sendProgramInboxEmails, programMemberUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [members, name] = await Promise.all([
        programMemberUserIds(programId),
        programName(programId),
      ]);
      await sendProgramInboxEmails(members, {
        eventId: `ann-${programId}-${action.title}-${Date.now()}`,
        kindLabel: "Announcement",
        title: action.title,
        body: action.body,
        context: name,
      });
      return `Announcement "${action.title}" posted to the cohort.`;
    }

    case "create_event": {
      const startsAt = new Date(action.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid event date");
      const { error } = await supabaseAdmin.from("program_events").insert({
        program_id: programId,
        title: action.title,
        description: action.description || null,
        starts_at: startsAt.toISOString(),
        location: action.location || null,
      });
      if (error) throw new Error(error.message);

      const { sendProgramInboxEmails, programMemberUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [members, name] = await Promise.all([
        programMemberUserIds(programId),
        programName(programId),
      ]);
      await sendProgramInboxEmails(members, {
        eventId: `event-${programId}-${action.title}-${startsAt.toISOString()}`,
        kindLabel: "Event",
        title: action.title,
        body: [startsAt.toLocaleString("en-GB"), action.location, action.description]
          .filter(Boolean)
          .join(" · "),
        context: name,
      });
      return `Event "${action.title}" created.`;
    }

    case "message_startup": {
      await assertMember(action.startupId);
      const { sendProgramInboxEmails, startupTeamUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [recipients, name] = await Promise.all([
        startupTeamUserIds(action.startupId),
        programName(programId),
      ]);
      if (!recipients.length) return "That startup has no team members to message yet.";

      const { error } = await supabaseAdmin.from("messages").insert(
        recipients.map((uid: string) => ({
          startup_id: action.startupId,
          sender_id: programId,
          recipient_id: uid,
          body: action.body,
        })),
      );
      if (error) throw new Error(error.message);

      await sendProgramInboxEmails(recipients, {
        eventId: `pmsg-${programId}-${action.startupId}-${Date.now()}`,
        kindLabel: "Message",
        title: `Message from ${name ?? "your program"}`,
        body: action.body,
        context: name,
      });
      return `Message sent to ${recipients.length} team member(s).`;
    }

    case "message_person": {
      await assertMember(action.startupId);
      const { sendProgramInboxEmails, startupTeamUserIds, programName } = await import(
        "@/design-system/ventura-6bef42/lib/inbox-email.server"
      );
      const [team, name] = await Promise.all([
        startupTeamUserIds(action.startupId),
        programName(programId),
      ]);
      if (!team.includes(action.userId)) {
        throw new Error("That person is not on this startup's team.");
      }

      const { error } = await supabaseAdmin.from("messages").insert({
        startup_id: action.startupId,
        sender_id: programId,
        recipient_id: action.userId,
        body: action.body,
      });
      if (error) throw new Error(error.message);

      await sendProgramInboxEmails([action.userId], {
        eventId: `pmsg1-${programId}-${action.userId}-${Date.now()}`,
        kindLabel: "Message",
        title: `Message from ${name ?? "your program"}`,
        body: action.body,
        context: name,
      });
      return `Message sent to ${action.personName ?? "the founder"}.`;
    }



    case "mark_reviewed": {
      await assertMember(action.startupId);
      const { error } = await supabaseAdmin.from("program_update_reviews").upsert(
        {
          program_id: programId,
          startup_id: action.startupId,
          week_of: action.weekOf,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: "program_id,startup_id,week_of" },
      );
      if (error) throw new Error(error.message);
      return `Marked the week of ${action.weekOf} as reviewed.`;
    }

    case "set_applicant_status": {
      await assertMember(action.startupId);
      const { error } = await supabaseAdmin
        .from("program_startups")
        .update({
          status: action.status,
          joined_at: action.status === "approved" ? new Date().toISOString() : null,
        })
        .eq("program_id", programId)
        .eq("startup_id", action.startupId);
      if (error) throw new Error(error.message);
      if (action.status === "approved") {
        const { applyProgramBacking } = await import("@/design-system/ventura-6bef42/lib/program-backing.server");
        await applyProgramBacking(supabaseAdmin, programId, action.startupId);
      }
      return `Applicant status set to ${action.status}.`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Tools handed to the model                                           */
/* ------------------------------------------------------------------ */

export async function buildProgramAiTools(supabaseAdmin: SB, programId: string) {
  const { loadOverview, loadPortfolio, loadStartupDetail } = await import(
    "@/design-system/ventura-6bef42/lib/program-dashboard.server"
  );

  const readTools = {
    program_stats: tool({
      description:
        "High-level program stats: startup count, pending applicants, how many posted a weekly update this week, review coverage, startups needing attention, upcoming due dates and total XP.",
      inputSchema: z.object({}),
      execute: async () => loadOverview(supabaseAdmin, programId),
    }),

    list_people: tool({
      description:
        "List every person (founder / team member) across the program's startups with their userId, name, role and their startup's id and name. Use it to resolve a person's userId before proposing a personal message.",
      inputSchema: z.object({}),
      execute: async () => {
        const ids = await memberIds(supabaseAdmin, programId);
        if (!ids.length) return { people: [] };
        const [{ data: startups }, { data: members }] = await Promise.all([
          supabaseAdmin.from("startups").select("id, name, owner_id").in("id", ids),
          supabaseAdmin.from("startup_members").select("startup_id, user_id, role").in("startup_id", ids),
        ]);
        const sRows = (startups ?? []) as Array<{ id: string; name: string | null; owner_id: string }>;
        const mRows = (members ?? []) as Array<{
          startup_id: string;
          user_id: string;
          role: string | null;
        }>;
        const userIds = Array.from(
          new Set([...sRows.map((s) => s.owner_id), ...mRows.map((m) => m.user_id)]),
        );
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, headline")
          .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        const byId = new Map(
          ((profiles ?? []) as Array<{ id: string; full_name: string | null; headline: string | null }>).map(
            (p) => [p.id, p],
          ),
        );
        const people: Array<{
          userId: string;
          name: string;
          headline: string | null;
          role: string;
          startupId: string;
          startupName: string | null;
        }> = [];
        for (const s of sRows) {
          const seen = new Set<string>();
          const rows = [
            { user_id: s.owner_id, role: "Founder" },
            ...mRows
              .filter((m) => m.startup_id === s.id)
              .map((m) => ({ user_id: m.user_id, role: m.role ?? "Member" })),
          ];
          for (const r of rows) {
            if (seen.has(r.user_id)) continue;
            seen.add(r.user_id);
            const p = byId.get(r.user_id);
            people.push({
              userId: r.user_id,
              name: p?.full_name ?? "Team member",
              headline: p?.headline ?? null,
              role: r.role,
              startupId: s.id,
              startupName: s.name,
            });
          }
        }
        return { people };
      },
    }),



    list_startups: tool({
      description:
        "List the program's startups with id, name, one-liner, stage, team, coach, latest update week, XP and activity status.",
      inputSchema: z.object({
        status: z.enum(["approved", "pending", "declined"]),
      }),
      execute: async ({ status }: { status: "approved" | "pending" | "declined" }) => ({
        startups: await loadPortfolio(supabaseAdmin, programId, status),
      }),
    }),

    get_startup_detail: tool({
      description:
        "Full detail for one startup in the program: profile, published weekly updates, weekly goals, tracked-question numbers, notes and XP.",
      inputSchema: z.object({ startupId: z.string() }),
      execute: async ({ startupId }: { startupId: string }) =>
        loadStartupDetail(supabaseAdmin, programId, startupId),
    }),

    list_weekly_updates: tool({
      description:
        "Recent published weekly updates across the cohort, or for one startup when startupId is given.",
      inputSchema: z.object({
        startupId: z.string().nullable(),
        limit: z.number(),
      }),
      execute: async ({ startupId, limit }: { startupId: string | null; limit: number }) => {
        const ids = await memberIds(supabaseAdmin, programId);
        const scoped = startupId ? ids.filter((i) => i === startupId) : ids;
        if (!scoped.length) return { updates: [] };
        const { data } = await supabaseAdmin
          .from("weekly_updates")
          .select("id, startup_id, week_of, title, summary, published_at")
          .in("startup_id", scoped)
          .eq("is_published", true)
          .order("week_of", { ascending: false })
          .limit(Math.min(Math.max(limit || 20, 1), 60));
        return { updates: data ?? [] };
      },
    }),

    list_goals: tool({
      description:
        "Weekly goals across the cohort (or one startup), with status: pending, done, carried_over or dropped.",
      inputSchema: z.object({
        startupId: z.string().nullable(),
        limit: z.number(),
      }),
      execute: async ({ startupId, limit }: { startupId: string | null; limit: number }) => {
        const ids = await memberIds(supabaseAdmin, programId);
        const scoped = startupId ? ids.filter((i) => i === startupId) : ids;
        if (!scoped.length) return { goals: [] };
        const { data } = await supabaseAdmin
          .from("startup_weekly_goals")
          .select("id, startup_id, week_of, title, status, source_label, program_kpi_id")
          .in("startup_id", scoped)
          .order("week_of", { ascending: false })
          .limit(Math.min(Math.max(limit || 40, 1), 120));
        return { goals: data ?? [] };
      },
    }),

    list_challenges: tool({
      description:
        "Program challenges (KPIs) with targets, due dates, per-startup assignments, completeness percentage, review state (pending/approved/declined/postponed), lead feedback (postpone reasons) and the founders' submissions including notes and attached proof files.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: kpis }, { data: assignments }, { data: startups }] = await Promise.all([
          supabaseAdmin
            .from("program_kpis")
            .select("id, title, description, target_value, unit, due_date")
            .eq("program_id", programId)
            .order("created_at", { ascending: false }),
          supabaseAdmin
            .from("program_kpi_assignments")
            .select(
              "id, kpi_id, startup_id, current_value, completed_at, due_date_override, postpone_reason, postponed_at, declined_at",
            )
            .eq("program_id", programId),
          supabaseAdmin
            .from("program_startups")
            .select("startup_id, startups(name)")
            .eq("program_id", programId),
        ]);

        const kpiById = new Map(
          ((kpis ?? []) as Array<{ id: string; title: string; target_value: number | null }>).map(
            (k) => [k.id, k],
          ),
        );
        const nameById = new Map(
          ((startups ?? []) as unknown as Array<{
            startup_id: string;
            startups?: { name: string } | null;
          }>).map((r) => [r.startup_id, r.startups?.name ?? null]),
        );

        const rows = (assignments ?? []) as Array<{
          id: string;
          kpi_id: string;
          startup_id: string;
          current_value: number | null;
          completed_at: string | null;
        }>;

        const { data: entries } = await supabaseAdmin
          .from("program_kpi_entries")
          .select(
            "id, assignment_id, value, note, proof_file_name, submitted_for_check, review_status, reviewed_at, recorded_by_label, created_at",
          )
          .in("assignment_id", rows.length ? rows.map((r) => r.id) : [NIL])
          .order("created_at", { ascending: false })
          .limit(300);

        const enriched = rows.map((a) => {
          const kpi = kpiById.get(a.kpi_id);
          const target = Number(kpi?.target_value ?? 0);
          const current = Number(a.current_value ?? 0);
          return {
            ...a,
            challenge_title: kpi?.title ?? null,
            startup_name: nameById.get(a.startup_id) ?? null,
            completeness_pct:
              target > 0 ? Math.min(100, Math.round((current / target) * 100)) : a.completed_at ? 100 : 0,
          };
        });

        return {
          challenges: kpis ?? [],
          assignments: enriched,
          submissions: entries ?? [],
        };
      },
    }),

    list_comms: tool({
      description: "Program announcements and events already published to the cohort.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: announcements }, { data: events }] = await Promise.all([
          supabaseAdmin
            .from("program_announcements")
            .select("id, title, body, is_pinned, published_at")
            .eq("program_id", programId)
            .order("published_at", { ascending: false })
            .limit(20),
          supabaseAdmin
            .from("program_events")
            .select("id, title, description, starts_at, location, url")
            .eq("program_id", programId)
            .order("starts_at", { ascending: true })
            .limit(20),
        ]);
        return { announcements: announcements ?? [], events: events ?? [] };
      },
    }),

    list_pending_applicants: tool({
      description: "Startups waiting for approval to join the program.",
      inputSchema: z.object({}),
      execute: async () => ({
        applicants: await loadPortfolio(supabaseAdmin, programId, "pending"),
      }),
    }),
  };

  /* Action tools: these never write. They return a proposal the UI confirms. */
  const actionTools = {
    propose_create_challenge: tool({
      description:
        "Propose creating a new program challenge. Set assignAll true for the whole cohort, otherwise pass startupIds.",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().nullable(),
        targetValue: z.number().nullable(),
        unit: z.string().nullable(),
        dueDate: z.string().nullable(),
        startupIds: z.array(z.string()),
        assignAll: z.boolean(),
      }),
      execute: async (input: {
        title: string;
        description: string | null;
        targetValue: number | null;
        unit: string | null;
        dueDate: string | null;
        startupIds: string[];
        assignAll: boolean;
      }) =>
        proposal(
          "Create challenge",
          `"${input.title}"${input.assignAll ? " for the whole cohort" : input.startupIds.length ? ` for ${input.startupIds.length} startup(s)` : " (unassigned)"}${input.dueDate ? `, due ${input.dueDate}` : ""}`,
          { kind: "create_challenge", ...input },
        ),
    }),

    propose_assign_challenge: tool({
      description: "Propose assigning an existing challenge to one or more startups.",
      inputSchema: z.object({
        challengeId: z.string(),
        startupIds: z.array(z.string()),
      }),
      execute: async (input: { challengeId: string; startupIds: string[] }) =>
        proposal(
          "Assign challenge",
          `Assign this challenge to ${input.startupIds.length} startup(s)`,
          { kind: "assign_challenge", ...input },
        ),
    }),

    propose_announcement: tool({
      description: "Propose posting an announcement to every member of the program.",
      inputSchema: z.object({
        title: z.string(),
        body: z.string(),
        isPinned: z.boolean(),
      }),
      execute: async (input: { title: string; body: string; isPinned: boolean }) =>
        proposal("Post announcement", `"${input.title}" — sent to all members`, {
          kind: "post_announcement",
          ...input,
        }),
    }),

    propose_event: tool({
      description: "Propose creating a program event. startsAt must be an ISO date-time string.",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().nullable(),
        startsAt: z.string(),
        location: z.string().nullable(),
      }),
      execute: async (input: {
        title: string;
        description: string | null;
        startsAt: string;
        location: string | null;
      }) =>
        proposal("Create event", `"${input.title}" on ${input.startsAt}`, {
          kind: "create_event",
          ...input,
        }),
    }),

    propose_message: tool({
      description: "Propose sending a message to a startup's whole team.",
      inputSchema: z.object({ startupId: z.string(), body: z.string() }),
      execute: async (input: { startupId: string; body: string }) =>
        proposal("Send message", input.body.slice(0, 160), {
          kind: "message_startup",
          ...input,
        }),
    }),

    propose_message_person: tool({
      description:
        "Propose sending a personal (1:1) message to ONE founder's inbox. Use this when the lead names a specific person. Look up the person's userId with get_startup_detail (team[].userId) or list_people first — never invent it.",
      inputSchema: z.object({
        startupId: z.string(),
        userId: z.string(),
        personName: z.string().nullable(),
        body: z.string(),
      }),
      execute: async (input: {
        startupId: string;
        userId: string;
        personName: string | null;
        body: string;
      }) =>
        proposal(
          `Message ${input.personName ?? "founder"}`,
          input.body.slice(0, 160),
          { kind: "message_person", ...input },
        ),
    }),



    propose_mark_reviewed: tool({
      description: "Propose marking a startup's weekly update for a given week as reviewed.",
      inputSchema: z.object({ startupId: z.string(), weekOf: z.string() }),
      execute: async (input: { startupId: string; weekOf: string }) =>
        proposal("Mark reviewed", `Week of ${input.weekOf}`, {
          kind: "mark_reviewed",
          ...input,
        }),
    }),

    generate_pdf_report: tool({
      description:
        "Build a downloadable PDF report for the program lead. Use it whenever they ask for a PDF, a report file, or something to share/print. Write the full report content yourself from tool data — each section has a heading plus paragraphs and/or bullet lines. Keep it factual and grounded in data you already read.",
      inputSchema: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        sections: z.array(
          z.object({
            heading: z.string(),
            paragraphs: z.array(z.string()),
            bullets: z.array(z.string()),
          }),
        ),
      }),
      execute: async (input: {
        title: string;
        subtitle: string | null;
        sections: Array<{ heading: string; paragraphs: string[]; bullets: string[] }>;
      }) => ({
        pdfReport: true as const,
        title: input.title,
        subtitle: input.subtitle,
        sections: input.sections,
      }),
    }),



    propose_applicant_status: tool({
      description: "Propose approving or declining a startup's application to the program.",
      inputSchema: z.object({
        startupId: z.string(),
        status: z.enum(["approved", "declined", "pending"]),
      }),
      execute: async (input: {
        startupId: string;
        status: "approved" | "declined" | "pending";
      }) =>
        proposal(
          input.status === "approved" ? "Approve applicant" : "Update applicant",
          `Set status to ${input.status}`,
          { kind: "set_applicant_status", ...input },
        ),
    }),
  };

  return { ...readTools, ...actionTools };
}

async function memberIds(supabaseAdmin: SB, programId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("program_startups")
    .select("startup_id")
    .eq("program_id", programId);
  return ((data ?? []) as Array<{ startup_id: string }>).map((r) => r.startup_id);
}

export function programAiSystemPrompt(programName: string, today: string) {
  return `You are the AI co-pilot inside the "${programName}" accelerator dashboard on Ventura.
You work for the program lead. Today is ${today}.

Scope: you can ONLY see data for this one program — its startups, their weekly updates,
goals, tracked numbers, XP, challenges, announcements, events and applicants. Never claim
knowledge of other programs or of the wider platform.

How to work:
- Always ground answers in tool results. Call tools before answering anything factual.
- Start broad (program_stats, list_startups) then drill in with get_startup_detail.
- Be concise and concrete: name startups, cite weeks, numbers and deltas. Use short markdown
  (bold labels, bullet lists, small tables). No filler preamble.
- When asked for advice, tie it to the data you just read and give 2-4 specific next steps.

Clarify before acting: if the request is vague, ambiguous or missing detail needed to answer or
act well (unclear time range, which startups, what metric, tone/audience of a message, target or
deadline of a challenge, what "falling behind" means here), STOP and ask follow-up questions
instead of guessing. Rules for clarifying:
- Ask at most 2-3 short questions in one message, as a bullet list, and nothing else.
- Where possible offer concrete options or a sensible default ("last 4 weeks?").
- Do not clarify when the answer is obvious or cheap to just read from the data — prefer answering
  a clearly-scoped question directly.
- Never send a propose_* action built on a guess; clarify first, then propose.

PDFs: you CAN produce real PDF files. When the lead asks for a PDF, a report, an export or
something printable, gather the data with read tools and then call generate_pdf_report once with
the finished content. Never say you cannot attach or generate a PDF — the chat shows a download
button for it. Only clarify first if the scope (which startups, which period) is genuinely unclear.

Actions: you may NEVER change data directly. When the lead asks for something that changes the

program, call the matching propose_* tool exactly once with complete arguments. The dashboard
shows the lead a confirmation card; they approve it. After proposing, briefly say what will
happen once they confirm. If you need an id (startup or challenge), look it up with a read tool
first — never invent ids. If required detail is missing (e.g. a date, recipients, or content),
ask a short follow-up question instead of guessing.

Messaging: you can message a whole startup team (propose_message) OR one person privately
(propose_message_person, which lands in that founder's personal inbox). When the lead names a
person, default to the personal message — resolve their userId with list_people or
get_startup_detail first, and only ask which startup if the same name appears on more than one.`;
}
