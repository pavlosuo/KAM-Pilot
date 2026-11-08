import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, FileSpreadsheet, Globe2, Loader2, MapPin, Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/design-system/ventura-6bef42/components/ui/switch";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { startBackgroundResearch } from "@/components/avatar/backgroundResearch";
import { buildAudience, resolveLocations } from "@/lib/avatar/audience";
import { researchCountry } from "@/lib/avatar/build";
import { avatarLocation } from "@/lib/engine/avatars";
import { fmtNum, fmtPeriod } from "@/lib/engine/format";
import { recapQuestions } from "@/lib/engine/recap";
import { buildReview } from "@/lib/engine/review";
import { customerSlug } from "@/lib/state/account-context";
import { useDataset } from "@/lib/state/dataset-store";
import { usePreferences } from "@/lib/state/preferences-store";
import type { Dataset } from "@/lib/data/types";
import type { AudienceDraft } from "./AudienceStep";

/** Step 3 - build the report for the chosen company, role and locations, then open its Recap. */
export function GenerateStep({ draft, onBack }: { draft: AudienceDraft; onBack: () => void }) {
  const { dataset, files } = useDataset();
  const prefs = usePreferences();
  const navigate = useNavigate();
  const [stage, setStage] = useState<number | null>(null);
  const customer = dataset?.customers.find((c) => c.id === draft.customerId) ?? null;

  const preview = useMemo(() => {
    if (!dataset || !customer) return null;
    const draftAvatar = buildAudience({ customer, roles: draft.roles, locations: draft.locations }, dataset);
    const previous = prefs.customAvatars.find((a) => a.id === draftAvatar.id) ?? null;
    const avatar = previous ? buildAudience({ customer, roles: draft.roles, locations: draft.locations }, dataset, previous) : draftAvatar;
    const s = prefs.customerSettings(customer.id);
    const today = new Date();
    const review = buildReview(dataset, customer, avatar, { from: s.from, to: s.to, baselineId: s.baselineId, scenario: s.scenario, productIds: s.productIds, promptWeights: null }, prefs.assumptions, today);
    const questions = recapQuestions({
      model: review.model,
      dataset,
      plan: review.plan,
      observations: review.observations,
      avatar,
      weights: review.weights,
      brief: review.brief,
      scenario: s.scenario,
      today,
      locationLabel: avatarLocation(avatar),
    });
    return { avatar, review, questions, country: researchCountry(avatar, dataset) };
  }, [dataset, customer, draft, prefs]);

  const [research, setResearch] = useState(true);
  if (!dataset || !customer || !preview) return null;
  const { avatar, review, questions, country } = preview;
  const sites = companySitesCount(dataset, customer.id, draft.locations);
  const months = review.months;
  const researched = avatar.brief?.generatedAt?.slice(0, 10);

  const stages = [
    `Checked ${files.length > 1 ? `${files.length} files` : dataset.meta.sourceName}`,
    `Focused on ${fmtNum(review.model.sites.length)} site${review.model.sites.length === 1 ? "" : "s"} in ${avatarLocation(avatar)}`,
    `Chose the questions for ${avatar.role}`,
    research ? `Started looking up ${country}'s climate, tax and reporting rules` : "Prepared the five answers",
  ];

  const generate = () => {
    if (stage !== null) return;
    prefs.upsertAvatar(avatar);
    prefs.updateCustomer(customer.id, { avatarId: avatar.id, countries: [], pickedObservationIds: null, prompt: null });
    prefs.setStudioAvatar(avatar.id);
    if (research) startBackgroundResearch(avatar, dataset, (brief) => prefs.patchAvatar(avatar.id, { brief }));
    setStage(0);
    stages.forEach((_, i) => window.setTimeout(() => setStage(i + 1), 420 * (i + 1)));
    window.setTimeout(() => void navigate({ to: "/account/$account/recap", params: { account: customerSlug(customer) } }), 420 * stages.length + 450);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="space-y-5 p-6">
          <p className="eyebrow text-lind-grey">The report is for</p>
          <div className="flex items-center gap-4">
            <CompanyLogo name={customer.name} domain={prefs.customers[customer.id]?.companyDomain ?? customer.website} className="h-14 w-14 border border-lind-line" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-lind-navy">{customer.name}</p>
              <p className="text-base text-lind-grey">{customer.industry}</p>
            </div>
          </div>
          <dl className="space-y-3 text-base">
            <div className="flex gap-3">
              <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-lind-blue" />
              <div>
                <dt className="sr-only">Role</dt>
                <dd className="font-semibold">{avatar.role}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-lind-blue" />
              <div>
                <dt className="sr-only">Locations</dt>
                <dd>
                  <span className="font-semibold">{draft.locations.length ? draft.locations.join(", ") : "All locations"}</span> · {fmtNum(sites)} sites
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-lind-blue" />
              <div className="min-w-0">
                <dt className="sr-only">Data</dt>
                <dd>
                  <span className="font-semibold break-all">{dataset.meta.sourceName}</span>
                  {months.length ? ` · ${fmtPeriod(months[0], months[months.length - 1])}` : ""}
                </dd>
              </div>
            </div>
          </dl>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-lind-mist p-4">
            <Switch checked={research} onCheckedChange={setResearch} aria-label={`Look up ${country}'s rules`} className="mt-0.5" />
            <span className="text-base">
              <span className="flex items-center gap-2 font-semibold text-lind-ink">
                <Globe2 className="h-4 w-4 text-lind-blue" /> {researched ? `Refresh ${country}'s rules` : `Look up ${country}'s rules on the web`}
              </span>
              <span className="mt-1 block text-sm text-lind-grey">
                CO₂ prices, tax benefits and reporting deadlines are added to the risks and next steps when ready (about a minute, in the background).
                {researched ? ` Last looked up ${researched}.` : ""}
              </span>
            </span>
          </label>
        </Card>

        <Card className="p-6">
          <p className="flex items-center gap-2 text-lg font-bold text-lind-navy">
            <Sparkles className="h-5 w-5 text-lind-red" /> Your Recap will answer five questions
          </p>
          <ol className="mt-5 space-y-3">
            {questions.map((q, i) => (
              <li key={q.question} className="flex items-start gap-4">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold", i < 3 ? "bg-lind-navy text-white" : "bg-lind-red text-white")}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold leading-snug text-lind-ink">{q.question}</span>
                  <span className="block text-sm text-lind-grey">{q.label}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-lind-grey">Questions 1–3 are asked for every Lindström customer. Questions 4 and 5 are chosen for this role and this company.</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <Button size="lg" onClick={generate} disabled={stage !== null}>
          Create the report
        </Button>
      </Card>

      <AnimatePresence>
        {stage !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-lind-navy/60 p-4"
            role="status"
            aria-live="polite"
          >
            <motion.div initial={{ y: 12 }} animate={{ y: 0 }} className="w-full min-w-0 max-w-md rounded-lg bg-card p-6 shadow-lind">
              <p className="break-words text-lg font-bold text-lind-navy">Preparing the report for {avatar.role}</p>
              <p className="break-words text-base text-lind-grey">
                {customer.name} · {avatarLocation(avatar)}
              </p>
              <ul className="mt-5 space-y-3">
                {stages.map((s, i) => (
                  <li key={s} className={cn("flex min-w-0 items-start gap-3 text-base transition-opacity", i > stage ? "opacity-40" : "opacity-100")}>
                    {i < stage ? (
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-lind-green" />
                    ) : i === stage ? (
                      <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-lind-blue" />
                    ) : (
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-lind-line" />
                    )}
                    <span className="min-w-0 flex-1 wrap-anywhere">{s}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function companySitesCount(ds: Dataset, customerId: string, locations: string[]): number {
  const sites = ds.sites.filter((s) => s.customerId === customerId);
  if (!locations.length) return sites.length;
  return resolveLocations(locations, sites).siteIds.length || sites.length;
}
