import type { AccountContextValue } from "@/lib/state/account-context";
import { audienceLabel, personName } from "@/lib/engine/avatars";
import { slugify } from "@/lib/engine/format";
import type { Recap, RecapBeat } from "@/lib/engine/recap";

/**
 * One renderer-neutral presentation: exactly the Recap story (cover, the five
 * questions with their answers and visuals, next steps, sources) plus the
 * KAM's own notes. The on-screen preview, PowerPoint and PDF all draw this
 * model through the same slide layout, so they never diverge.
 */

export type SectionId = string;

export interface DeckSection {
  id: SectionId;
  label: string;
}

export type DeckSlide =
  | { kind: "cover"; company: string; period: string; preparedFor: string; scope: string; stats: Array<{ value: string; label: string }> }
  | { kind: "question"; number: number; question: string; tone: "white" | "mist" }
  | { kind: "beat"; number: number; question: string; step: number; steps: number; beat: RecapBeat; tone: "white" | "mist" }
  | { kind: "closing"; headline: string; actions: string[] }
  | { kind: "notes"; title: string; text: string }
  | { kind: "sources"; title: string; disclosure: string; sources: Array<{ label: string; url: string }> };

export interface Deck {
  fileBase: string;
  customer: string;
  footer: string;
  slides: DeckSlide[];
}

export interface DeckOptions {
  sections: SectionId[];
}

const chapterSection = (id: string) => `q-${id}`;

/** Sections of the deck, in Recap order. */
export function deckSections(recap: Recap): DeckSection[] {
  return [
    { id: "cover", label: "The year at a glance" },
    ...recap.chapters.map((c) => ({ id: chapterSection(c.id), label: `${c.number}. ${c.question}` })),
    { id: "next", label: recap.closing.headline },
    { id: "notes", label: "KAM notes" },
    { id: "sources", label: "Sources" },
  ];
}

export function defaultSections(a: Pick<AccountContextValue, "recap" | "settings">): SectionId[] {
  return deckSections(a.recap)
    .map((s) => s.id)
    .filter((id) => id !== "notes" || !!a.settings.reviewNotes.trim());
}

/** "Anna Virtanen, CFO" or just the role while the person is anonymous. */
export function preparedFor(a: Pick<AccountContextValue, "avatar" | "neutral">): string {
  if (a.neutral) return "the account team";
  const name = personName(a.avatar);
  return name ? `${name}, ${a.avatar.role}` : a.avatar.role;
}

export function buildDeck(a: AccountContextValue, opts: DeckOptions): Deck {
  const { recap } = a;
  const has = (s: SectionId) => opts.sections.includes(s);
  const slides: DeckSlide[] = [];

  if (has("cover")) {
    slides.push({
      kind: "cover",
      company: a.customer.name,
      period: recap.periodLabel,
      preparedFor: preparedFor(a),
      scope: `${recap.scopeLabel} · ${recap.sitesInScope} site${recap.sitesInScope === 1 ? "" : "s"}`,
      stats: recap.stats.map((s) => ({ value: s.value, label: s.label })),
    });
  }

  recap.chapters.forEach((ch, i) => {
    if (!has(chapterSection(ch.id))) return;
    const tone = i % 2 === 0 ? "white" : "mist";
    slides.push({ kind: "question", number: ch.number, question: ch.question, tone });
    ch.beats.forEach((beat, j) => slides.push({ kind: "beat", number: ch.number, question: ch.question, step: j + 1, steps: ch.beats.length, beat, tone }));
  });

  if (has("next") && recap.closing.actions.length) {
    slides.push({ kind: "closing", headline: recap.closing.headline, actions: recap.closing.actions });
  }

  if (has("notes") && a.settings.reviewNotes.trim()) {
    slides.push({ kind: "notes", title: "Notes from the account team", text: a.settings.reviewNotes.trim() });
  }

  if (has("sources")) {
    slides.push({ kind: "sources", title: "Sources", disclosure: recap.disclosure, sources: recap.sources });
  }

  const who = a.neutral ? "" : `-${slugify(audienceLabel(a.avatar))}`;
  const last = a.months[a.months.length - 1] ?? "";
  return {
    fileBase: `${slugify(a.customer.name)}${who}-recap-${last}`.replace(/-+/g, "-"),
    customer: a.customer.name,
    footer: `${a.customer.name} · ${recap.title} · prepared for ${preparedFor(a)}`,
    slides,
  };
}
