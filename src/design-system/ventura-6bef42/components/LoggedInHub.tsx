import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  User as UserIcon,
  Building2,
  Play,
  Settings as SettingsIcon,
  UserCog,
  ShieldCheck,
  Mail,
  LogOut,
  MessageSquare,
  BookOpen,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { useLanguage } from "@/design-system/ventura-6bef42/hooks/use-language";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { FeedbackButton } from "@/design-system/ventura-6bef42/components/FeedbackButton";
import { GlobalUpdateHistoryButton } from "@/design-system/ventura-6bef42/components/startup-updates/GlobalUpdateHistoryButton";

type Card = {
  to?: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void | Promise<void>;
  accent?: string;
};

const NAME_CACHE_KEY = "ventura:hubDisplayName";

export function LoggedInHub() {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === "admin";

  const metaName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.user_metadata?.name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    null;

  const [displayName, setDisplayName] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(NAME_CACHE_KEY) || null;
  });
  const [nameLoaded, setNameLoaded] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ventura:onboardingComplete") === "1";
  });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (metaName) setDisplayName((prev) => prev ?? metaName);
    let cancelled = false;
    supabase
      .from("founder_accounts")
      .select("full_name, onboarding_completed_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const resolved = data?.full_name?.trim() || metaName;
        setDisplayName(resolved);
        if (typeof window !== "undefined") {
          if (resolved) localStorage.setItem(NAME_CACHE_KEY, resolved);
          else localStorage.removeItem(NAME_CACHE_KEY);
        }
        setOnboardingComplete(Boolean(data?.onboarding_completed_at));
        setNameLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, metaName]);


  const cards: Card[] = [];

  if (isAdmin) {
    cards.push({
      to: "/admin",
      label: t("Admin", "Ylläpito"),
      description: t("Manage the platform", "Hallinnoi alustaa"),
      icon: ShieldCheck,
    });
  }

  if (onboardingComplete) {
    cards.push(
      {
        to: "/profile",
        label: t("My profile", "Profiilini"),
        description: t("View and edit your founder profile", "Katso ja muokkaa perustajaprofiiliasi"),
        icon: UserIcon,
      },
      {
        to: "/startups",
        label: t("My startups", "Startupini"),
        description: t("Create and manage your startups", "Luo ja hallinnoi startupeja"),
        icon: Building2,
      },
      {
        to: "/video-pitches",
        label: t("Video pitches", "Video-pitchit"),
        description: t("Watch startup pitches from founders", "Katso perustajien pitchit"),
        icon: Play,
      },
      {
        to: "/settings",
        label: t("Settings", "Asetukset"),
        description: t("Account preferences and notifications", "Tili- ja ilmoitusasetukset"),
        icon: SettingsIcon,
      },
      {
        label: t("Feedback", "Palaute"),
        description: t("Report a bug or request a feature", "Ilmoita bugista tai ehdota ominaisuutta"),
        icon: MessageSquare,
        onClick: () => setFeedbackOpen(true),
      },
      {
        label: t("Startup journal", "Startup-päiväkirja"),
        description: t("View weekly updates from your startups", "Katsele startupiesi viikkopäivityksiä"),
        icon: BookOpen,
        onClick: () => setJournalOpen(true),
      },
      {
        to: "/startups",
        label: t("Upload pitch video", "Lataa pitch-video"),
        description: t("Go to your startups and upload a pitch video", "Siirry startupeihisi ja lataa pitch-video"),
        icon: Video,
      },
    );
  } else if (!isAdmin) {
    cards.push({
      to: "/founder-onboarding",
      label: t("Complete my profile", "Täydennä profiilini"),
      description: t("Finish onboarding to unlock everything", "Viimeistele profiili"),
      icon: UserCog,
    });
  }

  cards.push({
    to: "/contact",
    label: t("Contact us", "Ota yhteyttä"),
    description: t("Talk to the Ventura team", "Ota yhteyttä Ventura-tiimiin"),
    icon: Mail,
  });

  cards.push({
    label: t("Log out", "Kirjaudu ulos"),
    description: t("Sign out of your account", "Kirjaudu ulos tililtäsi"),
    icon: LogOut,
    onClick: async () => {
      await signOut();
      window.location.href = "/";
    },
  });

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.07, delayChildren: 0.1 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: 24, scale: 0.96 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 220, damping: 22 },
    },
  };

  return (
    <main className="flex-1">
      <section className="container mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-10 md:mb-14"
        >
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {displayName
              ? `${t("Hello", "Hei")}, ${displayName}.`
              : nameLoaded && !authLoading
                ? t("Your hub", "Aloitusnäkymä")
                : "\u00A0"}


          </h1>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cards.map((card, i) => {
            const Icon = card.icon;
            const inner = (
              <motion.div
                variants={item}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-foreground/30 hover:shadow-md"
              >
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-2xl transition-opacity duration-500 group-hover:opacity-80" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{card.label}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{card.description}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 transition-colors group-hover:text-foreground">
                  <span>{card.onClick ? t("Continue", "Jatka") : t("Open", "Avaa")}</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
              </motion.div>
            );

            if (card.to) {
              return (
                <Link
                  key={i}
                  to={card.to}
                  className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={card.onClick}
                className="block h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
              >
                {inner}
              </button>
            );
          })}
        </motion.div>
      </section>
      <FeedbackButton showTrigger={false} open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <GlobalUpdateHistoryButton variant="nav" showTrigger={false} open={journalOpen} onOpenChange={setJournalOpen} />
    </main>
  );
}
