import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/design-system/ventura-6bef42/hooks/use-language";
import { useCookieConsent } from "@/design-system/ventura-6bef42/hooks/use-cookie-consent";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";

export function Footer() {
  const { t } = useLanguage();
  const { open } = useCookieConsent();
  const { user } = useAuth();
  if (user) return null;
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "auto" });
  const founderLink = user ? "/profile" : "/auth";
  const founderLabel = user ? t("My profile", "Oma profiili") : t("Join as a founder", "Liity perustajana");
  const navLinks: Array<{ to: string; label: string }> = [
    { to: "/", label: t("Home", "Koti") },
    { to: "/problem", label: t("Problem", "Ongelma") },
    { to: "/solution", label: t("Solution", "Ratkaisu") },
    { to: "/how-it-works", label: t("How it works", "Miten se toimii") },
    { to: "/faq", label: t("FAQ", "UKK") },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* Brand */}
          <div>
            <div className="text-2xl font-semibold tracking-tight">Ventura</div>
            <p className="mt-1 text-sm text-muted-foreground">{t("Redefine the startup discovery.", "Määrittele startup-löytäminen uudelleen.")}</p>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-8 sm:flex sm:flex-row sm:gap-16">
            <div>
              <div className="mb-3 text-sm font-semibold text-foreground">{t("Pages", "Sivut")}</div>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                {navLinks.map((l) => (
                  <Link key={l.to} to={l.to} onClick={scrollTop} className="hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-foreground">{t("Legal", "Lakiasiat")}</div>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/contact" onClick={scrollTop} className="hover:text-foreground transition-colors">{t("Contact us", "Ota yhteyttä")}</Link>
                <Link to="/privacy" onClick={scrollTop} className="hover:text-foreground transition-colors">{t("Privacy policy", "Tietosuojakäytäntö")}</Link>
                <Link to="/terms" onClick={scrollTop} className="hover:text-foreground transition-colors">{t("Terms of Service", "Käyttöehdot")}</Link>
                <button type="button" onClick={open} className="text-left hover:text-foreground transition-colors cursor-pointer">
                  {t("Cookie Preferences", "Evästeasetukset")}
                </button>
              </nav>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold text-foreground">{t("Join us", "Liity mukaan")}</div>
              <div className="flex flex-col gap-2 items-start">
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/investor-waitlist" onClick={scrollTop}>{t("Apply for the beta", "Hae beta-mukaan")}</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <Link to={founderLink} onClick={scrollTop}>{founderLabel}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Ventura. {t("All rights reserved.", "Kaikki oikeudet pidätetään.")}</div>
          <div className="flex flex-wrap gap-6">
            <Link to="/privacy" onClick={scrollTop} className="hover:text-foreground">{t("Privacy policy", "Tietosuojakäytäntö")}</Link>
            <button type="button" onClick={open} className="hover:text-foreground cursor-pointer">
              {t("Cookie Preferences", "Evästeasetukset")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
