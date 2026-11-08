import { ArrowLeft, ArrowRight, Building2, Check, MapPin, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { locationOptions, resolveLocations, roleSuggestions } from "@/lib/avatar/audience";
import { fmtNum } from "@/lib/engine/format";
import { useDataset } from "@/lib/state/dataset-store";
import { usePreferences } from "@/lib/state/preferences-store";
import { AddOwnChip, Chip } from "./Chip";

export interface AudienceDraft {
  customerId: string | null;
  roles: string[];
  locations: string[];
}

function Section({ n, icon: Icon, title, children, disabled }: { n: number; icon: typeof Building2; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <Card className={cn("p-6", disabled && "pointer-events-none opacity-50")} aria-disabled={disabled}>
      <h3 className="mb-4 flex items-center gap-3 text-xl font-bold text-lind-navy">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lind-navy text-base text-white">{n}</span>
        <Icon className="h-5 w-5 text-lind-grey" />
        {title}
      </h3>
      {children}
    </Card>
  );
}

const toggle = (list: string[], v: string) => (list.some((x) => x.toLowerCase() === v.toLowerCase()) ? list.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...list, v]);
const has = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());

/** Step 2 - company, the role of the person the KAM meets, and the locations they work in. */
export function AudienceStep({ draft, onChange, onBack, onContinue }: { draft: AudienceDraft; onChange: (d: AudienceDraft) => void; onBack: () => void; onContinue: () => void }) {
  const { dataset } = useDataset();
  const prefs = usePreferences();
  const [showCities, setShowCities] = useState(false);
  const customers = dataset?.customers ?? [];
  const customer = customers.find((c) => c.id === draft.customerId) ?? null;

  const siteCounts = useMemo(() => {
    const m = new Map<string, { sites: number; countries: Set<string> }>();
    for (const s of dataset?.sites ?? []) {
      const v = m.get(s.customerId) ?? { sites: 0, countries: new Set<string>() };
      v.sites++;
      v.countries.add(s.country);
      m.set(s.customerId, v);
    }
    return m;
  }, [dataset]);

  const suggestions = useMemo(() => (customer ? roleSuggestions(customer) : []), [customer]);
  const ownRoles = draft.roles.filter((r) => !suggestions.some((s) => s.role.toLowerCase() === r.toLowerCase()));
  const locs = useMemo(() => (dataset && customer ? locationOptions(dataset, customer.id) : { countries: [], cities: [] }), [dataset, customer]);
  const known = new Set([...locs.countries, ...locs.cities].map((l) => l.value.toLowerCase()));
  const ownLocations = draft.locations.filter((l) => !known.has(l.toLowerCase()));
  const companySites = useMemo(() => (dataset && customer ? dataset.sites.filter((s) => s.customerId === customer.id) : []), [dataset, customer]);
  const resolved = useMemo(() => resolveLocations(draft.locations, companySites), [draft.locations, companySites]);
  const scopeSites = draft.locations.length && resolved.siteIds.length ? resolved.siteIds.length : companySites.length;

  if (!dataset) return null;

  const pickCompany = (id: string) => onChange({ customerId: id, roles: id === draft.customerId ? draft.roles : [], locations: id === draft.customerId ? draft.locations : [] });

  return (
    <div className="space-y-5">
      <Section n={1} icon={Building2} title="Which company?">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Company">
          {customers.map((c) => {
            const sel = c.id === draft.customerId;
            const counts = siteCounts.get(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => pickCompany(c.id)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-3 rounded-lg border-2 bg-card p-4 text-left transition-colors",
                  sel ? "border-lind-navy bg-lind-navy/5" : "border-lind-line hover:border-lind-navy/60",
                )}
              >
                <CompanyLogo name={c.name} domain={prefs.customers[c.id]?.companyDomain ?? c.website} className="h-12 w-12 border border-lind-line" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-lind-ink">{c.name}</span>
                  <span className="block truncate text-sm text-lind-grey">{c.industry}</span>
                  <span className="block truncate text-sm text-lind-grey">
                    {fmtNum(counts?.sites ?? 0)} sites · {fmtNum(counts?.countries.size ?? 0)} {counts?.countries.size === 1 ? "country" : "countries"}
                  </span>
                </span>
                {sel && (
                  <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-lind-navy text-white">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section n={2} icon={UserRound} title="Who are you meeting?" disabled={!customer}>
        {customer && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Role">
              {suggestions.map((s) => {
                const sel = has(draft.roles, s.role);
                return (
                  <button
                    key={s.role}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => onChange({ ...draft, roles: [s.role] })}
                    className={cn(
                      "relative flex cursor-pointer flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors",
                      sel ? "border-lind-navy bg-lind-navy text-white" : "border-lind-line bg-card hover:border-lind-navy/60",
                    )}
                  >
                    <span className={cn("text-base font-bold", sel ? "text-white" : "text-lind-ink")}>{s.role}</span>
                    <span className={cn("text-sm", sel ? "text-white/80" : "text-lind-grey")}>{s.hint}</span>
                    {sel && <Check className="absolute right-3 top-3 h-5 w-5" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {ownRoles.map((r) => (
                <Chip key={r} selected onClick={() => onChange({ ...draft, roles: [] })} onRemove={() => onChange({ ...draft, roles: [] })}>
                  {r}
                </Chip>
              ))}
              <AddOwnChip label="Add your own role" placeholder="e.g. Head of Purchasing" onAdd={(v) => onChange({ ...draft, roles: [v] })} />
            </div>
            <p className="mt-3 text-sm text-lind-grey">Pick one role - it decides which questions the Recap answers.</p>
          </>
        )}
      </Section>

      <Section n={3} icon={MapPin} title="Where do they work?" disabled={!customer || !draft.roles.length}>
        {customer && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip selected={!draft.locations.length} onClick={() => onChange({ ...draft, locations: [] })} meta={`${fmtNum(companySites.length)} sites`}>
                All locations
              </Chip>
              {locs.countries.map((l) => (
                <Chip key={l.value} selected={has(draft.locations, l.value)} onClick={() => onChange({ ...draft, locations: toggle(draft.locations, l.value) })} meta={`${l.sites} site${l.sites === 1 ? "" : "s"}`}>
                  {l.value}
                </Chip>
              ))}
              {ownLocations.map((l) => (
                <Chip key={l} selected onClick={() => onChange({ ...draft, locations: toggle(draft.locations, l) })} onRemove={() => onChange({ ...draft, locations: toggle(draft.locations, l) })} meta={resolved.unmatched.includes(l) ? "not in the data" : undefined}>
                  {l}
                </Chip>
              ))}
              <AddOwnChip label="Add your own location" placeholder="e.g. Tampere or Baltics" onAdd={(v) => !has(draft.locations, v) && onChange({ ...draft, locations: [...draft.locations, v] })} />
            </div>

            {locs.cities.length > 0 && (
              <div className="mt-4">
                <Button variant="link" onClick={() => setShowCities((v) => !v)} aria-expanded={showCities}>
                  {showCities ? "Hide cities" : `Choose cities instead (${locs.cities.length})`}
                </Button>
                {showCities && (
                  <div className="mt-3 space-y-3">
                    {locs.countries.map((country) => {
                      const cities = locs.cities.filter((c) => c.country === country.value);
                      if (!cities.length) return null;
                      return (
                        <div key={country.value}>
                          <p className="eyebrow mb-2 text-lind-grey">{country.value}</p>
                          <div className="flex flex-wrap gap-2">
                            {cities.map((c) => (
                              <Chip key={`${c.country}-${c.value}`} selected={has(draft.locations, c.value)} onClick={() => onChange({ ...draft, locations: toggle(draft.locations, c.value) })}>
                                {c.value}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {resolved.unmatched.length > 0 && (
              <p className="mt-3 text-sm text-lind-grey">
                {resolved.unmatched.join(", ")} {resolved.unmatched.length === 1 ? "is" : "are"} not in the uploaded data, so {resolved.unmatched.length === 1 ? "it is" : "they are"} shown as a label only
                {resolved.siteIds.length ? "" : " and the report covers all sites"}.
              </p>
            )}
          </>
        )}
      </Section>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <p className="min-w-0 flex-1 text-base text-lind-ink">
          {customer && draft.roles.length ? (
            <>
              Report for <strong>{draft.roles.join(" & ")}</strong> at <strong>{customer.name}</strong> · {draft.locations.length ? draft.locations.join(", ") : "all locations"} ({fmtNum(scopeSites)} sites)
            </>
          ) : (
            <span className="text-lind-grey">Choose a company and at least one role.</span>
          )}
        </p>
        <Button size="lg" onClick={onContinue} disabled={!customer || !draft.roles.length}>
          Continue <ArrowRight />
        </Button>
      </Card>
    </div>
  );
}
