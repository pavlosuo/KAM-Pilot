import { useEffect, useState } from "react";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import type { ProfileBullet } from "@/design-system/ventura-6bef42/lib/investor-research.functions";

export function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</h2>
      <div className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

const LEGAL_SUFFIX = /\b(ltd|ltd\.|oy|oyj|ab|as|inc|inc\.|llc|gmbh|plc|bv|b\.v\.|sa|s\.a\.|group|holdings?)\b/gi;

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Company name for a track-record entry. */
function companyName(b: ProfileBullet): string {
  return (b.company ?? b.text.match(/\bat\s+([^,]+?)(?:,|$)/)?.[1] ?? "").trim();
}

/** Ordered company-name lookups to try for the logo. */
function logoNames(b: ProfileBullet): string[] {
  const list: string[] = [];
  const name = companyName(b);
  const cleanName = name.replace(/\([^)]*\)/g, "").replace(LEGAL_SUFFIX, "").replace(/[,\s]+$/, "").trim();
  if (cleanName.length >= 2) list.push(cleanName);
  if (name.trim().length >= 2 && name.trim() !== cleanName) list.push(name.trim());
  return [...new Set(list)];
}

function CompanyLogo({ bullet }: { bullet: ProfileBullet }) {
  const names = logoNames(bullet);
  const [index, setIndex] = useState(0);
  const nameLookup = names[index];
  const name = companyName(bullet);
  const initial = (name || bullet.text).trim().charAt(0).toUpperCase() || "•";

  useEffect(() => setIndex(0), [bullet.text, bullet.company]);

  if (bullet.logo_url) {
    return (
      <img
        src={bullet.logo_url}
        alt={`${titleCase(name || "Company")} logo`}
        loading="lazy"
        className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-border/60 bg-background object-contain"
      />
    );
  }

  if (!nameLookup) {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-xs font-semibold text-muted-foreground">
        {initial}
      </span>
    );
  }
  return (
    <img
      key={nameLookup}
      src={`/api/public/program-logo?name=${encodeURIComponent(nameLookup)}&size=96`}
      alt={`${titleCase(name || nameLookup)} logo`}
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
      className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-border/60 bg-background object-contain"
    />
  );
}

export function Bullets({ items, withLogos = false }: { items: ProfileBullet[]; withLogos?: boolean }) {
  return (
    <ul className="space-y-2.5">
      {items.map((b, i) => {
        const company = withLogos ? companyName(b) : "";
        const showCompany =
          company.length > 1 && !b.text.toLowerCase().includes(company.toLowerCase());
        return (
          <li key={`${b.text}-${i}`} className="flex gap-2.5 text-[15px] leading-relaxed">
            {withLogos ? (
              <CompanyLogo bullet={b} />
            ) : (
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <span className="text-foreground/90">
              {showCompany && (
                <span className="font-semibold text-foreground">{titleCase(company)} — </span>
              )}
              {b.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}


export function TagRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="rounded-full font-normal">
            {v}
          </Badge>
        ))}
      </div>
    </div>
  );
}
