import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { FileText, Upload, ExternalLink, Pencil, Loader2, Sparkles, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { setStartupPitchDeck, publishStartupFromDraft } from "@/design-system/ventura-6bef42/lib/startup.functions";
import { createDeckParseJob, runDeckParseJob } from "@/design-system/ventura-6bef42/lib/deck-parse.functions";
import { recordPitchDeckUpload } from "@/design-system/ventura-6bef42/lib/pitch-deck-quota.functions";
import { useFileDrop } from "@/design-system/ventura-6bef42/lib/drop";
import { FileUpload } from "@/design-system/ventura-6bef42/components/ui/file-upload";

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

export function PitchDeckCard({
  startupId,
  pitchDeckUrl,
  onChanged,
}: {
  startupId: string;
  pitchDeckUrl: string | null;
  onChanged: (url: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [regenerate, setRegenerate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fnSetDeck = useServerFn(setStartupPitchDeck);
  const fnCreateJob = useServerFn(createDeckParseJob);
  const fnRunJob = useServerFn(runDeckParseJob);
  const fnPublish = useServerFn(publishStartupFromDraft);
  const fnRecordUpload = useServerFn(recordPitchDeckUpload);

  async function handleSave() {
    if (!file) return toast.error("Choose a PDF");
    if (file.size > 50 * 1024 * 1024) return toast.error("File must be smaller than 50 MB");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const userId = u.user.id;
      await fnRecordUpload({ data: undefined });
      const stamp = Date.now();

      // Upload to public bucket so viewers can open it
      setProgress("Uploading pitch deck…");
      const publicPath = `${userId}/${startupId}/${stamp}.pdf`;
      const pub = await supabase.storage
        .from("pitch-decks")
        .upload(publicPath, file, { upsert: true, contentType: "application/pdf" });
      if (pub.error) throw pub.error;
      const { data: urlData } = supabase.storage.from("pitch-decks").getPublicUrl(publicPath);
      const publicUrl = urlData.publicUrl;

      await fnSetDeck({ data: { startupId, pdfUrl: publicUrl, pdfPath: publicPath } });

      if (regenerate) {
        // Also store privately for AI parsing + render thumbnails
        setProgress("Preparing AI analysis…");
        const privPath = `${userId}/${startupId}/${stamp}.pdf`;
        const priv = await supabase.storage
          .from("pitch-decks-private")
          .upload(privPath, file, { upsert: true, contentType: "application/pdf" });
        if (priv.error) throw priv.error;

        setProgress("Rendering page thumbnails…");
        const thumbs = await renderPdfThumbnails(file);
        const thumbnailPaths: string[] = [];
        for (let i = 0; i < thumbs.length; i++) {
          const p = `${userId}/${startupId}/${stamp}-p${i + 1}.jpg`;
          const r = await supabase.storage
            .from("deck-thumbnails")
            .upload(p, thumbs[i], { upsert: true });
          if (r.error) throw r.error;
          thumbnailPaths.push(p);
        }

        setProgress("Creating parse job…");
        const job = await fnCreateJob({
          data: { startupId, pdfPath: privPath, thumbnailPaths },
        });

        setProgress("Analysing deck with AI…");
        const run = await fnRunJob({ data: { jobId: (job as { jobId: string }).jobId } });
        const draftId = (run as { draftId: string }).draftId;

        setProgress("Updating your profile…");
        await fnPublish({ data: { startupId, draftId, publish: true } });
        toast.success("Pitch deck saved and profile regenerated");
      } else {
        toast.success("Pitch deck updated");
      }

      onChanged(publicUrl);
      setEditing(false);
      setFile(null);
      setRegenerate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save pitch deck");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function handleRemove() {
    if (!confirm("Remove the current pitch deck?")) return;
    setBusy(true);
    try {
      await fnSetDeck({ data: { startupId, pdfUrl: null, pdfPath: null } });
      onChanged(null);
      toast.success("Pitch deck removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  const { dropProps, dragging } = useFileDrop({
    onFile: (f) => {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please drop a PDF file");
        return;
      }
      setEditing(true);
      setFile(f);
    },
    disabled: busy,
  });

  return (
    <Card className={`rounded-2xl ${dragging ? "ring-2 ring-primary" : ""}`} {...dropProps}>
      <CardContent className="p-6">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pitch deck</h2>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {!editing ? (
              pitchDeckUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border bg-muted/30">
                    <iframe
                      src={`${pitchDeckUrl}#toolbar=0&navpanes=0`}
                      title="Pitch deck preview"
                      className="block aspect-[4/3] w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={pitchDeckUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleRemove} disabled={busy} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" /> Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto h-6 w-6 mb-2" />
                  No pitch deck uploaded yet.
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Upload className="h-3.5 w-3.5" /> Upload pitch deck
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label>PDF file (max 100 MB)</Label>
                  <FileUpload
                    accept="application/pdf"
                    acceptedFileTypes={["application/pdf"]}
                    maxFileSize={100 * 1024 * 1024}
                    hint="PDF only, up to 100 MB"
                    currentFile={file}
                    onFileSelect={(f) => setFile(f)}
                    onFileRemove={file ? () => setFile(null) : undefined}
                    onUploadError={(e) => toast.error(e.message)}
                    busy={busy}
                    busyLabel={progress || undefined}
                  />
                </div>


                <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 cursor-pointer hover:bg-muted/30 transition">
                  <input
                    type="checkbox"
                    checked={regenerate}
                    onChange={(e) => setRegenerate(e.target.checked)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Update startup profile from this deck with AI
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Re-analyse the deck and overwrite your profile content (executive summary, problem, solution, market, traction, team…). This can take 30–90 seconds.
                    </p>
                  </div>
                </label>

                {busy && progress && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={handleSave} disabled={busy || !file}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {regenerate ? "Save & regenerate" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setFile(null);
                      setRegenerate(false);
                    }}
                    disabled={busy}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

