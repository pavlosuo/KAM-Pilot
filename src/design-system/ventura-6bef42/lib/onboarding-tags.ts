import type { TagCategory } from "@/design-system/ventura-6bef42/components/onboarding/TagPickerDialog";

/** Sector / industry tags, grouped like the founder skills picker. */
export const SECTOR_CATEGORIES: TagCategory[] = [
  {
    category: "Software & AI",
    tags: [
      "SaaS",
      "B2B Software",
      "Developer Tools",
      "Artificial Intelligence",
      "Machine Learning",
      "Data & Analytics",
      "Cybersecurity",
      "Cloud Infrastructure",
      "Automation",
    ],
  },
  {
    category: "Money & Markets",
    tags: [
      "Fintech",
      "Payments",
      "Insurtech",
      "Banking",
      "Crypto & Blockchain",
      "Marketplace",
      "E-commerce",
      "Retail",
      "PropTech",
    ],
  },
  {
    category: "Science & Health",
    tags: [
      "HealthTech",
      "MedTech",
      "BioTech",
      "Pharma",
      "Digital Health",
      "Deep Tech",
      "Quantum",
      "SpaceTech",
      "Materials",
    ],
  },
  {
    category: "Industry & Climate",
    tags: [
      "ClimateTech",
      "Energy",
      "CleanTech",
      "Mobility",
      "Logistics",
      "Supply Chain",
      "Manufacturing",
      "Robotics",
      "AgriTech",
      "FoodTech",
    ],
  },
  {
    category: "Consumer & Media",
    tags: [
      "Consumer Apps",
      "Social",
      "Creator Economy",
      "Gaming",
      "Media & Entertainment",
      "TravelTech",
      "SportsTech",
      "FashionTech",
      "Wellness",
    ],
  },
  {
    category: "Work & Society",
    tags: [
      "EdTech",
      "HRTech",
      "Future of Work",
      "LegalTech",
      "GovTech",
      "Public Sector",
      "Non-profit & Impact",
      "Real Estate",
      "Construction",
    ],
  },
];

/** Every sector Ventura offers, flattened. */
export const ALL_SECTOR_TAGS: string[] = SECTOR_CATEGORIES.flatMap((c) => c.tags);

/**
 * Special sector option for investors: it puts *every* sector in range, so it
 * replaces any specific picks instead of sitting next to them.
 */
export const SECTOR_AGNOSTIC = "Sector agnostic";

/** Sector list with the agnostic option on top, used by the investor picker. */
export const INVESTOR_SECTOR_CATEGORIES: TagCategory[] = [
  { category: "Any sector", tags: [SECTOR_AGNOSTIC] },
  ...SECTOR_CATEGORIES,
];

/** True when the person is open to every sector. */
export function isSectorAgnostic(tags: readonly string[] | null | undefined): boolean {
  return Array.isArray(tags) && tags.includes(SECTOR_AGNOSTIC);
}

/**
 * Sectors the person actually covers. The agnostic option expands to every
 * sector, so matching never has to special-case it.
 */
export function sectorRange(tags: readonly string[] | null | undefined): string[] {
  return isSectorAgnostic(tags) ? ALL_SECTOR_TAGS : (tags ?? []).filter((t) => t !== SECTOR_AGNOSTIC);
}

/**
 * Keep the agnostic option exclusive: switching it on drops the specific
 * sectors, and picking a specific sector switches it back off.
 */
export function applySectorAgnostic(
  previous: readonly string[],
  next: readonly string[],
): string[] {
  const had = previous.includes(SECTOR_AGNOSTIC);
  const has = next.includes(SECTOR_AGNOSTIC);
  if (has && !had) return [SECTOR_AGNOSTIC];
  if (has && had) return next.filter((t) => t !== SECTOR_AGNOSTIC);
  return [...next];
}

/** What a coach can help founders with. */
export const COACHING_AREA_CATEGORIES: TagCategory[] = [
  {
    category: "Money",
    tags: [
      "Fundraising",
      "Investor Relations",
      "Pitch & Storytelling",
      "Financial Modeling",
      "Unit Economics",
      "Grants & Public Funding",
      "Finance & Accounting",
    ],
  },
  {
    category: "Revenue",
    tags: [
      "Sales",
      "B2B Sales",
      "Go-to-Market",
      "Pricing",
      "Partnerships",
      "Customer Success",
      "International Expansion",
    ],
  },
  {
    category: "Marketing",
    tags: [
      "Marketing",
      "Growth",
      "Brand",
      "Content",
      "SEO",
      "Paid Acquisition",
      "Community",
      "PR",
    ],
  },
  {
    category: "Product & Tech",
    tags: [
      "Product",
      "Product Management",
      "UX & Design",
      "User Research",
      "Tech",
      "Engineering Leadership",
      "AI",
      "Data",
      "Hardware",
    ],
  },
  {
    category: "People & Ops",
    tags: [
      "Hiring",
      "Leadership",
      "Team Building",
      "Culture",
      "Operations",
      "Process & Systems",
      "Co-founder Dynamics",
      "Founder Wellbeing",
    ],
  },
  {
    category: "Legal & Governance",
    tags: [
      "Legal",
      "Contracts",
      "Intellectual Property",
      "Compliance",
      "Data Privacy",
      "Cap Table & Equity",
      "Board & Governance",
    ],
  },
];

/** Founder problems a coach is especially good at solving. */
export const FOUNDER_PROBLEM_CATEGORIES: TagCategory[] = [
  {
    category: "Finding the market",
    tags: [
      "Validating an idea",
      "Finding first customers",
      "Nailing the ICP",
      "Talking to users",
      "Positioning & messaging",
    ],
  },
  {
    category: "Growing revenue",
    tags: [
      "Closing the first deals",
      "Building a sales process",
      "Getting out of flat growth",
      "Pricing and packaging",
      "Entering a new market",
    ],
  },
  {
    category: "Raising money",
    tags: [
      "Getting investor meetings",
      "Fixing the pitch",
      "Choosing the right round",
      "Negotiating terms",
      "Investor updates",
    ],
  },
  {
    category: "Building the team",
    tags: [
      "First hires",
      "Co-founder conflict",
      "Delegating as a founder",
      "Setting goals & focus",
      "Burnout and pace",
    ],
  },
  {
    category: "Building the product",
    tags: [
      "Scoping an MVP",
      "Prioritising the roadmap",
      "Shipping faster",
      "Technical architecture",
      "Turning AI into a product",
    ],
  },
];
