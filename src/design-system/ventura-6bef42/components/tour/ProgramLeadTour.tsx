import { useNavigate } from "@tanstack/react-router";
import { ProductTour, type TourStep } from "./ProductTour";

/**
 * Full walkthrough of the program lead dashboard — every page, card and action.
 * Driven manually from the "Guided tour" button in the program header.
 */
export function ProgramLeadTour({
  slug,
  programName,
  open,
  onClose,
}: {
  slug: string;
  programName: string;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const go = (to: string) => async () => {
    if (typeof window !== "undefined" && window.location.pathname === to) return;
    await navigate({ to });
    await new Promise((r) => setTimeout(r, 350));
  };

  const steps: TourStep[] = [
    {
      title: `Welcome to the ${programName} dashboard`,
      body: "A quick walkthrough of everything you can do as a program lead: track cohort momentum, review challenge submissions, manage your mentor and investor network, communicate with founders and export reports.",
    },
    {
      target: '[data-tour="program-brand"]',
      title: "Your program branding",
      body: "Logo, name and accent colour. Whatever you set here shows up for founders on their program hub too, so the workspace feels like yours.",
      beforeStep: go(`/program/${slug}`),
    },
    {
      target: '[data-tour="overview-rings"]',
      title: "Cohort activity rings",
      body: "Apple-style rings summarising the week: how many startups posted a weekly update, how many hit their goals and how many challenges moved forward.",
    },
    {
      target: '[data-tour="overview-attention"]',
      title: "Needs attention",
      body: "Startups that went quiet, missed a weekly update or asked you for an intro. Only two show at once — use the arrow to expand the full list.",
    },
    {
      target: '[data-tour="overview-milestones"]',
      title: "Upcoming milestones",
      body: "Challenge deadlines and events coming up across the cohort, so nothing slips through.",
    },
    {
      target: '[data-tour="overview-ai"]',
      title: "Program AI assistant",
      body: "Ask anything about the cohort — 'who is behind on updates?', 'summarise this week' — or click the orb to open the full chat. It can also build PDF reports.",
    },
    {
      target: '[data-tour="portfolio-filters"]',
      title: "Portfolio filters and exports",
      body: "Filter the cohort by stage, status or search, then export the whole view to Excel or CSV for your board and investors.",
      beforeStep: go(`/program/${slug}/startups`),
    },
    {
      target: '[data-tour="portfolio-grid"]',
      title: "Every startup at a glance",
      body: "Each card shows the logo, stage, level, streak and latest signals. Click any card to open the full startup workspace.",
    },
    {
      target: '[data-tour="startup-header"]',
      title: "Startup workspace",
      body: "From the header you can open the public profile, message the team, generate a PDF report or remove the startup from the cohort.",
      beforeStep: async () => {
        const card = document.querySelector('[data-tour="portfolio-card"]') as HTMLElement | null;
        card?.click();
        await new Promise((r) => setTimeout(r, 500));
      },
    },
    {
      target: '[data-tour="startup-weekly"]',
      title: "Full weekly updates",
      body: "The complete update founders submit each week — metrics, wins, blockers and asks. This is the raw signal behind every score in the dashboard.",
    },
    {
      target: '[data-tour="startup-notes"]',
      title: "Private notes",
      body: "Your own notes on this startup. Founders never see them.",
    },
    {
      target: '[data-tour="startup-team"]',
      title: "Team",
      body: "Everyone on the startup, with their role. Click a member to see their profile and contribution board.",
    },
    {
      target: '[data-tour="startup-pitch"]',
      title: "Pitch material",
      body: "Deck and pitch video, so you can review the story before a session.",
    },
    {
      target: '[data-tour="startup-challenges"]',
      title: "Challenge progress",
      body: "Where this startup stands on every program challenge you've set.",
    },
    {
      target: '[data-tour="startup-kpi"]',
      title: "KPI history",
      body: "Week-over-week numbers reported by the founders — revenue, users, runway and whatever else you track.",
    },
    {
      target: '[data-tour="startup-goals"]',
      title: "Weekly goals",
      body: "The goals the team set for themselves and whether they hit them. Consistency here drives their level and streak.",
    },
    {
      target: '[data-tour="challenges-header"]',
      title: "Challenges",
      body: "Define the targets for the whole cohort — metric, target value, deadline. Founders see them in their hub and inside the weekly update flow.",
      beforeStep: go(`/program/${slug}/challenges`),
    },
    {
      target: '[data-tour="challenges-list"]',
      title: "Manage each challenge",
      body: "Edit, archive or track completion per challenge, and see how many startups are on pace.",
    },
    {
      target: '[data-tour="network-mentors"]',
      title: "Mentor network",
      body: "Paste a LinkedIn profile — personal or company — and Ventura enriches it into a full mentor card with focus areas and a summary.",
      beforeStep: go(`/program/${slug}/network`),
    },
    {
      target: '[data-tour="network-investors"]',
      title: "Investor network",
      body: "Same for investors and funds. Use 'Match with cohort startups' to distribute your network across the portfolio — founders then see them crowned as the #1 match.",
    },
    {
      target: '[data-tour="comm-inbox"]',
      title: "Inbox",
      body: "Private threads with each startup: intro requests, questions and your replies, all in one conversation.",
      beforeStep: go(`/program/${slug}/communication`),
    },
    {
      target: '[data-tour="comm-announcements"]',
      title: "Announcements",
      body: "Broadcast to the whole cohort. Announcements land in every founder's program hub.",
    },
    {
      target: '[data-tour="comm-events"]',
      title: "Events & deadlines",
      body: "Publish sessions, demo days and deadlines — they appear on the founders' hub and in the overview milestones.",
    },
    {
      target: '[data-tour="comm-documents"]',
      title: "Shared documents",
      body: "Templates, legal docs and program handbooks shared with the whole cohort.",
    },
    {
      target: '[data-tour="leaderboard-card"]',
      title: "Leaderboard",
      body: "A podium ranking of the cohort by XP, streak and consistency — great for a weekly stand-up moment.",
      beforeStep: go(`/program/${slug}/leaderboard`),
    },
    {
      target: '[data-tour="invites-card"]',
      title: "Invites",
      body: "Generate invitation links for new startups. Anyone who joins through the link is attached to your program automatically, even if they still need to sign up.",
      beforeStep: go(`/program/${slug}/approvals`),
    },
    {
      target: '[data-tour="program-settings"]',
      title: "Settings",
      body: "Program name, description, logo, accent colour and access. Changes propagate instantly to the dashboard and the founders' hub.",
    },
    {
      title: "That's the whole dashboard",
      body: "You can restart this walkthrough any time from the 'Guided tour' button in the header.",
      beforeStep: go(`/program/${slug}`),
    },
  ];

  return <ProductTour steps={steps} open={open} onClose={onClose} />;
}
