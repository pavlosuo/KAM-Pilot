import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ArrowUpRight, Bookmark, FileText, GitCompareArrows, Mail, MessageSquare, Play, RefreshCw, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { OrbInput, type OrbAction } from "@/design-system/ventura-6bef42/components/ui/animated-input";
import { LeaderboardCard } from "@/design-system/ventura-6bef42/components/ui/leaderboard-card";

const ASSISTANT_ACTIONS: Record<RoleHomeRole, OrbAction[]> = {
  investor: [
    { id: "email-alert", label: "Send me an email when [startup] reaches [goal]", icon: <Mail className="h-4 w-4 text-blue-500" />, description: "Alert", end: "Email" },
    { id: "pdf-summary", label: "Create pdf file which summarizes my saved startups", icon: <FileText className="h-4 w-4 text-purple-500" />, description: "Export", end: "PDF" },
    { id: "investment-ready", label: "Show top 5 most investment-ready startups", icon: <Search className="h-4 w-4 text-orange-500" />, description: "Ranked", end: "List" },
    { id: "compare-table", label: "Create a comparison table for the current top startups", icon: <GitCompareArrows className="h-4 w-4 text-pink-500" />, description: "Compare", end: "Table" },
  ],
  mentor: [
    { id: "coaching-brief", label: "Prepare a coaching brief for [startup]", icon: <FileText className="h-4 w-4 text-purple-500" />, description: "Session", end: "Brief" },
    { id: "needs-help", label: "Find startups that need help with [area]", icon: <Search className="h-4 w-4 text-orange-500" />, description: "Expertise", end: "List" },
    { id: "compare-challenges", label: "Compare my top matches by founder challenges", icon: <GitCompareArrows className="h-4 w-4 text-pink-500" />, description: "Compare", end: "Table" },
    { id: "email-alert", label: "Send me an email when [startup] reaches [goal]", icon: <Mail className="h-4 w-4 text-blue-500" />, description: "Alert", end: "Email" },
  ],
};
import { toast } from "sonner";
import { Header } from "@/design-system/ventura-6bef42/components/Header";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";

import { ActionFillDialog, actionPlaceholders as parsePlaceholders } from "@/design-system/ventura-6bef42/components/role-home/ActionFillDialog";
import { GoalAlertDialog } from "@/design-system/ventura-6bef42/components/role-home/GoalAlertDialog";
import { MessageFounderDialog } from "@/design-system/ventura-6bef42/components/role-home/MessageFounderDialog";
import { RoleAssistant } from "@/design-system/ventura-6bef42/components/role-home/RoleAssistant";
import { StartupMatchPodiumSkeleton } from "@/design-system/ventura-6bef42/components/role-home/StartupMatchPodium";
import { getRoleHome, refreshRoleHomeMatches, type RoleHomeRole, type StartupMatch } from "@/design-system/ventura-6bef42/lib/role-home.functions";
import { toggleStartupSave } from "@/design-system/ventura-6bef42/lib/startup-saves.functions";

type HomeData = { profileComplete: boolean; role: RoleHomeRole; matches: StartupMatch[]; generatedAt: string | null; shufflesLeft?: number; shuffleLimit?: number };

export function RoleHome({ role }: { role: RoleHomeRole }) {
  const getHome = useServerFn(getRoleHome);
  const refresh = useServerFn(refreshRoleHomeMatches);
  const toggleSave = useServerFn(toggleStartupSave);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<StartupMatch | null>(null);
  const [detailMatch, setDetailMatch] = useState<StartupMatch | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [promptNonce, setPromptNonce] = useState(0);
  const [goalAlertOpen, setGoalAlertOpen] = useState(false);
  const [fillLabel, setFillLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedDay = new Date().toISOString().slice(0, 10);
    const load = (withSpinner: boolean) => {
      if (withSpinner) setLoading(true);
      loadedDay = new Date().toISOString().slice(0, 10);
      void getHome({ data: { role } })
        .then((result) => { if (!cancelled) setData(result); })
        .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load your matches"))
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load(true);
    // Refresh the daily trio balance when the day rolls over or the tab regains focus.
    const maybeRefresh = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      if (new Date().toISOString().slice(0, 10) !== loadedDay) load(false);
    };
    const timer = window.setInterval(maybeRefresh, 60_000);
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [role]);


  const refreshMatches = async () => {
    setRefreshing(true);
    try { setData(await refresh({ data: { role } })); toast.success("Here's another trio for you"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load another trio"); }
    finally { setRefreshing(false); }
  };
  const saveMatch = async (match: StartupMatch) => {
    setSavingId(match.startupId);
    try {
      const saved = !match.saved;
      await toggleSave({ data: { startupId: match.startupId, saved } });
      setData((current) => current ? { ...current, matches: current.matches.map((item) => item.startupId === match.startupId ? { ...item, saved } : item) } : current);
      toast.success(saved ? "Startup saved" : "Startup removed from saved");
    } catch { toast.error("Could not update your saved startups"); }
    finally { setSavingId(null); }
  };
  const openAssistant = (value?: string) => {
    const next = value?.trim();
    setAssistantPrompt(next || null);
    setPromptNonce((count) => count + 1);
    setPrompt("");
    setAssistantOpen(true);
  };

  const roleName = role === "investor" ? "investor" : "mentor";
  const actionPlaceholders = ASSISTANT_ACTIONS[role].map((a) => a.label);
  return <div className="min-h-screen bg-background text-foreground"><Header /><main>
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="">
      <div className="container mx-auto flex max-w-3xl items-center justify-center px-4 pt-6 pb-4 md:px-6 md:pt-8 md:pb-5">
        <OrbInput hideGlow className="py-0 min-h-0" actions={ASSISTANT_ACTIONS[role]} placeholders={actionPlaceholders} onSubmit={(value: string) => openAssistant(value)} onActionSelect={(action: OrbAction) => { if (action.id === "email-alert") setGoalAlertOpen(true); else if (parsePlaceholders(action.label).length) setFillLabel(action.label); else openAssistant(action.label); }} onLogoClick={() => openAssistant()} inlineDropdown />
      </div>
    </motion.section>
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }} className="container mx-auto max-w-6xl px-4 pt-0 pb-8 md:px-6 md:pb-12">
      {loading ? <StartupMatchPodiumSkeleton /> : !data?.profileComplete ? <div className="rounded-2xl border bg-card py-14 text-center shadow-sm"><h3 className="text-xl font-semibold">Complete your {roleName} profile to unlock matches</h3><Button asChild className="mt-6"><Link to={role === "investor" ? "/investor-onboarding" : "/coach-onboarding"}>Complete profile<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div> : data.matches.length ? (() => {
        const sorted = [...data.matches].sort((a, b) => a.rank - b.rank);
        const byline = (m: StartupMatch) => [m.stage, ...(m.industryTags.length ? m.industryTags.slice(0, 2) : m.industry ? [m.industry] : [])].filter(Boolean).join(" · ");
        const rankings = sorted.map((m) => ({ userId: m.startupId, rank: m.rank, userName: m.name, byline: byline(m) || m.tagline || "", value: Math.round(m.score), avatarUrl: m.logoUrl, displayed: true }));
        const podium = rankings.slice(0, 3).map(({ userId, rank, userName, value, avatarUrl }) => ({ userId, rank, userName, value, avatarUrl }));
        const matchById = new Map(sorted.map((m) => [m.startupId, m]));
        return <LeaderboardCard
          title="Your startup matches"
          hideDateRange
          headerAction={(() => {
            const left = data.shufflesLeft ?? 0;
            return <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={refreshing || loading || left <= 0} onClick={() => void refreshMatches()} className="rounded-full">
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Finding another trio…" : `Show another trio (${left}/${data.shuffleLimit ?? 5})`}
              </Button>
              <Button variant="outline" size="icon" aria-label="My saved" asChild className="rounded-full">
                <Link to="/video-pitches" search={{ tab: "saved" }}><Bookmark className="h-4 w-4" /></Link>
              </Button>
            </div>;
          })()}
          fromDate={data.generatedAt ? new Date(data.generatedAt) : new Date()}
          toDate={new Date()}
          valueSuffix="%"
          podiumRankings={podium}
          rankings={rankings}
          onItemClick={(item) => { const m = matchById.get(item.userId); if (m) setDetailMatch(m); }}
          renderActions={(item) => { const m = matchById.get(item.userId); if (!m) return null; return <>
            <Button size="icon" variant={m.saved ? "default" : "outline"} className="h-8 w-8 rounded-full" disabled={savingId === m.startupId} onClick={() => void saveMatch(m)} aria-label={m.saved ? "Remove from saved" : "Save startup"}><Bookmark className={`h-4 w-4 ${m.saved ? "fill-current" : ""}`} /></Button>
            <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => setMessageTarget(m)} aria-label="Message founder"><MessageSquare className="h-4 w-4" /></Button>
          </>; }}
        />;
      })() : <div className="rounded-2xl border bg-card py-14 text-center text-muted-foreground shadow-sm">No active startup matches are available yet.</div>}
    </motion.section>
  </main>
    <Dialog open={Boolean(detailMatch)} onOpenChange={(open) => { if (!open) setDetailMatch(null); }}>
      <DialogContent className="sm:max-w-md">
        {detailMatch ? <>
          <DialogHeader className="gap-4">
            <DialogTitle className="flex flex-col items-center justify-center gap-3 text-center">
              {detailMatch.logoUrl ? <img src={detailMatch.logoUrl} alt={detailMatch.name} className="h-16 w-16 rounded-full border object-cover shadow-sm" /> : null}
              <Link to="/startup/$slug" params={{ slug: detailMatch.slug }} className="group flex items-center gap-2 text-xl font-semibold hover:underline">
                <span>{detailMatch.name}</span>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
            </DialogTitle>
            {detailMatch.industry ? <DialogDescription className="text-center text-sm">{detailMatch.industry}</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                Why this match is {Math.round(detailMatch.score)}%?
              </span>
            </div>
            <ul className="space-y-3 pl-1 text-sm text-muted-foreground">
              {detailMatch.reasons.map((reason, index) => <li key={index} className="relative pl-4 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-foreground/60">{reason}</li>)}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant={detailMatch.saved ? "default" : "outline"} className="rounded-full" disabled={savingId === detailMatch.startupId} onClick={() => void saveMatch(detailMatch)}><Bookmark className={`mr-2 h-4 w-4 ${detailMatch.saved ? "fill-current" : ""}`} />{detailMatch.saved ? "Saved" : "Save"}</Button>
            <Button variant="outline" className="rounded-full" onClick={() => { setMessageTarget(detailMatch); }}><MessageSquare className="mr-2 h-4 w-4" />Message</Button>
            {detailMatch.pitchVideoUid ? <Button variant="outline" className="col-span-2 rounded-full" asChild><Link to="/startup/$slug" params={{ slug: detailMatch.slug }} hash="sec-video"><Play className="mr-2 h-4 w-4" />Pitch video</Link></Button> : null}
          </div>
        </> : null}
      </DialogContent>
    </Dialog>
    <GoalAlertDialog open={goalAlertOpen} onOpenChange={setGoalAlertOpen} onCreated={(sentence) => openAssistant(sentence)} />
    <ActionFillDialog label={fillLabel} open={Boolean(fillLabel)} onOpenChange={(open) => { if (!open) setFillLabel(null); }} onSubmit={(sentence) => openAssistant(sentence)} />
    <MessageFounderDialog role={role} startup={messageTarget} open={Boolean(messageTarget)} onOpenChange={(open) => { if (!open) setMessageTarget(null); }} /><RoleAssistant role={role} open={assistantOpen} onOpenChange={setAssistantOpen} initialPrompt={assistantPrompt} promptNonce={promptNonce} /></div>;
}