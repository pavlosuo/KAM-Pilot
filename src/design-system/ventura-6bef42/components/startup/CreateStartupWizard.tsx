import { fireCelebrationConfetti } from "@/design-system/ventura-6bef42/lib/celebrate";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/alert-dialog";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import Loader from "@/design-system/ventura-6bef42/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ventura-6bef42/components/ui/select";
import { Loader2, Upload, FileText, Image as ImageIcon, CheckCircle2, Rocket, Sparkles, ShieldQuestion, Check, Building2, Plus, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  createStartupBasics,
  getMyStartupById,
  publishStartupFromDraft,
  setStartupPitchDeck,
  updateStartupBasics,
  updateStartupFields,
} from "@/design-system/ventura-6bef42/lib/startup.functions";

import {
  createDeckParseJob,
  runDeckParseJob,
  getMyDraft,
  updateMyDraft,
  createEmptyDraft,
} from "@/design-system/ventura-6bef42/lib/deck-parse.functions";
import { recordPitchDeckUpload } from "@/design-system/ventura-6bef42/lib/pitch-deck-quota.functions";
import { analyzeDraftGaps } from "@/design-system/ventura-6bef42/lib/draft-analysis.functions";
import { TeammatesStep } from "@/design-system/ventura-6bef42/components/startup/TeammatesStep";
import { FINNISH_ACCELERATORS, OTHER_PROGRAM_OPTION } from "@/design-system/ventura-6bef42/lib/finnish-accelerators";
import { MultiSelectCombobox } from "@/design-system/ventura-6bef42/components/ui/multi-select-combobox";
import { ProgramLogo } from "@/design-system/ventura-6bef42/components/ProgramLogo";
import { OtherProgramLogoUploader } from "@/design-system/ventura-6bef42/components/OtherProgramLogoUploader";
import { X } from "lucide-react";
import { normalizeWebsite, isValidWebsite } from "@/design-system/ventura-6bef42/lib/url";
import { FileUpload } from "@/design-system/ventura-6bef42/components/ui/file-upload";

type Step = "deck" | "basics" | "accelerator" | "teammates" | "parsing" | "review";

const STEP_STORAGE_PREFIX = "ventura:wizard-step:";
const STEP_ORDER: Step[] = ["deck", "basics", "accelerator", "teammates", "parsing", "review"];

function readSavedStep(startupId: string): Step | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STEP_STORAGE_PREFIX + startupId);
    return v && (STEP_ORDER as string[]).includes(v) ? (v as Step) : null;
  } catch {
    return null;
  }
}

function writeSavedStep(startupId: string, step: Step) {
  if (typeof window === "undefined") return;
  try {
    const prev = readSavedStep(startupId);
    // Only remember forward progress so going back doesn't lose the furthest step.
    if (prev && STEP_ORDER.indexOf(prev) > STEP_ORDER.indexOf(step)) return;
    window.localStorage.setItem(STEP_STORAGE_PREFIX + startupId, step);
  } catch {
    /* ignore */
  }
}
type ParseStatus = "idle" | "running" | "done" | "error";

type DraftData = {
  company_name?: string | null;
  one_liner?: string | null;
  website?: string | null;
  country?: string | null;
  industry_tags?: string[];
  business_model_tags?: string[];
  investor_readiness?: string | null;
  executive_summary?: string | null;
  problem?: string | null;
  solution?: string | null;
  market?: string | null;
  customers_and_users?: string | null;
  competitors?: string[];
  competitive_advantage?: string | null;
  investment_case?: string | null;
  traction?: string | null;
  team_members?: { name: string; role?: string | null; bio?: string | null; linkedin?: string | null }[];
  attachments?: { label: string; url: string }[];
  missing_information?: string[];
};

const MAX_REVIEW_FIELD_CHARS = 1200;
const MAX_SHORT_FIELD_CHARS = 400;

const TEXT_FIELDS: { key: keyof DraftData; label: string; multiline?: boolean }[] = [
  { key: "one_liner", label: "One-liner", multiline: true },
  { key: "executive_summary", label: "Executive summary", multiline: true },
  { key: "problem", label: "Problem", multiline: true },
  { key: "solution", label: "Solution", multiline: true },
  { key: "market", label: "Market", multiline: true },
  { key: "customers_and_users", label: "Customers & users (even pilot customers)", multiline: true },
  { key: "competitive_advantage", label: "Competitive advantage", multiline: true },
  { key: "traction", label: "Traction", multiline: true },
];

const ARRAY_FIELDS: { key: keyof DraftData; label: string; maxTags?: number }[] = [
  { key: "industry_tags", label: "Industry tags", maxTags: 7 },
  { key: "business_model_tags", label: "Business model tags", maxTags: 7 },
  { key: "competitors", label: "Competitors" },
];

async function renderPdfThumbnails(file: File, maxPages = 30): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const out: Blob[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const targetW = 900;
    const scale = targetW / viewport.width;
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport: scaled, canvas } as never).promise;
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.78));
    if (blob) out.push(blob);
  }
  return out;
}

export function CreateStartupWizard({
  onDone,
  resumeStartupId,
  ref,
}: {
  onDone: (startupId: string) => void;
  resumeStartupId?: string;
  ref?: React.Ref<{ goBack: () => void }>;
}) {
  const [step, setStep] = useState<Step>("deck");
  const [resumeLoading, setResumeLoading] = useState(Boolean(resumeStartupId));
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [deckStarting, setDeckStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [acceleratorChoice, setAcceleratorChoice] = useState<"yes" | "no" | null>(null);
  const [acceleratorNames, setAcceleratorNames] = useState<string[]>([]);
  const [acceleratorOther, setAcceleratorOther] = useState<string>("");
  const [programLogos, setProgramLogos] = useState<Record<string, string>>({});
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [isRegistered, setIsRegistered] = useState<"yes" | "no" | null>(null);
  const [businessId, setBusinessId] = useState<string>("");
  const [stage, setStage] = useState<string>("");

  const navigate = useNavigate();
  const fnCreateBasics = useServerFn(createStartupBasics);
  const fnUpdateBasics = useServerFn(updateStartupBasics);
  const fnCreateJob = useServerFn(createDeckParseJob);
  const fnRunJob = useServerFn(runDeckParseJob);
  const fnGetDraft = useServerFn(getMyDraft);
  const fnUpdateDraft = useServerFn(updateMyDraft);
  const fnPublish = useServerFn(publishStartupFromDraft);
  const fnSetDeck = useServerFn(setStartupPitchDeck);
  const fnUpdateFields = useServerFn(updateStartupFields);
  const fnCreateEmptyDraft = useServerFn(createEmptyDraft);
  const fnGetStartup = useServerFn(getMyStartupById);
  const fnRecordUpload = useServerFn(recordPitchDeckUpload);
  const fnAnalyzeGaps = useServerFn(analyzeDraftGaps);

  const [aiGaps, setAiGaps] = useState<string[] | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const lastAnalyzedRef = useRef<string>("");

  // Manual mode: once all mandatory fields are filled, ask the AI what's missing.
  useEffect(() => {
    if (step !== "review" || !manualMode || !draft) return;
    const required = [draft.one_liner, draft.executive_summary, draft.problem, draft.solution];
    if (required.some((v) => !v || !String(v).trim())) {
      setAiGaps(null);
      return;
    }
    const signature = JSON.stringify(draft);
    if (signature === lastAnalyzedRef.current) return;
    const t = setTimeout(async () => {
      lastAnalyzedRef.current = signature;
      setGapsLoading(true);
      try {
        const res = (await fnAnalyzeGaps({ data: { draft: draft as Record<string, unknown> } })) as {
          missing_information: string[];
        };
        setAiGaps(res.missing_information ?? []);
      } catch {
        setAiGaps(null);
      } finally {
        setGapsLoading(false);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [step, manualMode, draft, fnAnalyzeGaps]);




  useImperativeHandle(
    ref,
    () => ({
      goBack: () => {
        switch (step) {
          case "deck":
            navigate({ to: "/startups" });
            break;
          case "basics":
            setStep("deck");
            break;
      case "accelerator":
        setStep("basics");
        break;
          case "teammates":
            setStep("accelerator");
            break;
          case "review":
            setStep("teammates");
            break;
          case "parsing":
            setStep("deck");
            break;
        }
      },
    }),
    [step, navigate]
  );

  useEffect(() => {
    if (!resumeStartupId) {
      setResumeLoading(false);
      return;
    }
    setResumeLoading(true);
    (async () => {
      try {
        setProgress("Loading draft…");
        // Verify the current user actually owns this startup before resuming.
        const sres = await fnGetStartup({ data: { id: resumeStartupId } });
        const ownedStartup = (sres as {
          startup:
            | {
                id: string;
                name?: string | null;
                website?: string | null;
                logo_url?: string | null;
                is_registered?: boolean | null;
                business_id?: string | null;
                stage?: string | null;
              }
            | null;
        }).startup;
        if (!ownedStartup) {
          toast.error("This startup is not available on your account.");
          navigate({ to: "/startups" });
          return;
        }
        // Prefill basics from the saved startup so the user doesn't retype them.
        const looksPlaceholder =
          !ownedStartup.name || /^untitled/i.test(ownedStartup.name.trim());
        if (!looksPlaceholder) setName(ownedStartup.name ?? "");
        setWebsite(ownedStartup.website ?? "");
        if (ownedStartup.logo_url) setLogoPreview(ownedStartup.logo_url);
        if (typeof ownedStartup.is_registered === "boolean") {
          setIsRegistered(ownedStartup.is_registered ? "yes" : "no");
        }
        setBusinessId(ownedStartup.business_id ?? "");
        if (ownedStartup.stage) setStage(ownedStartup.stage);

        // Prefill accelerator answers so a revisit shows what was already picked.
        const savedAccelerator = (ownedStartup as { accelerator?: string | null }).accelerator;
        if (savedAccelerator && savedAccelerator.trim().length > 0) {
          setAcceleratorChoice("yes");
          setAcceleratorNames(
            savedAccelerator.split(",").map((s) => s.trim()).filter(Boolean),
          );
        }

        const savedStep = readSavedStep(resumeStartupId);

        const dres = await fnGetDraft({ data: { startupId: resumeStartupId } });
        const d = (dres as { draft: { id: string; data: DraftData } | null }).draft;
        if (!d) {
          setStartupId(resumeStartupId);
          // Continue from the furthest step the user reached before, when known.
          setStep(
            savedStep && savedStep !== "review" && savedStep !== "parsing"
              ? savedStep
              : !looksPlaceholder && ownedStartup.stage
                ? "accelerator"
                : "basics",
          );
          return;
        }
        setStartupId(resumeStartupId);
        setDraftId(d.id);
        setDraft(d.data ?? {});
        setParseStatus("done");
        setStep("review");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load draft");
        setStep("deck");
      } finally {
        setResumeLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeStartupId]);

  // If user is on the parsing step and background parse finishes, advance to review.
  useEffect(() => {
    if (step === "parsing" && parseStatus === "done") {
      setStep("review");
    }
  }, [step, parseStatus]);

  // Remember how far the user got so resuming a draft returns to the same step.
  useEffect(() => {
    if (!startupId || resumeLoading) return;
    writeSavedStep(startupId, step);
  }, [startupId, step, resumeLoading]);






  async function uploadLogo(userId: string): Promise<string | null> {
    if (!logoFile) return logoPreview;
    if (logoFile.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return null;
    }
    const ext = logoFile.name.split(".").pop() || "png";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("startup-logos").upload(path, logoFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("startup-logos").getPublicUrl(path);
    return data.publicUrl;
  }

  // Runs in the background as soon as a deck is selected: uploads PDF, renders thumbs,
  // creates the parse job, runs it, then fetches the draft.
  async function runBackgroundParse(sid: string, pdfFile: File) {
    setParseStatus("running");
    setParseError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const userId = u.user.id;
      await fnRecordUpload({ data: undefined });
      const stamp = Date.now();
      const pdfPath = `${userId}/${sid}/${stamp}.pdf`;
      const up = await supabase.storage
        .from("pitch-decks-private")
        .upload(pdfPath, pdfFile, { upsert: true, contentType: "application/pdf" });
      if (up.error) throw up.error;

      const publicPath = `${userId}/${sid}/${stamp}.pdf`;
      const pub = await supabase.storage
        .from("pitch-decks")
        .upload(publicPath, pdfFile, { upsert: true, contentType: "application/pdf" });
      if (pub.error) throw pub.error;
      const { data: urlData } = supabase.storage.from("pitch-decks").getPublicUrl(publicPath);
      await fnSetDeck({ data: { startupId: sid, pdfUrl: urlData.publicUrl, pdfPath: publicPath } });

      const thumbs = await renderPdfThumbnails(pdfFile);
      const thumbnailPaths: string[] = [];
      for (let i = 0; i < thumbs.length; i++) {
        const p = `${userId}/${sid}/${stamp}-p${i + 1}.jpg`;
        const r = await supabase.storage.from("deck-thumbnails").upload(p, thumbs[i], { upsert: true });
        if (r.error) throw r.error;
        thumbnailPaths.push(p);
      }

      const job = await fnCreateJob({ data: { startupId: sid, pdfPath, thumbnailPaths } });
      const run = await fnRunJob({ data: { jobId: (job as { jobId: string }).jobId } });
      const dId = (run as { draftId: string }).draftId;
      setDraftId(dId);

      const dres = await fnGetDraft({ data: { startupId: sid } });
      const d = (dres as { draft: { id: string; data: DraftData } | null }).draft;
      if (!d) throw new Error("Draft missing");
      setDraft(d.data ?? {});
      setParseStatus("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pitch deck parsing failed";
      setParseError(msg);
      setParseStatus("error");
      toast.error(msg);
    }
  }

  async function handleBasicsNext() {
    if (!name.trim()) return toast.error("Startup name is required");
    if (website.trim() && !isValidWebsite(website)) {
      return toast.error("Please enter a valid website URL (e.g. https://example.com)");
    }
    if (isRegistered === null) return toast.error("Please tell us if the company is registered");
    if (!stage) return toast.error("Please select your current stage");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const logo_url = await uploadLogo(u.user.id);
      const basicsExtras = {
        is_registered: isRegistered === "yes",
        business_id: isRegistered === "yes" ? businessId.trim() : null,
        stage: stage as never,
      };
      let sid = startupId;
      if (sid) {
        await fnUpdateBasics({
          data: { id: sid, name: name.trim(), website: normalizeWebsite(website), logo_url: logo_url ?? null, ...basicsExtras },
        });
      } else {
        const res = await fnCreateBasics({
          data: { name: name.trim(), website: normalizeWebsite(website), logo_url: logo_url ?? null, ...basicsExtras },
        });
        sid = (res as { startup: { id: string } }).startup.id;
        setStartupId(sid);
      }
      // Kick off background parsing if we have a PDF
      if (pdf && parseStatus === "idle") {
        void runBackgroundParse(sid, pdf);
      }
      setStep("accelerator");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save basics");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draftId || !draft) return;
    setBusy(true);
    try {
      await fnUpdateDraft({ data: { draftId, data: draft as Record<string, unknown> } });
      toast.success("Draft saved");
      navigate({ to: "/startups" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draftId || !startupId) return;
    setBusy(true);
    try {
      await fnUpdateDraft({ data: { draftId, data: (draft ?? {}) as Record<string, unknown> } });
      const res = (await fnPublish({ data: { startupId, draftId, publish: true } })) as {
        newBadges?: string[];
      };
      fireCelebrationConfetti();
      if (res?.newBadges?.length) {
        const { celebrateAchievements } = await import(
          "@/design-system/ventura-6bef42/components/startup-updates/AchievementCelebration"
        );
        celebrateAchievements(res.newBadges);
      }
      toast.success("Startup profile published · +75 XP");
      onDone(startupId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeckNext() {
    if (!pdf) return;
    setBusy(true);
    try {
      let sid = startupId;
      if (!sid) {
        const placeholder = pdf.name.replace(/\.pdf$/i, "").trim().slice(0, 80) || "Untitled startup";
        const res = await fnCreateBasics({
          data: { name: placeholder, website: null, logo_url: null },
        });
        sid = (res as { startup: { id: string } }).startup.id;
        setStartupId(sid);
        setName(placeholder);
      }
      if (parseStatus === "idle") {
        void runBackgroundParse(sid, pdf);
      }
      setStep("basics");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start analysis");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeckSelected(file: File) {
    setPdf(file);
    setParseStatus("running");
    setParseError(null);
    setDraft(null);
    setDraftId(null);
    setDeckStarting(true);
    try {
      let sid = startupId;
      if (!sid) {
        const placeholder = file.name.replace(/\.pdf$/i, "").trim().slice(0, 80) || "Untitled startup";
        const res = await fnCreateBasics({
          data: { name: placeholder, website: null, logo_url: null },
        });
        sid = (res as { startup: { id: string } }).startup.id;
        setStartupId(sid);
        setName(placeholder);
      }
      void runBackgroundParse(sid, file);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start analysis";
      setParseStatus("error");
      setParseError(message);
      toast.error(message);
    } finally {
      setDeckStarting(false);
    }
  }

  if (step === "deck") {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Upload your pitch deck (PDF)</h3>
          <p className="text-sm text-muted-foreground">
            Start here. While you fill in the next few details, our AI will read your deck
            and pre-fill your startup profile — so you only need to review and publish.
          </p>
          <PdfDropzone
            pdf={pdf}
            onFile={(f) => {
              if (f) void handleDeckSelected(f);
            }}
            onClear={() => {
              setPdf(null);
              setParseStatus("idle");
              setParseError(null);
              setDraft(null);
              setDraftId(null);
            }}
          />
          <div className={`flex flex-col-reverse sm:flex-row ${pdf ? "sm:justify-end" : "sm:justify-between"} sm:items-center gap-2`}>
            {!pdf && (
              <Button
                variant="ghost"
                onClick={() => {
                  setManualMode(true);
                  setPdf(null);
                  setStep("basics");
                }}
                disabled={busy}
              >
                I'll enter all the data manually
              </Button>
            )}
            <Button onClick={handleDeckNext} disabled={!pdf || busy || deckStarting}>
              {busy || deckStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }


  if (step === "basics") {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Startup basics</h3>
          <div className="space-y-2">
            <Label>Startup name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
          </div>
          <div className="space-y-2">
            <Label>Logo (optional)</Label>
            <LogoDropzone
              logoPreview={logoPreview}
              onFile={(f) => {
                setLogoFile(f);
                if (f) setLogoPreview(URL.createObjectURL(f));
              }}
              onClear={() => {
                setLogoFile(null);
                setLogoPreview(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Website (optional)</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
            />
            {website.trim() && !isValidWebsite(website) && (
              <p className="text-xs text-destructive">Enter a valid URL like https://example.com</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Is your company registered? *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isRegistered === "yes" ? "default" : "outline"}
                onClick={() => setIsRegistered("yes")}
                size="sm"
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={isRegistered === "no" ? "default" : "outline"}
                onClick={() => { setIsRegistered("no"); setBusinessId(""); }}
                size="sm"
              >
                No
              </Button>
            </div>
            {isRegistered === "yes" && (
              <div className="space-y-1.5 pt-2">
                <Label>Business ID</Label>
                <Input
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  placeholder="e.g. 1234567-8"
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>On what stage you are? *</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select stage…" />
              </SelectTrigger>
              <SelectContent>
                {["Idea","Validating Problem","Building MVP","MVP Launched","Pilot / Beta","Early Traction","Revenue","Scaling"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("deck")} disabled={busy}>
              Back
            </Button>
            <Button onClick={handleBasicsNext} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "accelerator" && startupId) {
    const hasOther = acceleratorNames.includes(OTHER_PROGRAM_OPTION);
    const otherValid = !hasOther || acceleratorOther.trim().length > 0;
    const canContinue =
      acceleratorChoice === "no" ||
      (acceleratorChoice === "yes" && acceleratorNames.length > 0 && otherValid);

    async function handleAcceleratorNext() {
      if (!startupId) return;
      setBusy(true);
      try {
        let value: string | null = null;
        const logos: Record<string, string> = {};
        if (acceleratorChoice === "yes") {
          const names = acceleratorNames
            .map((n) => (n === OTHER_PROGRAM_OPTION ? acceleratorOther.trim() : n))
            .filter((n) => n.length > 0);
          value = names.length > 0 ? names.join(", ") : null;
          for (const original of acceleratorNames) {
            const finalName = original === OTHER_PROGRAM_OPTION ? acceleratorOther.trim() : original;
            if (!finalName) continue;
            const url = programLogos[original];
            if (url) logos[finalName] = url;
          }
        }
        await fnUpdateFields({ data: { startupId, data: { accelerator: value, program_logos: logos } } });
        setStep("teammates");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      } finally {
        setBusy(false);
      }
    }

    return (
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <div className="relative border-b bg-gradient-to-br from-primary/5 via-background to-background px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold leading-tight">
                Accelerator or incubator background
              </h3>
              <p className="text-sm text-muted-foreground">
                Tell us if this startup has been part of a Finnish ecosystem program.
              </p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "yes", label: "Yes", desc: "We joined a program", icon: Check },
              { value: "no", label: "No", desc: "Not part of any", icon: X },
            ] as const).map(({ value, label, desc, icon: Icon }) => {
              const active = acceleratorChoice === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAcceleratorChoice(value);
                    if (value === "no") {
                      setAcceleratorNames([]);
                      setAcceleratorOther("");
                    }
                  }}
                  className={`group relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  {active && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {acceleratorChoice === "yes" && (
            <div className="space-y-5 rounded-xl border border-dashed bg-muted/20 p-5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Choose ecosystem program
                </Label>
                <MultiSelectCombobox
                  options={FINNISH_ACCELERATORS}
                  pinnedOption={OTHER_PROGRAM_OPTION}
                  values={acceleratorNames}
                  onChange={setAcceleratorNames}
                  placeholder="Select a Finnish ecosystem program"
                  modal
                  modalTitle="Choose ecosystem program"
                  renderOption={(opt) =>
                    opt === OTHER_PROGRAM_OPTION ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/40 text-muted-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="truncate text-sm font-medium">{opt}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <ProgramLogo name={opt} size={32} />
                        <span className="truncate text-sm">{opt}</span>
                      </div>
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Search and select one or more programs. Pick "Other / Not listed" to add a custom one.
                </p>
              </div>

              {acceleratorNames.filter((n) => n !== OTHER_PROGRAM_OPTION).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Selected programs
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {acceleratorNames
                      .filter((n) => n !== OTHER_PROGRAM_OPTION)
                      .map((n) => (
                        <div
                          key={n}
                          className="group flex items-center gap-3 rounded-lg border bg-background p-2.5 pr-2 shadow-sm transition-shadow hover:shadow"
                        >
                          <ProgramLogo
                            name={n}
                            logoUrl={programLogos[n] ?? null}
                            onCustomLogo={(url) =>
                              setProgramLogos((m) => ({ ...m, [n]: url }))
                            }
                          />
                          <div className="flex-1 truncate text-sm font-medium">{n}</div>
                          <button
                            type="button"
                            onClick={() =>
                              setAcceleratorNames((v) => v.filter((x) => x !== n))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Remove ${n}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {hasOther && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="accelerator-other" className="flex items-center gap-2 text-sm font-medium">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      Enter program name
                    </Label>
                    <Input
                      id="accelerator-other"
                      placeholder="e.g. My Custom Program"
                      value={acceleratorOther}
                      onChange={(e) => setAcceleratorOther(e.target.value)}
                    />
                  </div>
                  <OtherProgramLogoUploader
                    logoUrl={programLogos[OTHER_PROGRAM_OPTION] ?? null}
                    onLogo={(url) =>
                      setProgramLogos((m) => ({ ...m, [OTHER_PROGRAM_OPTION]: url }))
                    }
                    onRemove={() =>
                      setProgramLogos((m) => {
                        const next = { ...m };
                        delete next[OTHER_PROGRAM_OPTION];
                        return next;
                      })
                    }
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("basics")} disabled={busy}>
              Back
            </Button>
            <Button onClick={handleAcceleratorNext} disabled={!canContinue || busy} size="lg">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }


  if (step === "teammates" && startupId) {
    return (
      <TeammatesStep
        startupId={startupId}
        onBack={() => setStep("accelerator")}
        onContinue={async () => {
          if (manualMode) {
            try {
              setBusy(true);
              let dId = draftId;
              if (!dId) {
                const res = await fnCreateEmptyDraft({ data: { startupId } });
                dId = (res as { draftId: string }).draftId;
                setDraftId(dId);
                setDraft({});
              }
              setStep("review");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not start review");
            } finally {
              setBusy(false);
            }
            return;
          }
          setStep(parseStatus === "done" ? "review" : "parsing");
        }}
      />
    );
  }

  if (resumeLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4">
          <Loader
            size="md"
            title="Loading your saved data…"
            subtitle="Getting your saved information ready. This only takes a moment."
          />
        </CardContent>
      </Card>
    );
  }

  if (step === "parsing") {
    const isError = parseStatus === "error";
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4">
          {isError ? (
            <>
              <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">We couldn't analyse your deck</p>
                <p className="text-sm text-muted-foreground mt-1">{parseError ?? "Something went wrong."}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParseStatus("idle");
                    setStep("deck");
                  }}
                >
                  Re-upload deck
                </Button>
                <Button
                  onClick={() => {
                    if (pdf && startupId) {
                      setStep("parsing");
                      void runBackgroundParse(startupId, pdf);
                    }
                  }}
                  disabled={!pdf || !startupId}
                >
                  Try again
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader
                size="md"
                title={pdf ? "Finalising your startup profile…" : "Loading your saved data…"}
                subtitle={pdf
                  ? "Our AI is reading your pitch deck. You'll be taken to the review step in a moment."
                  : "Getting your saved information ready. This only takes a moment."}
              />
              {pdf && (
                <p className="text-xs text-muted-foreground">
                  Typical decks take 30–90 seconds. {progress}
                </p>
              )}
            </>

          )}
        </CardContent>
      </Card>
    );
  }

  // review
  const d = draft ?? {};
  return (
    <>
      <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Review your startup profile draft</h3>
            <p className="text-sm text-muted-foreground">
              {manualMode
                ? "Fill in each field below, then publish your startup profile."
                : "Edit anything that's wrong. Fields marked as missing weren't found in the deck."}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-primary mt-1" />
        </div>

        {manualMode && gapsLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI is reviewing your profile for missing information…
          </div>
        )}

        <div className="grid gap-4">
          {TEXT_FIELDS.map((f) => {
            const v = (d[f.key] as string | null | undefined) ?? "";
            const missing = !v;
            const maxChars = f.key === "one_liner" ? MAX_SHORT_FIELD_CHARS : MAX_REVIEW_FIELD_CHARS;
            const atLimit = v.length >= maxChars;
            return (
              <div key={String(f.key)} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    {f.label}
                    {missing && <span className="text-xs text-amber-700">(missing)</span>}
                  </Label>
                  <span className={`text-xs tabular-nums ${atLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {v.length}/{maxChars}
                  </span>
                </div>
                {f.multiline ? (
                  <textarea
                    className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={v}
                    maxLength={maxChars}
                    onChange={(e) => setDraft({ ...d, [f.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    value={v}
                    maxLength={maxChars}
                    onChange={(e) => setDraft({ ...d, [f.key]: e.target.value })}
                  />
                )}
              </div>
            );
          })}

          {ARRAY_FIELDS.map((f) => {
            const arr = (d[f.key] as string[] | undefined) ?? [];
            const maxChars = f.key === "industry_tags" || f.key === "business_model_tags" || f.key === "competitors"
              ? MAX_SHORT_FIELD_CHARS
              : MAX_REVIEW_FIELD_CHARS;
            return (
              <ArrayField
                key={String(f.key)}
                label={f.label}
                value={arr}
                maxLength={maxChars}
                maxTags={f.maxTags}
                onChange={(next) => setDraft({ ...d, [f.key]: next })}
              />
            );
          })}
        </div>

        {(() => {
          const source = manualMode
            ? (aiGaps ?? [])
            : (Array.isArray(d.missing_information) ? d.missing_information : []);
          const filtered = source.filter((m) => {
            const s = m.toLowerCase();
            return !/(company name|website|country|team member|investor readiness|investment case|why this is a good investment)/.test(s);
          });
          if (filtered.length === 0) return null;

          return (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium mb-1">Missing information detected:</p>
              <ul className="list-disc list-inside text-muted-foreground">
                {filtered.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          );
        })()}

        {(() => {
          const requiredEmpty = [
            d.one_liner,
            d.executive_summary,
            d.problem,
            d.solution,
          ].some((v) => !v || !String(v).trim());
          return (
            <div className="flex flex-col gap-2 pt-2 border-t">
              {requiredEmpty && (
                <p className="text-sm text-destructive">
                  One-liner, executive summary, problem and solution are required before publishing.
                </p>
              )}
              <div className="flex justify-between">
                <Button variant="outline" onClick={saveDraft} disabled={busy}>
                  Save draft
                </Button>
                <Button onClick={() => setShowPublishDialog(true)} disabled={busy || requiredEmpty}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish startup profile"}
                </Button>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>

    <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldQuestion className="h-6 w-6 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-lg font-semibold">
            Ready to publish?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base leading-relaxed">
            Are you sure you have reviewed all the items? AI is your assistant but not responsible for your decisions!
            <br /><br />
            <span className="text-muted-foreground">We love you,</span>
            <br />
            <span className="font-semibold">team Ventura</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-3">
          <AlertDialogCancel className="min-w-[120px]">Check again</AlertDialogCancel>
          <AlertDialogAction onClick={publish} className="min-w-[120px]">
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function LogoDropzone({
  logoPreview,
  onFile,
  onClear,
}: {
  logoPreview: string | null;
  onFile: (f: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      {logoPreview && (
        <div className="flex items-center gap-3">
          <img src={logoPreview} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-border" />
          <span className="text-sm text-muted-foreground">Logo uploaded</span>
        </div>
      )}
      <FileUpload
        accept="image/*"
        acceptedFileTypes={["image/"]}
        maxFileSize={10 * 1024 * 1024}
        hint="PNG, JPG or SVG · square works best"
        currentFileName={logoPreview ? "Logo uploaded" : null}
        onFileSelect={(f) => onFile(f)}
        onFileRemove={logoPreview ? onClear : undefined}
        onUploadError={(e) => toast.error(e.message)}
        compact
      />
    </div>
  );
}

function PdfDropzone({
  pdf,
  onFile,
  onClear,
}: {
  pdf: File | null;
  onFile: (f: File | null) => void;
  onClear: () => void;
}) {
  return (
    <FileUpload
      accept="application/pdf"
      acceptedFileTypes={["application/pdf"]}
      maxFileSize={50 * 1024 * 1024}
      hint="Your pitch deck · PDF only, up to 50 MB"
      currentFile={pdf}
      onFileSelect={(f) => onFile(f)}
      onFileRemove={pdf ? onClear : undefined}
      onUploadError={(e) => toast.error(e.message)}
    />
  );
}

function ArrayField({
  label,
  value,
  maxLength,
  maxTags,
  onChange,
}: {
  label: string;
  value: string[];
  maxLength?: number;
  maxTags?: number;
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState<string>(value.join(", "));
  const lastExternal = useRef<string>(value.join(", "));

  useEffect(() => {
    const joined = value.join(", ");
    if (joined !== lastExternal.current) {
      lastExternal.current = joined;
      setText(joined);
    }
  }, [value]);

  const commit = (raw: string) => {
    let next = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (maxTags != null && next.length > maxTags) {
      next = next.slice(0, maxTags);
    }
    lastExternal.current = next.join(", ");
    onChange(next);
  };

  const atLimit = maxLength != null && text.length >= maxLength;
  const tagCount = text.split(",").filter((s) => s.trim()).length;
  const atTagLimit = maxTags != null && tagCount >= maxTags;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>
          {label} <span className="text-xs text-muted-foreground">(comma separated)</span>
        </Label>
        <div className="flex items-center gap-2">
          {maxTags != null && (
            <span className={`text-xs tabular-nums ${atTagLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {tagCount}/{maxTags} tags
            </span>
          )}
          {maxLength != null && (
            <span className={`text-xs tabular-nums ${atLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {text.length}/{maxLength}
            </span>
          )}
        </div>
      </div>
      <Input
        value={text}
        maxLength={maxLength}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  );
}



