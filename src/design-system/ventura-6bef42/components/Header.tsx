import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth, ROLE_LABELS, type AppRole } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { cacheRoleOnboardingState, roleLandingPath } from "@/design-system/ventura-6bef42/lib/join-intent";

import { useLanguage } from "@/design-system/ventura-6bef42/hooks/use-language";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dropdown-menu";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/design-system/ventura-6bef42/components/ui/sheet";
import {
  LogOut,
  User as UserIcon,
  Menu,
  Settings as SettingsIcon,
  Building2,
  UserCog,
  ChevronDown,
  History,
  Play,
  Home,
  AlertCircle,
  Lightbulb,
  Cog,
  HelpCircle,
  LogIn,
  UserPlus,
  Compass,
  BookOpen,
  Mail,
  Check,

} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/design-system/ventura-6bef42/components/ui/avatar";
import { useEffect, useState } from "react";
import { GlobalUpdateHistoryButton } from "@/design-system/ventura-6bef42/components/startup-updates/GlobalUpdateHistoryButton";
import { InboxDialog } from "@/design-system/ventura-6bef42/components/InboxDialog";
import { useInboxUnread } from "@/design-system/ventura-6bef42/hooks/use-inbox-unread";
import { useProgramWorkspace } from "@/design-system/ventura-6bef42/hooks/use-program-workspace";
import { ProgramNavButton } from "@/design-system/ventura-6bef42/components/ProgramNavButton";

// A program is new on its start date and the following two UTC calendar days.
function isProgramNew(startDate: string | null, today: string | null) {
  if (!startDate || !today) return false;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(start) && current >= start && current < start + 3 * 86_400_000;
}


function LanguageToggle() {
  const { lang, toggle } = useLanguage();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="rounded-full px-3 font-semibold uppercase"
      aria-label="Toggle language"
    >
      {lang === "en" ? "EN" : "FI"}
    </Button>
  );
}

export function Header({ children }: { children?: React.ReactNode }) {
  const { user, signOut, role, roles, setActiveRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = role === "admin";
  const switchRole = (next: AppRole) => {
    if (next === role) return;
    setActiveRole(next);
    // The header already knows each role's onboarding state, so we can jump
    // straight to the right page instead of re-querying and reloading the tab.
    void navigate({
      to: roleLandingPath(next, {
        founder: onboardingComplete,
        investor: investorOnboarded,
        mentor: mentorOnboarded,
      }),
    });
  };


  const isAdminPage = location.pathname === "/admin";
  const isProfilePage = location.pathname === "/profile";
  const hidePublicNav = ["/admin", "/profile", "/startups", "/startups/new", "/founder-onboarding"].includes(location.pathname) || /^\/startups\/[^/]+$/.test(location.pathname) || location.pathname.startsWith("/startup-updates");


  const [displayName, setDisplayName] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("ventura:displayName");
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("ventura:photoUrl");
  });
  const [investorOnboarded, setInvestorOnboarded] = useState(false);
  const [mentorOnboarded, setMentorOnboarded] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ventura:onboardingComplete") === "1";
  });
  /** Onboarding state of the role the user is currently acting as. */
  const activeRoleOnboarded =
    isAdmin
      ? true
      : role === "investor"
        ? investorOnboarded
        : role === "mentor"
          ? mentorOnboarded
          : onboardingComplete;
  const [hasStartup, setHasStartup] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem("ventura:hasStartup");
    return v === null ? null : v === "1";
  });
  const [hasPublishedStartup, setHasPublishedStartup] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ventura:hasPublishedStartup") === "1";
  });
  const [journalOpen, setJournalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const { unread: inboxUnread, markSeen: markInboxSeen } = useInboxUnread();
  const { items: programItems } = useProgramWorkspace();
  const [todayUtc, setTodayUtc] = useState<string | null>(null);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const updateDay = () => {
      const now = new Date();
      setTodayUtc(now.toISOString().slice(0, 10));
      timeout = setTimeout(updateDay, 86_400_000 - (now.getTime() % 86_400_000) + 50);
    };
    updateDay();
    return () => clearTimeout(timeout);
  }, []);
  const selectedProgramKey = location.pathname === "/program-content" ? new URLSearchParams(location.searchStr).get("program") : null;
  // With several programs, the header shows "Programs" until the user opens a
  // specific program's page — then it switches to that program's logo + name.
  const activeProgram = selectedProgramKey ? programItems.find((item) => item.key === selectedProgramKey) ?? null : null;
  const programNav = activeProgram ?? programItems[0] ?? null;
  const newProgram = programItems.find((item) => isProgramNew(item.programStartDate, todayUtc)) ?? null;
  const openInbox = () => {
    markInboxSeen();
    setInboxOpen(true);
  };
  const handleInboxOpenChange = (v: boolean) => {
    setInboxOpen(v);
    if (v) markInboxSeen();
  };


  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      setPhotoUrl(null);
      setOnboardingComplete(false);
      setHasStartup(null);
      setHasPublishedStartup(false);
      setInvestorOnboarded(false);
      setMentorOnboarded(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("ventura:displayName");
        localStorage.removeItem("ventura:photoUrl");
        localStorage.removeItem("ventura:hasPublishedStartup");
        localStorage.removeItem("ventura:onboardingComplete");
        localStorage.removeItem("ventura:hasStartup");
        localStorage.removeItem("ventura:investorOnboarded");
        localStorage.removeItem("ventura:mentorOnboarded");
      }
      return;
    }
    let cancelled = false;
    const loadProfile = () => {
      const profilePromise = supabase
        .from("founder_accounts")
        .select("full_name, photo_url, onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const ownedPromise = supabase
        .from("startups")
        .select("id, is_published")
        .eq("owner_id", user.id);
      const memberPromise = supabase
        .from("startup_members")
        .select("startup_id")
        .eq("user_id", user.id);
      const investorPromise = supabase
        .from("investor_profiles")
        .select("completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const coachPromise = supabase
        .from("coach_profiles")
        .select("completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      void Promise.all([profilePromise, ownedPromise, memberPromise, investorPromise, coachPromise]).then(async ([profileRes, owned, member, investorRes, coachRes]) => {
        if (cancelled) return;
        const data = profileRes.data;
        const name = data?.full_name?.trim() || user.email?.split("@")[0] || null;
        const photo = data?.photo_url ?? null;
        const onboarded = Boolean(data?.onboarding_completed_at);
        const ownedRows = owned.data ?? [];
        const memberRows = (member.data ?? []) as { startup_id: string }[];
        const hasAny = Boolean(ownedRows.length > 0 || memberRows.length > 0);
        let published = ownedRows.some((r: { is_published?: boolean | null }) => r.is_published);
        if (!published && memberRows.length > 0) {
          const memberIds = memberRows
            .map((r) => r.startup_id)
            .filter((id) => !ownedRows.some((o: { id: string }) => o.id === id));
          if (memberIds.length > 0) {
            const { data: memberStartups } = await supabase
              .from("startups")
              .select("id, is_published")
              .in("id", memberIds)
              .eq("is_published", true)
              .limit(1);
            if (cancelled) return;
            published = (memberStartups?.length ?? 0) > 0;
          }
        }
        // Atomic update so nav buttons appear/disappear together
        setDisplayName(name);
        setPhotoUrl(photo);
        setOnboardingComplete(onboarded);
        setHasStartup(hasAny);
        setHasPublishedStartup(published);
        const investorComplete = Boolean(investorRes.data?.completed_at);
        const mentorComplete = Boolean(coachRes.data?.completed_at);
        setInvestorOnboarded(investorComplete);
        setMentorOnboarded(mentorComplete);
        if (typeof window !== "undefined") {
          if (name) localStorage.setItem("ventura:displayName", name);
          if (photo) localStorage.setItem("ventura:photoUrl", photo);
          else localStorage.removeItem("ventura:photoUrl");
          if (onboarded) localStorage.setItem("ventura:onboardingComplete", "1");
          else localStorage.removeItem("ventura:onboardingComplete");
          cacheRoleOnboardingState("investor", investorComplete);
          cacheRoleOnboardingState("mentor", mentorComplete);
          localStorage.setItem("ventura:hasStartup", hasAny ? "1" : "0");
          if (published) localStorage.setItem("ventura:hasPublishedStartup", "1");
          else localStorage.removeItem("ventura:hasPublishedStartup");
        }
      }).catch(() => {
        /* navigation can abort these non-critical header requests */
      });
    };
    loadProfile();
    const onUpdate = () => loadProfile();
    window.addEventListener("ventura:profile-updated", onUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("ventura:profile-updated", onUpdate);
    };
  }, [user]);


  const [mode, setMode] = useState<"top" | "fixed" | "hidden">("top");
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < 80) setMode("top");
      else if (delta > 4) setMode("hidden");
      else if (delta < -4) setMode("fixed");
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);


  const navLinks: Array<{ to: string; label: string; icon: React.ReactNode }> = [
    { to: "/", label: t("Home", "Koti"), icon: <Home className="h-4 w-4" /> },
    { to: "/problem", label: t("Problem", "Ongelma"), icon: <AlertCircle className="h-4 w-4" /> },
    { to: "/solution", label: t("Solution", "Ratkaisu"), icon: <Lightbulb className="h-4 w-4" /> },
    { to: "/how-it-works", label: t("How it works", "Miten se toimii"), icon: <Cog className="h-4 w-4" /> },
    { to: "/faq", label: t("FAQ", "UKK"), icon: <HelpCircle className="h-4 w-4" /> },
  ];

  const headerClass = `sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ${
    mode === "hidden" ? "-translate-y-full" : "translate-y-0"
  }`;

  return (
    <header className={headerClass}>


      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6">
        <Link to={user ? (role === "founder" ? "/startups" : "/") : "/"} className="flex items-center gap-2 font-semibold tracking-tight text-foreground md:gap-3">
          <span className="text-xl md:text-2xl">Ventura</span>
          {mounted && location.pathname === "/" && !user && (
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
              {t("Now in beta", "Nyt beta-vaiheessa")}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center justify-center gap-1">
          {!mounted ? (
            <div className="h-9 w-44 rounded-full bg-muted/50 animate-pulse" />
          ) : user ? (
            <>
              <div className="relative">
                <Button size="sm" variant="outline" className="rounded-full px-2.5" data-particles="true" aria-label={t("Inbox", "Postilaatikko")} onClick={openInbox}>
                  <Mail className="h-4 w-4" />
                </Button>
                {!inboxOpen && inboxUnread > 0 && (
                  <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
                    {inboxUnread > 99 ? "99+" : inboxUnread}
                  </span>
                )}
              </div>
              {role !== "investor" && role !== "mentor" && (
                <Button size="sm" variant="outline" className="rounded-full px-2.5" data-particles="true" aria-label={t("Startup journal", "Startup-päiväkirja")} onClick={() => setJournalOpen(true)}>
                  <History className="h-4 w-4" />
                </Button>
              )}
              <Button asChild size="sm" variant="outline" className="rounded-full px-2.5" data-particles="true" aria-label={t("Video pitches", "Video-pitchit")}>
                <Link to="/video-pitches" search={{ tab: "feed" }}><Play className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full px-2.5" data-particles="true" aria-label={t("Discover startups", "Discover-startupit")}>
                <Link to="/video-pitches" search={{ tab: "discover" }}><Compass className="h-4 w-4" /></Link>
              </Button>
              {programNav && role !== "investor" ? (
                programItems.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {activeProgram ? (
                        <Button size="sm" variant="outline" className={`h-9 max-w-[220px] gap-2 rounded-full px-4 ${isProgramNew(activeProgram.programStartDate, todayUtc) && activeProgram.programThemeColor ? "animate-program-button-glow" : ""}`} style={isProgramNew(activeProgram.programStartDate, todayUtc) && activeProgram.programThemeColor ? { "--program-glow": activeProgram.programThemeColor } as React.CSSProperties : undefined} aria-label={t("Choose program", "Valitse ohjelma")}>
                          {activeProgram.programLogoUrl ? <img src={activeProgram.programLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{activeProgram.programName.slice(0, 1)}</span>}
                          <span className="truncate">{activeProgram.programName}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className={`h-9 gap-2 rounded-full px-4 ${newProgram?.programThemeColor ? "animate-program-button-glow" : ""}`} style={newProgram?.programThemeColor ? { "--program-glow": newProgram.programThemeColor } as React.CSSProperties : undefined} aria-label={t("Choose program", "Valitse ohjelma")}>
                          <span className="truncate">{t("Programs", "Ohjelmat")}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </Button>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-64">
                      {programItems.map((item) => (
                        <DropdownMenuItem key={item.key} asChild>
                          <Link to="/program-content" search={{ program: item.key }} className="flex min-w-0 items-center gap-2">
                            {item.programLogoUrl ? <img src={item.programLogoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-contain" /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{item.programName.slice(0, 1)}</span>}
                            <span className="min-w-0 flex-1 truncate">{item.programName}<span className="block truncate text-xs text-muted-foreground">{item.startupName}</span></span>
                            {item.key === activeProgram?.key && location.pathname === "/program-content" ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : <ProgramNavButton
                  programKey={programNav.key}
                  programName={programNav.programName}
                  logoUrl={programNav.programLogoUrl}
                  themeColor={programNav.programThemeColor}
                  glow={isProgramNew(programNav.programStartDate, todayUtc)}
                />
              ) : null}

              <Button asChild size="sm" variant="outline" className="rounded-full px-3" data-particles="true" aria-label={t("Home", "Koti")}>
                <Link to="/"><Home className="h-4 w-4" /></Link>
              </Button>
            </>

          ) : isProfilePage ? (
            hasStartup === null ? (
              <div className="h-9 w-44 rounded-full bg-muted/50 animate-pulse" />
            ) : hasStartup ? null : (
              <Button asChild size="sm" className="rounded-full px-5" data-particles="true">
                <Link to="/startups">
                  {t("Create startup profile", "Luo startup-profiili")}
                </Link>
              </Button>
            )
          ) : !hidePublicNav ? (
            navLinks.map((l) => (
              <Button key={l.to} asChild variant="ghost" size="sm" className="rounded-full" data-particles="true">
                <Link to={l.to}>{l.label}</Link>
              </Button>
            ))
          ) : null}
        </div>


        {/* Desktop right */}
        <div className="hidden md:flex items-center justify-end gap-2">
          {location.pathname === "/" && !user && <LanguageToggle />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full gap-2 h-9 pl-0 pr-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <Avatar className="h-9 w-9">
                    {photoUrl ? <AvatarImage src={photoUrl} alt={displayName || "Profile"} className="object-cover" /> : null}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {(displayName || user.email || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate">{displayName || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {onboardingComplete && role !== "investor" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    <UserIcon className="mr-2 h-4 w-4" /> {t("My profile", "Profiilini")}
                  </DropdownMenuItem>
                )}
                {role === "investor" && roles.includes("investor") && investorOnboarded && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/investor-profile" })}>
                    <UserIcon className="mr-2 h-4 w-4" /> {t("My profile", "Profiilini")}
                  </DropdownMenuItem>
                )}
                {role === "mentor" && roles.includes("mentor") && mentorOnboarded && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/mentor-profile" })}>
                    <UserIcon className="mr-2 h-4 w-4" /> {t("My profile", "Profiilini")}
                  </DropdownMenuItem>
                )}
                {onboardingComplete && role === "founder" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/startups" })}>
                    <Building2 className="mr-2 h-4 w-4" /> {t("My startups", "Startupini")}
                  </DropdownMenuItem>
                )}
                {activeRoleOnboarded && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <SettingsIcon className="mr-2 h-4 w-4" /> {t("Settings", "Asetukset")}
                  </DropdownMenuItem>
                )}
                {!isAdmin && !onboardingComplete && role === "founder" && roles.includes("founder") && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/founder-onboarding" })}>
                    <UserCog className="mr-2 h-4 w-4" /> {t("Complete my profile", "Täydennä profiilini")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {roles.length > 1 && activeRoleOnboarded && (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      {t("Switch to", "Vaihda")}
                    </DropdownMenuLabel>
                    {roles.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => switchRole(r)}
                        className="justify-between"
                      >
                        <span className="flex items-center">
                          <UserCog className="mr-2 h-4 w-4" /> {ROLE_LABELS[r]}
                        </span>
                        {r === role && <Check className="h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate({ to: "/join" })}>
                  <UserPlus className="mr-2 h-4 w-4" /> {t("Add another role", "Lisää uusi rooli")}
                </DropdownMenuItem>
                <DropdownMenuItem

                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> {t("Log out", "Kirjaudu ulos")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="rounded-full" data-particles="true">
                <Link to="/auth" search={{ tab: "login" }}>{t("Log in", "Kirjaudu")}</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full" data-particles="true">
                <Link to="/join">{t("Sign up", "Rekisteröidy")}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile right */}
        <div className="flex items-center gap-1 md:hidden">
          {mounted && user && (hasPublishedStartup || role === "investor" || role === "mentor") && (
            <Button asChild size="sm" variant="ghost" className="rounded-full px-2.5" data-particles="true" aria-label={t("Home", "Koti")}>
              <Link to="/"><Home className="h-4 w-4" /></Link>
            </Button>
          )}
          {mounted && onboardingComplete && (
            <Button asChild size="sm" className="rounded-full gap-1.5" data-particles="true">
              <Link to="/video-pitches" search={{ tab: "feed" }}><Play className="h-4 w-4" />{t("Video pitches", "Video-pitchit")}</Link>
            </Button>
          )}
          {mounted && location.pathname === "/" && !user && <LanguageToggle />}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex h-full flex-col">
                <div className="border-b border-border px-6 py-5">
                  <span className="text-xl font-semibold tracking-tight">Ventura</span>
                </div>
                {!hidePublicNav && !user && (
                  <nav className="flex flex-col gap-1 px-4 py-4">
                    {navLinks.map((l) => (
                      <SheetClose asChild key={l.to}>
                        <Link
                          to={l.to}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                        >
                          {l.icon}
                          {l.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                )}
                <div className="mt-auto border-t border-border px-4 py-4 space-y-1">
                  {user ? (
                    <>
                      <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                        {displayName || user.email}
                      </div>
                      {/* Manage startups is available below via "My startups" */}

                      {onboardingComplete && role === "founder" && (
                        <SheetClose asChild>
                          <Link
                            to="/profile"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <UserIcon className="h-4 w-4" />
                            {t("My profile", "Profiilini")}
                          </Link>
                        </SheetClose>
                      )}
                      {role === "investor" && roles.includes("investor") && investorOnboarded && (
                        <SheetClose asChild>
                          <Link
                            to="/investor-profile"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <UserIcon className="h-4 w-4" />
                            {t("My profile", "Profiilini")}
                          </Link>
                        </SheetClose>
                      )}
                      {role === "mentor" && roles.includes("mentor") && mentorOnboarded && (
                        <SheetClose asChild>
                          <Link
                            to="/mentor-profile"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <UserIcon className="h-4 w-4" />
                            {t("My profile", "Profiilini")}
                          </Link>
                        </SheetClose>
                      )}
                      {onboardingComplete && role === "founder" && (
                        <SheetClose asChild>
                          <Link
                            to="/startups"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <Building2 className="h-4 w-4" />
                            {t("My startups", "Startupini")}
                          </Link>
                        </SheetClose>
                      )}
                      {activeRoleOnboarded && (
                        <SheetClose asChild>
                          <Link
                            to="/settings"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <SettingsIcon className="h-4 w-4" />
                            {t("Settings", "Asetukset")}
                          </Link>
                        </SheetClose>
                      )}
                      {onboardingComplete && role !== "investor" && (
                        <SheetClose asChild>
                          <button
                            onClick={() => setJournalOpen(true)}
                            className="flex w-full items-center gap-3 text-left rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <BookOpen className="h-4 w-4" />
                            {t("Startup journal", "Startup-päiväkirja")}
                          </button>
                        </SheetClose>
                      )}
                      {programItems.length > 0 && role !== "investor" ? (
                        <div className="space-y-1">
                          {programItems.length > 1 && <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{t("My programs", "Ohjelmani")}</p>}
                          {programItems.map((item) => (
                            <SheetClose asChild key={item.key}>
                              <ProgramNavButton
                                variant="mobile"
                                programKey={item.key}
                                programName={item.programName}
                                logoUrl={item.programLogoUrl}
                                themeColor={item.programThemeColor}
                                glow={isProgramNew(item.programStartDate, todayUtc)}
                              />
                            </SheetClose>
                          ))}
                        </div>
                      ) : null}
                      <SheetClose asChild>
                        <button
                          onClick={openInbox}
                          className="flex w-full items-center gap-3 text-left rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                        >
                          <Mail className="h-4 w-4" />
                          {t("Inbox", "Postilaatikko")}
                          {!inboxOpen && inboxUnread > 0 && (
                            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                              {inboxUnread > 99 ? "99+" : inboxUnread}
                            </span>
                          )}
                        </button>
                      </SheetClose>

                      {onboardingComplete && (
                        <SheetClose asChild>
                          <Link
                            to="/video-pitches"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <Play className="h-4 w-4" />
                            {t("Video pitches", "Video-pitchit")}
                          </Link>
                        </SheetClose>
                      )}
                      {!isAdmin && !onboardingComplete && role === "founder" && roles.includes("founder") && (
                        <SheetClose asChild>
                          <Link
                            to="/founder-onboarding"
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                          >
                            <UserCog className="h-4 w-4" />
                            {t("Complete my profile", "Täydennä profiilini")}
                          </Link>
                        </SheetClose>
                      )}
                      <SheetClose asChild>
                        <button
                          onClick={async () => {
                            await signOut();
                            navigate({ to: "/" });
                          }}
                          className="flex w-full items-center gap-3 text-left rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                        >
                          <LogOut className="h-4 w-4" />
                          {t("Log out", "Kirjaudu ulos")}
                        </button>
                      </SheetClose>
                    </>
                  ) : (
                    <>
                      <SheetClose asChild>
                        <Link
                          to="/auth"
                          search={{ tab: "login" }}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-accent"
                        >
                          <LogIn className="h-4 w-4" />
                          {t("Log in", "Kirjaudu")}
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link
                          to="/join"
                          className="flex items-center justify-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-center text-base font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <UserPlus className="h-4 w-4" />
                          {t("Sign up", "Rekisteröidy")}
                        </Link>
                      </SheetClose>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {user && (
        <>
          <GlobalUpdateHistoryButton variant="nav" open={journalOpen} onOpenChange={setJournalOpen} showTrigger={false} />
          <InboxDialog open={inboxOpen} onOpenChange={handleInboxOpenChange} />
        </>
      )}
      {children}
    </header>
  );
}
