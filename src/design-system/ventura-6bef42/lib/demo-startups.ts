export type DemoStartup = {
  slug: string;
  name: string;
  founder: string;
  tagline: string;
  industry: string;
  stage: string;
  location: string;
  story: string;
  traction: string;
  asking: string;
  logoColor: string;
  avatar: string;
};

export const AVATARS = [
  "/avatars/p1.jpeg",
  "/avatars/p2.jpeg",
  "/avatars/p3.jpg",
  "/avatars/p4.jpg",
  "/avatars/p5.jpg",
];

export const DEMO_STARTUPS: DemoStartup[] = [
  {
    slug: "lumen-ai",
    name: "Lumen AI",
    founder: "Maya Chen",
    tagline: "Autonomous research agents for biotech labs.",
    industry: "AI / ML",
    stage: "Seed",
    location: "Helsinki, Finland",
    story:
      "After 6 years at a top genomics lab, Maya watched scientists waste 40% of their time on literature review. Lumen builds agents that read, synthesize, and propose experiments in minutes.",
    traction: "12 paying labs · $38k MRR · 22% MoM growth",
    asking: "Raising $3M seed to expand the agent platform and hire 2 ML engineers.",
    logoColor: "from-indigo-500 to-violet-500",
    avatar: "/avatars/p3.jpg",
  },
  {
    slug: "northwind-pay",
    name: "Northwind Pay",
    founder: "Daniel Okafor",
    tagline: "Cross-border payouts for African creators in 60 seconds.",
    industry: "Fintech",
    stage: "Pre-seed",
    location: "Tampere, Finland",
    story:
      "Daniel ran payroll for a remote studio of 40 creators across 8 countries. Existing rails took 5 days and cost 9%. Northwind moves money in under a minute at 1.2%.",
    traction: "4,200 users · $1.1M processed last month",
    asking: "Raising $800k pre-seed for licensing and a 4-person team.",
    logoColor: "from-emerald-500 to-teal-500",
    avatar: "/avatars/p1.jpeg",
  },
  {
    slug: "atlas-health",
    name: "Atlas Health",
    founder: "Priya Raman",
    tagline: "AI co-pilot for primary-care physicians.",
    industry: "Healthtech",
    stage: "Series A",
    location: "Turku, Finland",
    story:
      "Priya is a practicing physician who built Atlas to cut 2 hours of daily charting. The product drafts visit notes, orders, and follow-ups from ambient audio.",
    traction: "180 clinics · $1.4M ARR · NPS 71",
    asking: "Raising $12M Series A to expand into specialty care.",
    logoColor: "from-sky-500 to-blue-500",
    avatar: "/avatars/p5.jpg",
  },
  {
    slug: "verdant-grid",
    name: "Verdant Grid",
    founder: "Lukas Berg",
    tagline: "Software that lets factories trade unused renewable energy.",
    industry: "Climate",
    stage: "Seed",
    location: "Oulu, Finland",
    story:
      "Lukas spent a decade in industrial energy. Factories waste 18% of solar output. Verdant turns that surplus into a real-time marketplace between neighboring plants.",
    traction: "9 pilots signed · 2 paid · €120k ARR",
    asking: "Raising €2.5M seed to roll out across DACH.",
    logoColor: "from-lime-500 to-emerald-500",
    avatar: "/avatars/p2.jpeg",
  },
  {
    slug: "loop-devtools",
    name: "Loop",
    founder: "Sara Kim",
    tagline: "Replay-based debugging for distributed systems.",
    industry: "Devtools",
    stage: "Pre-seed",
    location: "Espoo, Finland",
    story:
      "Sara led infra at two unicorns. Loop records production traces and lets engineers step through any past request like a local debugger.",
    traction: "Closed beta with 14 teams · 3 paid design partners",
    asking: "Raising $1.2M pre-seed to ship GA.",
    logoColor: "from-fuchsia-500 to-pink-500",
    avatar: "/avatars/p4.jpg",
  },
];

export const INDUSTRIES = Array.from(new Set(DEMO_STARTUPS.map((s) => s.industry)));
export const STAGES = Array.from(new Set(DEMO_STARTUPS.map((s) => s.stage)));
export const LOCATIONS = Array.from(new Set(DEMO_STARTUPS.map((s) => s.location)));
