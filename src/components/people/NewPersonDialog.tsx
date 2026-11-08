import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  Database,
  FileText,
  Globe2,
  Linkedin,
  Loader2,
  MapPin,
  NotebookPen,
  PenLine,
  Search,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { AvatarBadge } from "@/components/review/AvatarBadge";
import { ChatMarkdown } from "@/design-system/ventura-6bef42/components/ChatMarkdown";
import { PriorityChips } from "@/components/review/PriorityChips";
import { avatarLocation, peopleLabel, type Avatar } from "@/lib/engine/avatars";
import { rankPriorities } from "@/lib/engine/priorities";
import { personalizedAvatarWeights } from "@/lib/engine/avatar-personalization";
import { RECAP_TOPIC_CATALOG } from "@/lib/engine/recap";
import { extractPersonFileText, personFileSupported, PERSON_FILE_ACCEPT } from "@/lib/people/extract-text";
import { personAvatar, personCompany, personTopics } from "@/lib/people/build";
import { downscalePhoto, researchPerson } from "@/lib/people/client";
import { normalizeLinkedIn, PERSON_TEXT_LIMIT } from "@/lib/people/types";
import { useAccount } from "@/lib/state/account-context";
import { usePreferences } from "@/lib/state/preferences-store";

type Kind = "crm" | "notes";
type Step = "reading" | "searching" | "writing" | "photo";
const STEPS: Array<{ id: Step; label: string; icon: LucideIcon }> = [
  { id: "reading", label: "Reading what you gave", icon: FileText },
  { id: "searching", label: "Searching the web", icon: Globe2 },
  { id: "writing", label: "Building the profile", icon: Sparkles },
  { id: "photo", label: "Looking for a photo", icon: Camera },
];

type Phase = { kind: "input" } | { kind: "working"; step: Step; queries: string[] } | { kind: "done"; person: Avatar } | { kind: "error"; message: string };

const MAX_FILES = 3;

/** One of the four ways to describe the person. */
function Option({ icon: Icon, title, filled, tone, children }: { icon: LucideIcon; title: string; filled: boolean; tone: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border-2 bg-card p-4 transition-colors",
        filled ? "border-lind-green" : "border-lind-line focus-within:border-lind-blue",
      )}
    >
      <header className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="min-w-0 flex-1 text-base font-bold text-lind-ink">{title}</h3>
        {filled && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lind-green text-white" aria-label="Added">
            <Check className="h-4 w-4" />
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function FileList({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="space-y-1.5">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-lind-mist px-2.5 py-1.5 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-lind-grey" />
          <span className="min-w-0 flex-1 truncate text-lind-ink">{f.name}</span>
          <button type="button" onClick={() => onRemove(i)} className="cursor-pointer rounded-full p-0.5 text-lind-grey hover:bg-card hover:text-lind-ink" aria-label={`Remove ${f.name}`}>
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function NewPersonDialog({ open, onOpenChange, onGenerate, existing }: { open: boolean; onOpenChange: (o: boolean) => void; onGenerate: (person: Avatar) => void; existing?: Avatar | null }) {
  const a = useAccount();
  const prefs = usePreferences();
  const [linkedin, setLinkedin] = useState("");
  const [manual, setManual] = useState("");
  const [files, setFiles] = useState<Record<Kind, File[]>>({ crm: [], notes: [] });
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const picker = useRef<HTMLInputElement>(null);
  const pickFor = useRef<Kind>("crm");
  const abort = useRef<AbortController | null>(null);

  const linkedinUrl = normalizeLinkedIn(linkedin);
  const linkedinInvalid = !!linkedin.trim() && !linkedinUrl;
  const ready = !linkedinInvalid && (!!linkedinUrl || !!manual.trim() || files.crm.length + files.notes.length > 0);

  const reset = () => {
    setLinkedin("");
    setManual("");
    setFiles({ crm: [], notes: [] });
    setPhase({ kind: "input" });
  };
  useEffect(() => {
    if (!open) {
      abort.current?.abort();
      abort.current = null;
      // Clear after the closing animation.
      const t = setTimeout(reset, 200);
      return () => clearTimeout(t);
    }
    // Updating an existing person starts from what is already known.
    if (existing) setLinkedin(existing.linkedin ?? "");
  }, [open, existing]);

  const addFiles = (list: FileList | null) => {
    const kind = pickFor.current;
    const chosen = [...(list ?? [])];
    const bad = chosen.filter((f) => !personFileSupported(f.name));
    if (bad.length) toast.error(`${bad.map((f) => f.name).join(", ")}: use PDF, Word (.docx), Excel, PowerPoint (.pptx) or text files.`);
    const ok = chosen.filter((f) => personFileSupported(f.name));
    setFiles((cur) => {
      const next = [...cur[kind], ...ok].slice(0, MAX_FILES);
      if (cur[kind].length + ok.length > MAX_FILES) toast.message(`Up to ${MAX_FILES} files here`);
      return { ...cur, [kind]: next };
    });
  };
  const choose = (kind: Kind) => {
    pickFor.current = kind;
    picker.current?.click();
  };

  const run = async () => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase({ kind: "working", step: "reading", queries: [] });
    try {
      const read = await Promise.all(
        (["crm", "notes"] as Kind[]).flatMap((kind) => files[kind].map(async (f) => ({ name: f.name, kind, text: await extractPersonFileText(f) }))),
      );
      const empty = read.filter((r) => !r.text.trim());
      if (empty.length && empty.length === read.length && !manual.trim() && !linkedinUrl) throw new Error(`No text could be read from ${empty.map((f) => f.name).join(", ")}.`);
      if (ctrl.signal.aborted) return;
      setPhase({ kind: "working", step: "searching", queries: [] });
      const result = await researchPerson(
        {
          company: personCompany(a.customer, a.dataset, a.settings.companyDomain ?? a.customer.website ?? null),
          linkedin: linkedinUrl,
          manual: manual.slice(0, PERSON_TEXT_LIMIT),
          files: read.filter((r) => r.text.trim()).map((r) => ({ ...r, text: r.text.slice(0, Math.floor(PERSON_TEXT_LIMIT / Math.max(1, read.length))) })),
          topics: personTopics(),
        },
        ctrl.signal,
        (ev) =>
          setPhase((p) => {
            if (p.kind !== "working") return p;
            if (ev.type === "query") return { ...p, step: "searching", queries: p.queries.includes(ev.query) ? p.queries : [...p.queries, ev.query].slice(-4) };
            if (ev.type === "writing") return { ...p, step: "writing" };
            if (ev.type === "photo") return { ...p, step: "photo" };
            return p;
          }),
      );
      if (ctrl.signal.aborted) return;
      const photo = result.photo ? await downscalePhoto(result.photo) : null;
      if (ctrl.signal.aborted) return;
      const person = personAvatar(
        { ...result, photo, photoSource: photo ? result.photoSource : null },
        { customer: a.customer, dataset: a.dataset, id: existing?.id ?? `person-${crypto.randomUUID()}`, linkedin: linkedinUrl, now: new Date().toISOString() },
      );
      // Updating keeps the person's identity and anything the new research did not replace.
      const merged: Avatar = existing
        ? {
            ...person,
            id: existing.id,
            createdAt: existing.createdAt,
            name: person.name || existing.name,
            photo: person.photo ?? existing.photo ?? null,
            photoSource: person.photo ? person.photoSource : (existing.photoSource ?? null),
            linkedin: linkedinUrl ?? existing.linkedin ?? null,
          }
        : person;
      prefs.upsertAvatar(merged);
      setPhase({ kind: "done", person: merged });
    } catch (e) {
      if ((e as Error).name === "AbortError" || ctrl.signal.aborted) return;
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong. Try again." });
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  };

  const working = phase.kind === "working";

  useEffect(() => () => abort.current?.abort(), []);

  return (
    <Dialog open={open} onOpenChange={(o) => (!working || !o ? onOpenChange(o) : undefined)}>
      <DialogContent className="max-h-svh max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-lind-navy">
            <AvatarBadge avatar={phase.kind === "done" ? phase.person : (existing ?? {})} size="md" />
            {phase.kind === "done" ? peopleLabel(phase.person) : existing ? `Update ${peopleLabel(existing)}` : "Who is the next person?"}
          </DialogTitle>
        </DialogHeader>

        <input
          ref={picker}
          type="file"
          multiple
          accept={PERSON_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {phase.kind === "input" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Option icon={Linkedin} title="LinkedIn profile" filled={!!linkedinUrl} tone="bg-lind-blue/10 text-lind-blue">
                <Input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="linkedin.com/in/…"
                  aria-label="LinkedIn profile link"
                  aria-invalid={linkedinInvalid}
                  inputMode="url"
                  className="h-11 text-base"
                />
                {linkedinInvalid && <p className="text-sm text-destructive">Paste a linkedin.com/in/ profile link</p>}
              </Option>

              <Option icon={Database} title="CRM file" filled={files.crm.length > 0} tone="bg-lind-purple/10 text-lind-purple">
                <FileList files={files.crm} onRemove={(i) => setFiles((c) => ({ ...c, crm: c.crm.filter((_, j) => j !== i) }))} />
                <Button variant="outline" className="w-full" onClick={() => choose("crm")} disabled={files.crm.length >= MAX_FILES}>
                  <Upload /> Upload
                </Button>
              </Option>

              <Option icon={NotebookPen} title="Meeting or private notes" filled={files.notes.length > 0} tone="bg-lind-orange/10 text-lind-orange">
                <FileList files={files.notes} onRemove={(i) => setFiles((c) => ({ ...c, notes: c.notes.filter((_, j) => j !== i) }))} />
                <Button variant="outline" className="w-full" onClick={() => choose("notes")} disabled={files.notes.length >= MAX_FILES}>
                  <Upload /> Upload
                </Button>
              </Option>

              <Option icon={PenLine} title="Write it yourself" filled={!!manual.trim()} tone="bg-lind-green/10 text-lind-green">
                <Textarea
                  value={manual}
                  onChange={(e) => setManual(e.target.value.slice(0, PERSON_TEXT_LIMIT))}
                  rows={4}
                  placeholder="Name, role, where they work, what they care about…"
                  aria-label="About the person"
                  className="text-base"
                />
              </Option>
            </div>
            <p className="text-center text-sm text-lind-grey">PDF · Word · Excel · PowerPoint · text</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="lg" onClick={() => void run()} disabled={!ready}>
                <Search /> {existing ? "Update this person" : "Find this person"}
              </Button>
            </div>
          </>
        )}

        {phase.kind === "working" && (
          <div className="space-y-5 py-2">
            <ol className="space-y-3">
              {STEPS.map((s, i) => {
                const at = STEPS.findIndex((x) => x.id === phase.step);
                const state = i < at ? "done" : i === at ? "active" : "todo";
                return (
                  <li key={s.id} className={cn("flex items-center gap-4 rounded-xl border-2 p-4", state === "active" ? "border-lind-blue bg-lind-blue/5" : "border-lind-line")}>
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                        state === "done" ? "bg-lind-green text-white" : state === "active" ? "bg-lind-blue text-white" : "bg-lind-mist text-lind-grey",
                      )}
                    >
                      {state === "done" ? <Check className="h-5 w-5" /> : state === "active" ? <Loader2 className="h-5 w-5 animate-spin" /> : <s.icon className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-base font-bold", state === "todo" ? "text-lind-grey" : "text-lind-ink")}>{s.label}</span>
                      {s.id === "searching" && state === "active" && phase.queries.length > 0 && (
                        <span className="mt-1 block truncate text-sm text-lind-grey">“{phase.queries[phase.queries.length - 1]}”</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  abort.current?.abort();
                  setPhase({ kind: "input" });
                }}
              >
                Stop
              </Button>
            </div>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="space-y-4 py-2">
            <p role="alert" className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4 text-base text-lind-ink">
              {phase.message}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="lg" onClick={() => setPhase({ kind: "input" })}>
                Back
              </Button>
              <Button size="lg" onClick={() => void run()}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {phase.kind === "done" && <PersonResult person={phase.person} onGenerate={() => onGenerate(phase.person)} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PersonResult({ person, onGenerate, onDone }: { person: Avatar; onGenerate: () => void; onDone: () => void }) {
  const questions = (person.recapTopics ?? []).map((id) => person.recapQuestions?.[id] ?? RECAP_TOPIC_CATALOG.find((t) => t.id === id)?.question).filter(Boolean) as string[];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
        <span className="font-semibold text-lind-ink">{person.role}</span>
        <span className="inline-flex items-center gap-1.5 text-lind-grey">
          <MapPin className="h-4 w-4" /> {avatarLocation(person)}
        </span>
      </div>
      {person.summary && <ChatMarkdown className="text-base text-lind-grey">{person.summary}</ChatMarkdown>}

      {!!person.wantsToSee?.length && (
        <ul className="space-y-2">
          {person.wantsToSee.map((w) => (
            <li key={w} className="flex items-start gap-3 rounded-lg bg-lind-green/5 p-3 text-base text-lind-ink">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lind-green" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <PriorityChips ranked={rankPriorities(personalizedAvatarWeights(person))} weights={personalizedAvatarWeights(person)} max={3} />

      {questions.length > 0 && (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={q} className="flex items-center gap-3 rounded-lg border-2 border-lind-line p-3 text-base font-semibold text-lind-navy">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lind-navy text-sm font-bold text-white">{i + 4}</span>
              {q}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-lind-line pt-4">
        <Button variant="ghost" size="lg" onClick={onDone}>
          Done
        </Button>
        <Button size="lg" onClick={onGenerate}>
          <Sparkles /> Generate report
        </Button>
      </div>
    </div>
  );
}
