import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

const SKILL_CATEGORIES: { category: string; skills: string[] }[] = [
  {
    category: "Business & Strategy",
    skills: ["Business Strategy", "Market Research", "Competitive Analysis", "Business Model Design", "Go-to-Market Strategy", "Pricing Strategy", "Market Sizing", "Strategic Partnerships", "Customer Segmentation", "Startup Validation"],
  },
  {
    category: "Fundraising & Finance",
    skills: ["Fundraising", "Investor Relations", "Pitch Deck Creation", "Financial Modeling", "Unit Economics", "Budgeting", "Grant Applications", "Venture Capital", "Angel Investment", "Revenue Forecasting"],
  },
  {
    category: "Sales & Business Development",
    skills: ["B2B Sales", "B2C Sales", "Lead Generation", "Cold Outreach", "CRM Management", "Sales Strategy", "Account Management", "Negotiation", "Customer Acquisition", "Partnership Sales"],
  },
  {
    category: "Marketing & Growth",
    skills: ["Growth Marketing", "Digital Marketing", "Social Media Marketing", "Content Marketing", "SEO", "Paid Ads", "Community Building", "Brand Strategy", "Influencer Marketing", "Email Marketing"],
  },
  {
    category: "Product & UX",
    skills: ["Product Management", "Product Design", "UX Research", "UI Design", "User Interviews", "Prototyping", "Feature Prioritization", "Product Roadmapping", "User Testing", "Design Thinking"],
  },
  {
    category: "Technology & Development",
    skills: ["Web Development", "Mobile Development", "Frontend Development", "Backend Development", "Full-Stack Development", "Database Design", "API Integration", "Cloud Infrastructure", "DevOps", "Cybersecurity"],
  },
  {
    category: "AI, Data & Automation",
    skills: ["Artificial Intelligence", "Machine Learning", "Data Analysis", "Data Visualization", "Predictive Analytics", "Natural Language Processing", "Computer Vision", "Automation", "Prompt Engineering", "AI Product Development"],
  },
  {
    category: "Operations & Execution",
    skills: ["Project Management", "Operations Management", "Process Optimization", "Team Coordination", "Remote Team Management", "Vendor Management", "Supply Chain Management", "Quality Assurance", "Customer Support", "Event Management"],
  },
  {
    category: "Leadership & Communication",
    skills: ["Leadership", "Team Building", "Public Speaking", "Pitching", "Storytelling", "Conflict Resolution", "Decision Making", "Mentoring", "Cross-functional Collaboration", "Stakeholder Management"],
  },
  {
    category: "Legal, Industry & Specialized Skills",
    skills: ["Legal Basics", "Intellectual Property", "Compliance", "Data Privacy", "Sustainability", "Healthcare Innovation", "FinTech", "EdTech", "Hardware Development", "Marketplace Building"],
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSkills: string[];
  onConfirm: (selected: string[]) => Promise<void> | void;
};

export function SkillPickerDialog({ open, onOpenChange, existingSkills, onConfirm }: Props) {
  const [activeCategory, setActiveCategory] = useState(SKILL_CATEGORIES[0].category);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const existingSet = useMemo(() => new Set(existingSkills), [existingSkills]);

  const toggle = (skill: string) => {
    if (existingSet.has(skill)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onConfirm(Array.from(selected));
      setSelected(new Set());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const active = SKILL_CATEGORIES.find((c) => c.category === activeCategory)!;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setSelected(new Set()); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 flex flex-col max-h-[85dvh] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
          <DialogTitle>Choose your skills</DialogTitle>
          <DialogDescription>
            Browse by category and tap to add. {selected.size > 0 && `${selected.size} selected.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Category sidebar */}
          <div className="md:w-56 shrink-0 md:border-r border-b md:border-b-0 overflow-x-auto md:overflow-y-auto">
            <div className="flex md:flex-col gap-1 p-2">
              {SKILL_CATEGORIES.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setActiveCategory(c.category)}
                  className={cn(
                    "whitespace-nowrap md:whitespace-normal text-left rounded-lg px-3 py-2 text-sm transition-colors shrink-0",
                    activeCategory === c.category
                      ? "bg-foreground text-background"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.category}
                </button>
              ))}
            </div>
          </div>

          {/* Skills grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="flex flex-wrap gap-2">
              {active.skills.map((skill) => {
                const isExisting = existingSet.has(skill);
                const isSelected = selected.has(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    disabled={isExisting}
                    onClick={() => toggle(skill)}
                    className={cn(
                      "group rounded-full border px-4 py-2 text-sm transition-all duration-200",
                      "flex items-center gap-1.5",
                      isExisting
                        ? "border-dashed border-muted-foreground/30 text-muted-foreground/60 cursor-not-allowed"
                        : isSelected
                          ? "border-foreground bg-foreground text-background scale-105 shadow-sm"
                          : "border-border hover:border-foreground/40 hover:scale-105",
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                    {skill}
                    {isExisting && <span className="text-[10px] uppercase tracking-wide">Added</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="px-6 py-3 border-t shrink-0 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).map((s) => (
                <Badge key={s} variant="secondary" className="rounded-full pr-1">
                  {s}
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Adding…" : selected.size > 0 ? `Add ${selected.size} skill${selected.size > 1 ? "s" : ""}` : "Done"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
