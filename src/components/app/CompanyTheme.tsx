import { useEffect } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { companyPalette, validBrandColor } from "@/lib/branding";
import { useAccount } from "@/lib/state/account-context";
import { companyDomain } from "@/lib/company-domain";

/** Sets the customer's accent colour on the document (portaled menus inherit it). */
export function useCompanyTheme(name: string, override?: string) {
  useEffect(() => {
    const palette = companyPalette(name, override);
    const root = document.documentElement;
    root.style.setProperty("--company-secondary", palette.accent);
    root.dataset.companyTheme = name;
    return () => {
      root.style.removeProperty("--company-secondary");
      delete root.dataset.companyTheme;
    };
  }, [name, override]);
}

export function CompanyBrandControl() {
  const { customer, settings, update } = useAccount();
  const palette = companyPalette(customer.name, settings.brandColor);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Company logo and colour" title="Company logo and colour">
          <Palette />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <p className="font-bold text-lind-navy">{customer.name}</p>
          <div className="space-y-1.5">
            <Label htmlFor="company-domain">Company website (for the logo)</Label>
            <Input
              id="company-domain"
              placeholder="company.com"
              defaultValue={settings.companyDomain ?? customer.website ?? ""}
              onBlur={(e) => {
                const domain = companyDomain(e.target.value);
                if (domain || !e.target.value.trim()) update({ companyDomain: domain ?? "" });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-brand">Company accent colour</Label>
            <Input
              id="company-brand"
              type="color"
              value={palette.accent}
              onChange={(e) => {
                if (validBrandColor(e.target.value)) update({ brandColor: e.target.value });
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {settings.brandColor ? "Saved in this browser. Used for the accent line and the Recap cover." : "Used for the accent line and the Recap cover."}
          </p>
          <Button variant="outline" size="sm" onClick={() => update({ brandColor: undefined })}>
            Reset colour
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
