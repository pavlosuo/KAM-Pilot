import { useState } from "react";
import { Building2 } from "lucide-react";
import { companyDomain } from "@/lib/company-domain";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

/** Company logo from Logo.dev for an explicit website/domain; neutral icon otherwise. */
export function CompanyLogo({ name, domain, className }: { name: string; domain?: string; className?: string }) {
  const hostname = companyDomain(domain);
  const [failed, setFailed] = useState<string | null>(null);
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY;
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-card", className)}>
      {key && hostname && failed !== hostname ? (
        <img
          src={`https://img.logo.dev/${hostname}?token=${key}&theme=light&format=png&fallback=404`}
          alt={`${name} logo`}
          className="h-full w-full object-contain"
          onError={() => setFailed(hostname)}
        />
      ) : (
        <Building2 className="h-5 w-5 text-lind-silver" aria-label={`${name}: logo unavailable`} />
      )}
    </span>
  );
}
