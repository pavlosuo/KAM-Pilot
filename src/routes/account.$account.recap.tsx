import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, FileDown, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { useBackgroundResearch } from "@/components/avatar/backgroundResearch";
import { DeepLinkProvider, TargetLink } from "@/components/recap/DeepLink";
import { RecapStory, type RecapCover } from "@/components/recap/RecapStory";
import { preparedFor } from "@/lib/export/deck";
import { audienceLabel } from "@/lib/engine/avatars";
import { fmtNum } from "@/lib/engine/format";
import { useAccount } from "@/lib/state/account-context";

export const Route = createFileRoute("/account/$account/recap")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recap - your year with Lindström in five questions" },
      { name: "description", content: "A scrolling visual story of the money, water, energy and CO₂ Lindström saved, the risks ahead and the next steps - built from the customer's own data." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Recap - your year with Lindström in five questions" },
      { property: "og:description", content: "Five questions answered with the customer's own data: last year's value, risks, next steps and two role-specific answers." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecapPage,
});

function RecapPage() {
  const a = useAccount();
  const research = useBackgroundResearch(a.neutral ? undefined : a.avatar.id);
  // The same Recap the Presentation tab turns into slides.
  const { recap } = a;
  const m = a.model;
  const cover: RecapCover = {
    company: a.customer.name,
    logo: <CompanyLogo name={a.customer.name} domain={a.settings.companyDomain ?? a.customer.website} className="h-12 w-12" />,
    audience: preparedFor(a),
    scope: `${recap.scopeLabel} · ${fmtNum(recap.sitesInScope)} site${recap.sitesInScope === 1 ? "" : "s"}`,
    stats: recap.stats,
    research: research ? { state: research.state, country: research.country, rules: research.rules } : null,
  };
  const nextSteps = recap.chapters.find((c) => c.id === "next")?.beats.find((b) => b.visual.kind === "steps")?.visual;
  const stepLinks = nextSteps?.kind === "steps" ? nextSteps.steps.map((s) => s.link) : [];

  const closing = (
    <section className="bg-lind-navy py-20 text-white" aria-label="Next steps">
      <div className="mx-auto w-full max-w-6xl space-y-12 px-5 sm:px-8">
        <h2 className="text-3xl font-bold leading-tight sm:text-4xl lg:whitespace-nowrap">{recap.closing.headline}</h2>
        <div>
          <div>
            <p className="eyebrow text-white/75">What we propose</p>
            <ol className="mt-4 space-y-3">
              {recap.closing.actions.map((t, i) => {
                const link = stepLinks[i];
                const body = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base font-bold text-lind-navy">{i + 1}</span>
                    <span className="min-w-0 flex-1 pt-1">{t}</span>
                    {link && <ChevronRight className="mt-1.5 h-5 w-5 shrink-0 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={t}>
                    {link ? (
                      <TargetLink target={link.to} title={`Open ${link.label}`} className="group flex gap-4 rounded-lg bg-white/10 p-4 text-lg transition-colors hover:bg-white/20 focus-visible:outline-2">
                        {body}
                      </TargetLink>
                    ) : (
                      <div className="flex gap-4 rounded-lg bg-white/10 p-4 text-lg">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" variant="secondary" asChild>
            <Link to="/account/$account" params={{ account: a.slug }}>
              <LayoutDashboard /> Open the full dashboard <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="border-white bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link to="/account/$account/review" params={{ account: a.slug }}>
              <FileDown /> Download as PowerPoint or PDF
            </Link>
          </Button>
        </div>
        <div className="space-y-3 border-t border-white/20 pt-6 text-sm leading-relaxed text-white/75">
          <p>{recap.disclosure}</p>
          {recap.sources.length > 0 && (
            <p>
              Everyday comparisons:{" "}
              {recap.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">
                    {s.label}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  if (!m.sites.length) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-3xl font-bold text-lind-navy">No sites match this audience's locations</h1>
        <p className="mt-3 text-lg text-lind-grey">Choose other locations for {audienceLabel(a.avatar)} to build the Recap.</p>
        <Button className="mt-6" asChild>
          <Link to="/account/$account/stakeholders" params={{ account: a.slug }}>
            Change locations
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <DeepLinkProvider slug={a.slug}>
      <RecapStory recap={recap} cover={cover} closing={closing} />
    </DeepLinkProvider>
  );
}
