import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { useAccount } from "@/lib/state/account-context";

const STEPS = [
  { path: "recap", target: '[data-tour="nav-recap"]', title: "Recap first", text: "Open the meeting with this scrolling story: five questions answered with the customer's data - last year's value, risks, next steps and two answers for this role and company." },
  { path: "", target: "main", title: "Your overview", text: "Start with the customer’s impact, service health and highest-priority opportunities." },
  { path: "", target: '[data-tour="control-bar"]', title: "Period, scope & comparisons", text: "Change the dates, the comparison baseline and low/base/high estimates. Every page uses the same selection; locations come from the chosen person." },
  { path: "", target: '[data-tour="avatar-switch"]', title: "Who the review is for", text: "Switch between saved stakeholders to reorder priorities and apply their location and researched rules." },
  { path: "", target: '[data-tour="priority-prompt"]', title: "Set the priority", text: "Describe the decision or goal you want this review to focus on." },
  { path: "sites", target: "main", title: "Sites", text: "Compare sites using the map, table and country totals. Open a site to inspect its trends and RFID garment history." },
  { path: "impact", target: "main", title: "Footprint & handprint", text: "Compare the allocated footprint with estimated avoided impact, repairs, waste routes and alternative-service scenarios." },
  { path: "insights", target: "main", title: "Insights & actions", text: "Review evidence-backed recommendations, owners, steering questions and garment rebalancing opportunities." },
  { path: "rules", target: "main", title: "Country rules", text: "Explore sourced country findings, deadlines and links to the customer’s figures. Illustrative carbon values are not tax savings or legal advice." },
  { path: "stakeholders", target: "main", title: "People", text: "Edit or research the people you report to. Export and import them to share these browser-local profiles." },
  { path: "rehearsal", target: "main", title: "Meeting rehearsal", text: "Practise the review with an AI stakeholder and receive feedback on the credibility of your answers." },
  { path: "review", target: "main", title: "Customer report", text: "Choose report sections and observations, add meeting notes, and download an editable PowerPoint or PDF." },
  { path: "trust", target: "main", title: "Trust center", text: "Inspect sources, reconciliation checks, assumptions and limitations. Upload replacement data or download the methodology." },
  { path: "", target: '[data-tour="assistant"]', title: "Value assistant", text: "Ask questions grounded in the selected customer, stakeholder and country research." },
  { path: "", target: '[data-tour="company-brand"]', title: "Company colours", text: "Set the company’s brand colour here. It is used as the accent next to Lindström blue." },
] as const;

export function DashboardGuide() {
  const { slug } = useAccount();
  const navigate = useNavigate();
  const [step, setStep] = useState<number | null>(null);
  const current = step === null ? null : STEPS[step];
  useEffect(() => {
    if (!current) return;
    let target: Element | null = null;
    let cancelled = false;
    let frame = 0;
    void navigate({ to: `/account/${slug}${current.path ? `/${current.path}` : ""}` }).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        target = document.querySelector(current.target) ?? document.querySelector("main");
        target?.setAttribute("data-guide-active", "true");
        target?.scrollIntoView({ block: "nearest", behavior: "instant" });
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); target?.removeAttribute("data-guide-active"); };
  }, [current, navigate, slug]);

  return (
    <Popover open={step !== null} onOpenChange={(open) => setStep(open ? 0 : null)}>
      <PopoverTrigger asChild><Button variant="outline" size="sm"><Compass /> Guide</Button></PopoverTrigger>
      <PopoverContent align="end" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        {current && step !== null && <div className="space-y-4" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
            <Button variant="ghost" size="icon" aria-label="Close guide" onClick={() => setStep(null)}><X /></Button>
          </div>
          <h2 className="font-semibold">{current.title}</h2>
          <div className="text-sm text-muted-foreground">{current.text}</div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft /> Back</Button>
            <Button size="sm" onClick={() => setStep(step === STEPS.length - 1 ? null : step + 1)}>{step === STEPS.length - 1 ? "Finish" : "Next"}<ArrowRight /></Button>
          </div>
        </div>}
      </PopoverContent>
    </Popover>
  );
}