import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  BookOpenText,
  Building2,
  FileDown,
  Landmark,
  Leaf,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Loader2,
  MessageCircle,
  Plus,
  Presentation,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/design-system/ventura-6bef42/components/ui/sheet";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useCompanyTheme } from "@/components/app/CompanyTheme";
import { CompanyLogo } from "@/components/app/CompanyLogo";
import { AppChrome } from "@/components/app/AppChrome";
import { SiteHeader } from "@/components/app/SiteHeader";
import { AvatarSelector, ControlBar } from "@/components/review/ControlBar";
import { PeopleProvider, usePeople } from "@/components/people/PeopleProvider";
import { AssistantProvider, useAssistant } from "@/components/assistant/AssistantProvider";
import { AccountProvider, findCustomerBySlug, useAccount } from "@/lib/state/account-context";
import { useDataset } from "@/lib/state/dataset-store";
import { usePreferences } from "@/lib/state/preferences-store";
import { useDeepLinkFocus } from "@/lib/ui/use-deep-link-focus";

export const Route = createFileRoute("/account/$account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Customer value review - Lindström KAM workspace" },
      { name: "description", content: "Customer-level value, sustainability footprint and handprint with site drill-down for annual reviews." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Customer value review - Lindström KAM workspace" },
      { property: "og:description", content: "Customer-level value, sustainability footprint and handprint with site drill-down for annual reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountLayout,
});

function AccountLayout() {
  const { account } = Route.useParams();
  const { dataset, loading, error } = useDataset();
  const prefs = usePreferences();

  if (loading || !prefs.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-lg text-lind-navy">
        <AppChrome />
        <Loader2 className="h-6 w-6 animate-spin" /> Opening the report…
      </div>
    );
  }

  const customer = dataset ? findCustomerBySlug(dataset, account) : undefined;
  if (error || !dataset || !customer) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <AppChrome />
        <Card className="w-full max-w-md space-y-4 p-6">
          <h1 className="text-xl font-bold text-lind-navy">{error ? "Data could not be loaded" : !dataset ? "Upload customer data to continue" : "Account not found"}</h1>
          <p className="text-base text-lind-grey">{error ?? "Upload an Excel or PDF file in the report studio."}</p>
          <Button asChild variant="outline">
            <Link to="/">Open report studio</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <AccountProvider dataset={dataset} customer={customer}>
      <AssistantProvider>
        <PeopleProvider>
          <AccountShell />
        </PeopleProvider>
      </AssistantProvider>
    </AccountProvider>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  tour?: string;
}

/** Ventura MenuBar hover flip: the tab name flips over on hover (glow-menu.tsx pattern). */
const flipFront = { initial: { rotateX: 0, opacity: 1 }, hover: { rotateX: -90, opacity: 0 } };
const flipBack = { initial: { rotateX: 90, opacity: 0 }, hover: { rotateX: 0, opacity: 1 } };
const flipTransition = { type: "spring" as const, stiffness: 100, damping: 20, duration: 0.5 };

function AccountShell() {
  const { customer, slug, settings } = useAccount();
  useCompanyTheme(customer.name, settings.brandColor);
  const assistant = useAssistant();
  const people = usePeople();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useDeepLinkFocus();

  const base = `/account/${slug}`;
  const nav: NavItem[] = [
    { to: `${base}/recap`, label: "Recap", icon: BookOpenText, exact: false, tour: "nav-recap" },
    { to: base, label: "Overview", icon: LayoutDashboard, exact: true },
    { to: `${base}/sites`, label: "Sites", icon: Building2, exact: false },
    { to: `${base}/impact`, label: "Impact", icon: Leaf, exact: false },
    { to: `${base}/insights`, label: "Insights", icon: Lightbulb, exact: false },
    { to: `${base}/rules`, label: "Country rules", icon: Landmark, exact: false },
    { to: `${base}/stakeholders`, label: "People", icon: UsersRound, exact: false },
    { to: `${base}/rehearsal`, label: "Rehearsal", icon: Presentation, exact: false },
    { to: `${base}/review`, label: "Presentation", icon: FileDown, exact: false },
    { to: `${base}/trust`, label: "Trust center", icon: ShieldCheck, exact: false },
  ];
  const isActive = (n: NavItem) => (n.exact ? pathname === n.to || pathname === `${n.to}/` : pathname.startsWith(n.to));
  const recap = pathname.startsWith(`${base}/recap`);

  const tabs = (
    <nav aria-label="Report sections" className="border-t border-lind-line" data-tour="nav">
      <ul className="mx-auto hidden w-full max-w-7xl gap-1 overflow-x-auto px-2 sm:flex sm:px-4">
        {nav.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.label} className="shrink-0">
              <Link
                to={item.to}
                data-tour={item.tour}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center px-2.5 text-base font-semibold transition-colors xl:px-3",
                  active ? "text-lind-navy" : "text-lind-grey hover:text-lind-navy",
                )}
              >
                <motion.span className="relative block overflow-visible" style={{ perspective: "600px" }} whileHover="hover" initial="initial">
                  <motion.span
                    className="relative z-10 flex items-center gap-2"
                    variants={flipFront}
                    transition={flipTransition}
                    style={{ transformStyle: "preserve-3d", transformOrigin: "center bottom" }}
                  >
                    <item.icon className="hidden h-4 w-4 xl:block" />
                    {item.label}
                  </motion.span>
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 z-10 flex items-center gap-2"
                    variants={flipBack}
                    transition={flipTransition}
                    style={{ transformStyle: "preserve-3d", transformOrigin: "center top", rotateX: 90 }}
                  >
                    <item.icon className="hidden h-4 w-4 xl:block" />
                    {item.label}
                  </motion.span>
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppChrome />
      <SiteHeader
        below={tabs}
        right={
          <>
            <Link
              to="/account/$account/recap"
              params={{ account: slug }}
              className="mr-auto hidden min-w-0 items-center gap-2 rounded-md border-l border-lind-line pl-4 transition-opacity hover:opacity-80 md:flex"
              aria-label={`${customer.name} Recap`}
            >
              <CompanyLogo name={customer.name} domain={settings.companyDomain ?? customer.website} className="h-9 w-9" />
              <span className="truncate text-base font-bold text-lind-ink">{customer.name}</span>
            </Link>
            <AvatarSelector />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" data-tour="assistant" onClick={() => assistant.open()} aria-label="Open value assistant">
              <MessageCircle /> Ask
            </Button>
            <Button variant="outline" size="sm" className="hidden lg:inline-flex" onClick={people.startOver}>
              <Plus /> New report
            </Button>
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-3/4 bg-card sm:max-w-xs">
                <SheetHeader>
                  <SheetTitle className="text-left text-lind-navy">{customer.name}</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {nav.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left text-base font-semibold",
                        isActive(item) ? "bg-lind-navy/10 text-lind-navy" : "text-lind-ink hover:bg-lind-mist",
                      )}
                      onClick={() => {
                        void navigate({ to: item.to });
                        setMobileNavOpen(false);
                      }}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </button>
                  ))}
                  <div className="my-2 border-t border-lind-line" />
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left text-base font-semibold text-lind-ink hover:bg-lind-mist"
                    onClick={() => {
                      setMobileNavOpen(false);
                      assistant.open();
                    }}
                  >
                    <MessageCircle className="h-5 w-5" /> Ask the value assistant
                  </button>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left text-base font-semibold text-lind-ink hover:bg-lind-mist"
                    onClick={() => {
                      setMobileNavOpen(false);
                      people.startOver();
                    }}
                  >
                    <Plus className="h-5 w-5" /> New report
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </>
        }
      />
      {recap ? (
        <Outlet />
      ) : (
        <>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
            <div className="mb-8">
              <ControlBar />
            </div>
            <Outlet />
          </main>
          <footer className="border-t border-lind-line bg-card">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 text-sm leading-relaxed text-lind-grey sm:px-6">
              Customer reports use uploaded data. Estimates, allocation methods and assumptions are labelled and should be reviewed before external reporting.
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
