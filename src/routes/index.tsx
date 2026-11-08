import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Info, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { AppChrome } from "@/components/app/AppChrome";
import { SiteHeader } from "@/components/app/SiteHeader";
import { AudienceStep, type AudienceDraft } from "@/components/studio/AudienceStep";
import { DataStep } from "@/components/studio/DataStep";
import { GenerateStep } from "@/components/studio/GenerateStep";
import { avatarLocation } from "@/lib/engine/avatars";
import { customerSlug } from "@/lib/state/account-context";
import { useDataset } from "@/lib/state/dataset-store";
import { usePreferences } from "@/lib/state/preferences-store";

type Step = 1 | 2 | 3;

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { step?: Step } => {
    const n = Number(s.step);
    return n === 2 || n === 3 ? { step: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Report studio - Lindström customer value reviews" },
      {
        name: "description",
        content: "Upload up to three data files, choose the company, the person you are meeting and where they work, and get a visual Recap of the value Lindström delivered.",
      },
      { property: "og:title", content: "Report studio - Lindström customer value reviews" },
      { property: "og:description", content: "Data files + company + role + locations = a five-question visual Recap and a full value dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Upload data" },
  { n: 2, label: "Company, role & locations" },
  { n: 3, label: "Create the report" },
];

const EMPTY: AudienceDraft = { customerId: null, roles: [], locations: [] };

function Studio() {
  const { dataset, loading, error } = useDataset();
  const prefs = usePreferences();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });

  const last = useMemo(
    () => prefs.customAvatars.find((a) => a.id === prefs.studioAvatarId && dataset?.customers.some((c) => c.id === a.customerId)) ?? null,
    [prefs.customAvatars, prefs.studioAvatarId, dataset],
  );
  const lastCustomer = last ? dataset?.customers.find((c) => c.id === last.customerId) : undefined;

  const [draft, setDraft] = useState<AudienceDraft>(EMPTY);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !prefs.hydrated || loading) return;
    if (last) setDraft({ customerId: last.customerId ?? null, roles: last.role.split(" & ").filter(Boolean), locations: last.locations ?? (last.country ? [last.country] : []) });
    else if (dataset?.customers.length === 1) setDraft({ ...EMPTY, customerId: dataset.customers[0].id });
    setSeeded(true);
  }, [seeded, prefs.hydrated, loading, last, dataset]);
  // A new upload may not contain the drafted company.
  useEffect(() => {
    if (draft.customerId && dataset && !dataset.customers.some((c) => c.id === draft.customerId)) setDraft(EMPTY);
  }, [dataset, draft.customerId]);

  const ready = !!draft.customerId && draft.roles.length > 0;
  const step: Step = !dataset ? 1 : search.step === 3 && !ready ? 2 : (search.step ?? 1);
  const go = useCallback((n: Step) => void navigate({ search: n === 1 ? {} : { step: n } }), [navigate]);

  if (loading || !prefs.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-lg text-lind-navy">
        <AppChrome />
        <Loader2 className="h-6 w-6 animate-spin" /> Opening the report studio…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppChrome />
      <SiteHeader
        strip="Report studio"
        right={
          last && lastCustomer ? (
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/account/$account/recap" params={{ account: customerSlug(lastCustomer) }}>
                Open the last report
              </Link>
            </Button>
          ) : null
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-lind-navy sm:text-4xl lg:whitespace-nowrap 2xl:text-5xl">Show your customer what Lindström did for them</h1>

        <nav aria-label="Steps">
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map((s) => {
              const done = s.n < step;
              const active = s.n === step;
              const reachable = s.n === 1 || (s.n === 2 && !!dataset) || (s.n === 3 && !!dataset && ready);
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => go(s.n)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 border-t-4 bg-card px-4 py-3 text-left shadow-lind transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active ? "border-lind-red" : done ? "border-lind-green" : "border-lind-line",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold",
                        done ? "bg-lind-green text-white" : active ? "bg-lind-navy text-white" : "bg-lind-mist text-lind-grey",
                      )}
                    >
                      {done ? <Check className="h-5 w-5" /> : s.n}
                    </span>
                    <span className="min-w-0">
                      <span className="eyebrow block text-lind-grey">Step {s.n}</span>
                      <span className={cn("block truncate text-base font-bold", active ? "text-lind-navy" : "text-lind-ink")}>{s.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {error && (
          <p role="alert" className="rounded-lg bg-lind-red/10 p-4 text-base text-lind-red">
            {error}
          </p>
        )}

        <section aria-label={STEPS[step - 1].label} className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-lind-navy">{step === 1 ? "Upload the customer's data" : step === 2 ? "Who is the report for?" : "Create the report"}</h2>
            {step === 1 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="info" size="icon-sm" aria-label="How your files are used">
                    <Info />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <p className="text-base leading-relaxed">
                    Files are read in this browser and are not sent to a server. Tables that appear in more than one file are combined, and repeated rows are
                    counted once. PDF tables are rebuilt from the position of each value, so the numbers stay exactly as exported. Scanned PDFs cannot be read.
                  </p>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {step === 1 && <DataStep onContinue={() => go(2)} />}
          {step === 2 && <AudienceStep draft={draft} onChange={setDraft} onBack={() => go(1)} onContinue={() => go(3)} />}
          {step === 3 && <GenerateStep draft={draft} onBack={() => go(2)} />}
        </section>

        {step === 1 && last && lastCustomer && dataset && (
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-lind-grey">Last report</p>
              <p className="truncate text-lg font-bold text-lind-navy">
                {last.role} · {lastCustomer.name}
              </p>
              <p className="truncate text-base text-lind-grey">{avatarLocation(last)}</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/account/$account/recap" params={{ account: customerSlug(lastCustomer) }}>
                Open its Recap <ArrowRight />
              </Link>
            </Button>
          </Card>
        )}
      </main>

      <footer className="border-t border-lind-line bg-card">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-sm leading-relaxed text-lind-grey sm:px-6">
          Data and reports stay in this browser. Calculated estimates and assumptions are labelled; researched rules are sourced summaries, not legal or tax advice.
        </div>
      </footer>
    </div>
  );
}
