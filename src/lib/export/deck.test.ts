import { readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { decodeDataset } from "../data/codec";
import { audienceSiteScope, buildAudience } from "../avatar/audience";
import { DEFAULT_ASSUMPTIONS } from "../engine/assumptions";
import { personalizedAvatarWeights } from "../engine/avatar-personalization";
import { computeReview } from "../engine/metrics";
import { generateObservations } from "../engine/observations";
import { blendWeights, customerTopicWeights, industryWeights } from "../engine/priorities";
import { planRebalance } from "../engine/rebalance";
import { buildRecap } from "../engine/recap";
import type { AccountContextValue } from "../state/account-context";
import type { HexPalette } from "./colors";
import { buildDeck, deckSections, defaultSections } from "./deck";
import { deckToPptx } from "./pptx";

const ds = decodeDataset(JSON.parse(readFileSync("src/data/default-dataset.json", "utf8")));

function account(notes = ""): AccountContextValue {
  const customer = ds.customers.find((c) => c.id === "CUST001")!;
  const avatar = { ...buildAudience({ customer, roles: ["CFO / Finance director"], locations: [] }, ds), name: "" };
  const sites = ds.sites.filter((s) => s.customerId === customer.id);
  const siteIds = audienceSiteScope(avatar, sites);
  const weights = blendWeights({ industry: industryWeights(customer.industry, ds.industryPriorities), topics: customerTopicWeights(customer), avatar: personalizedAvatarWeights(avatar) });
  const months = ds.meta.months;
  const model = computeReview(ds, { customerId: customer.id, months, siteIds }, "B_LOCAL", DEFAULT_ASSUMPTIONS, weights);
  const plan = planRebalance(ds, customer.id, months, DEFAULT_ASSUMPTIONS, siteIds);
  const observations = generateObservations(model, ds, weights, plan, avatar);
  const recap = buildRecap({ model, dataset: ds, plan, observations, avatar, weights, brief: null, scenario: "base", today: new Date("2026-01-15"), locationLabel: "All locations" });
  return { customer, avatar, neutral: false, months, recap, settings: { reviewNotes: notes } } as unknown as AccountContextValue;
}

const PALETTE = {
  navy: "#003f72",
  blue: "#0074cc",
  red: "#e52330",
  green: "#578200",
  pink: "#ca005d",
  purple: "#7c109a",
  turquoise: "#006f86",
  orange: "#bd5a00",
  ink: "#222222",
  grey: "#555555",
  silver: "#999999",
  line: "#dddddd",
  mist: "#f2f2f2",
  card: "#ffffff",
} as unknown as HexPalette;

describe("Presentation = the Recap on slides", () => {
  it("has exactly the Recap's sections: cover, five questions, next steps, notes and sources", () => {
    const a = account();
    const ids = deckSections(a.recap).map((s) => s.id);
    expect(ids).toEqual(["cover", ...a.recap.chapters.map((c) => `q-${c.id}`), "next", "notes", "sources"]);
    expect(a.recap.chapters).toHaveLength(5);
  });

  it("shows each of the five questions once, followed only by that question's answers", () => {
    const a = account();
    const deck = buildDeck(a, { sections: defaultSections(a) });
    const questions = deck.slides.filter((s) => s.kind === "question");
    expect(questions.map((q) => q.kind === "question" && q.question)).toEqual(a.recap.chapters.map((c) => c.question));
    const beats = deck.slides.filter((s) => s.kind === "beat");
    expect(beats).toHaveLength(a.recap.chapters.reduce((t, c) => t + c.beats.length, 0));
    expect(new Set(deck.slides.map((s) => s.kind))).toEqual(new Set(["cover", "question", "beat", "closing", "sources"]));
  });

  it("adds the KAM notes slide only when there are notes", () => {
    expect(defaultSections(account())).not.toContain("notes");
    const withNotes = account("Agree the pilot at Tampere.");
    const deck = buildDeck(withNotes, { sections: defaultSections(withNotes) });
    expect(deck.slides.some((s) => s.kind === "notes" && s.text === "Agree the pilot at Tampere.")).toBe(true);
  });

  it("calls an unnamed person by their role", () => {
    const deck = buildDeck(account(), { sections: ["cover"] });
    const cover = deck.slides[0];
    expect(cover.kind === "cover" && cover.preparedFor).toBe("CFO / Finance director");
  });

  it("writes one PowerPoint slide per deck slide with the questions as editable text", async () => {
    const a = account("Agree the pilot at Tampere.");
    const deck = buildDeck(a, { sections: defaultSections(a) });
    const blob = await deckToPptx(deck, PALETTE);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (process.env.DECK_OUT) writeFileSync(process.env.DECK_OUT, bytes);
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides).toHaveLength(deck.slides.length);
    const xml = (await Promise.all(slides.map((n) => zip.file(n)!.async("string")))).join("");
    for (const c of a.recap.chapters) expect(xml).toContain(c.question.replace(/&/g, "&amp;").replace(/'/g, "&apos;").split(" ").slice(0, 3).join(" "));
  }, 30_000);
});
