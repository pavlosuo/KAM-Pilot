import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileDown, Loader2, NotebookPen, Presentation, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Switch } from "@/design-system/ventura-6bef42/components/ui/switch";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { useAccount } from "@/lib/state/account-context";
import { SlidePreview, useDeckLayout } from "@/components/review/SlidePreview";
import { buildDeck, deckSections, type SectionId } from "@/lib/export/deck";
import { downloadBlob, exportPalette } from "@/lib/export/colors";
import { usePowerPoint } from "@/lib/export/use-powerpoint";

export const Route = createFileRoute("/account/$account/review")({
  head: () => ({
    meta: [
      { title: "Presentation - Lindström customer value review" },
      { name: "description", content: "The Recap as a customer-ready presentation: cover, five questions with visuals, next steps and sources, as PowerPoint or PDF." },
      { property: "og:title", content: "Presentation - Lindström customer value review" },
      { property: "og:description", content: "The Recap as a customer-ready PowerPoint or PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const a = useAccount();
  const [off, setOff] = useState<SectionId[]>([]);
  const [busy, setBusy] = useState(false);
  const notes = a.settings.reviewNotes;

  const all = useMemo(() => deckSections(a.recap), [a.recap]);
  // Sections are kept as exclusions so a new person's questions are included automatically.
  const sections = useMemo(() => all.map((s) => s.id).filter((id) => !off.includes(id) && (id !== "notes" || !!notes.trim())), [all, off, notes]);
  const deck = useMemo(() => buildDeck(a, { sections }), [a, sections]);
  const powerpoint = usePowerPoint(deck);
  const slides = useDeckLayout(deck);
  const pp = powerpoint.state;

  const pdf = async () => {
    setBusy(true);
    try {
      const { deckToPdf } = await import("@/lib/export/pdf");
      downloadBlob(await deckToPdf(deck, exportPalette()), `${deck.fileBase}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "The PDF could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-lind-navy">Presentation</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {slides
            ? slides.map((s, i) => <SlidePreview key={`${deck.slides[i]?.kind}-${i}`} slide={s} index={i} />)
            : deck.slides.map((s, i) => <div key={`${s.kind}-${i}`} className="aspect-video w-full animate-pulse rounded-lg bg-card shadow-lind" />)}
          {deck.slides.length === 0 && (
            <Card className="flex aspect-video items-center justify-center p-6 text-lg font-semibold text-lind-grey">Switch on a section</Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="space-y-3 p-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                if (pp?.status === "ready") downloadBlob(pp.file.blob, pp.file.filename);
                else if (pp?.status === "error") powerpoint.retry();
              }}
              disabled={!pp || pp.status === "preparing" || deck.slides.length === 0}
            >
              {!pp || pp.status === "preparing" ? <Loader2 className="animate-spin" /> : pp.status === "error" ? <RotateCw /> : <Presentation />}
              {pp?.status === "ready" ? "PowerPoint" : pp?.status === "error" ? "Try PowerPoint again" : "Preparing PowerPoint…"}
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => void pdf()} disabled={busy || deck.slides.length === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <FileDown />} PDF
            </Button>
            {pp?.status === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {pp.error}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <p className="eyebrow text-lind-grey">Sections</p>
            <ul className="mt-3 space-y-3">
              {all.map((s) => {
                const disabled = s.id === "notes" && !notes.trim();
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`sec-${s.id}`} className="min-w-0 cursor-pointer text-sm leading-snug">
                      {s.label}
                    </Label>
                    <Switch
                      id={`sec-${s.id}`}
                      checked={sections.includes(s.id)}
                      disabled={disabled}
                      onCheckedChange={(v) => setOff((cur) => (v ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-4">
            <Label htmlFor="kam-notes" className="eyebrow flex items-center gap-2 text-lind-grey">
              <NotebookPen className="h-4 w-4" /> KAM notes
            </Label>
            <Textarea
              id="kam-notes"
              value={notes}
              onChange={(e) => a.update({ reviewNotes: e.target.value.slice(0, 2000) })}
              rows={5}
              className="mt-2"
              placeholder="Meeting context, agreed follow-ups, people present…"
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
