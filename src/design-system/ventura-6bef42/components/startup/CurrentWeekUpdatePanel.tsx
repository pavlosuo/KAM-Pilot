"use client";

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  getCurrentWeekOverview,
  updateAuthorSummary,
} from "@/design-system/ventura-6bef42/lib/weekly-current-week.functions";
import { replaceProgressionCards } from "@/design-system/ventura-6bef42/lib/progression-cards-replace.functions";
import { AttachFilesButton } from "@/design-system/ventura-6bef42/components/startup-updates/AttachFilesButton";
import {
  ProgressionCardsGrid,
  type ProgressionCard,
} from "@/design-system/ventura-6bef42/components/startup-updates/ProgressionCards";

interface AuthorEntry {
  updateId: string;
  authorId: string;
  authorName: string;
  role: string;
  summary: string;
  publishedAt: string | null;
}

export function CurrentWeekUpdatePanel({ startupId }: { startupId: string }) {
  const overviewFn = useServerFn(getCurrentWeekOverview);
  const saveSummaryFn = useServerFn(updateAuthorSummary);
  const replaceCardsFn = useServerFn(replaceProgressionCards);

  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [weekEnd, setWeekEnd] = useState<string | null>(null);
  const [authors, setAuthors] = useState<AuthorEntry[]>([]);
  const [cards, setCards] = useState<ProgressionCard[]>([]);
  const [latestUpdateId, setLatestUpdateId] = useState<string | null>(null);

  const [editingText, setEditingText] = useState(false);
  const [editingCards, setEditingCards] = useState(false);
  const [draftSummaries, setDraftSummaries] = useState<Record<string, string>>({});
  const [draftCards, setDraftCards] = useState<ProgressionCard[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await overviewFn({ data: { startupId } });
      setWeekStart(res.weekStart);
      setWeekEnd(res.weekEnd);
      setAuthors(res.authors as AuthorEntry[]);
      setCards(res.cards as ProgressionCard[]);
      setLatestUpdateId(res.latestUpdateId);
    } catch (e) {
      // silent — panel just won't render
      const msg = e instanceof Error ? e.message : "Failed to load this week's update";
      console.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupId]);

  const weekLabel = useMemo(() => {
    if (!weekStart || !weekEnd) return "";
    const s = new Date(weekStart + "T00:00:00Z");
    const e = new Date(weekEnd + "T00:00:00Z");
    return s.getUTCMonth() === e.getUTCMonth()
      ? `${format(s, "MMM d")}–${format(e, "d, yyyy")}`
      : `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  }, [weekStart, weekEnd]);

  if (loading) return null;
  if (!weekStart || authors.length === 0) return null;

  function beginEditText() {
    const map: Record<string, string> = {};
    for (const a of authors) map[a.updateId] = a.summary;
    setDraftSummaries(map);
    setEditingText(true);
  }
  function beginEditCards() {
    setDraftCards(cards.map((c) => ({ ...c })));
    setEditingCards(true);
  }

  async function saveText() {
    setSaving(true);
    try {
      const dirty = authors.filter(
        (a) => (draftSummaries[a.updateId] ?? "") !== a.summary,
      );
      for (const a of dirty) {
        const next = draftSummaries[a.updateId] ?? "";
        if (!next.trim()) {
          toast.error(`${a.authorName}'s update cannot be empty`);
          setSaving(false);
          return;
        }
        await saveSummaryFn({ data: { updateId: a.updateId, summary: next } });
      }
      toast.success("Update text saved");
      setEditingText(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveCards() {
    if (!latestUpdateId) {
      toast.error("No published update to attach cards to");
      return;
    }
    setSaving(true);
    try {
      await replaceCardsFn({
        data: {
          startupId,
          updateId: latestUpdateId,
          cards: draftCards.map((c) => ({
            label: c.label,
            value: c.value ?? "",
            icon_name: c.image_url ? null : c.icon_name ?? "circle",
            image_url: c.image_url ?? null,
            description: c.description ?? null,
          })),
        },
      });
      toast.success("Progression cards saved");
      setEditingCards(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            This week&apos;s update
          </h2>
          <span className="text-xs text-muted-foreground">Week of {weekLabel}</span>
        </div>

        {/* Progression cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Progression cards
            </h3>
            {!editingCards ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={beginEditCards}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingCards(false)}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={saveCards} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </Button>
              </div>
            )}
          </div>

          <ProgressionCardsGrid
            cards={editingCards ? draftCards : cards}
            editable={editingCards}
            columns={1}
            onChange={(i, patch) =>
              setDraftCards((arr) => {
                const next = [...arr];
                next[i] = { ...next[i], ...patch };
                return next;
              })
            }
            onDelete={(i) =>
              setDraftCards((arr) => arr.filter((_, idx) => idx !== i))
            }
            onAdd={() =>
              setDraftCards((arr) =>
                arr.length >= 6
                  ? arr
                  : [
                      ...arr,
                      {
                        label: "New card",
                        value: "",
                        icon_name: "circle",
                        image_url: null,
                        description: null,
                      },
                    ],
              )
            }
          />
        </section>

        {/* Per-author summaries */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Full update text
            </h3>
            {!editingText ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={beginEditText}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingText(false)}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={saveText} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {authors.map((a) => (
              <div key={a.updateId} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {a.authorName} posted
                </p>
                {editingText ? (
                  <>
                    <Textarea
                      value={draftSummaries[a.updateId] ?? ""}
                      onChange={(e) =>
                        setDraftSummaries((m) => ({ ...m, [a.updateId]: e.target.value }))
                      }
                      rows={Math.max(4, Math.min(16, (draftSummaries[a.updateId] ?? "").split("\n").length + 1))}
                    />
                    <div className="pt-1">
                      <AttachFilesButton startupId={startupId} weeklyUpdateId={a.updateId} />
                    </div>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {a.summary || "(no text)"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
