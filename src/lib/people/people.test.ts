import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeDataset } from "../data/codec";
import { audienceSiteScope } from "../avatar/audience";
import { DEFAULT_ASSUMPTIONS } from "../engine/assumptions";
import { personalizedAvatarWeights } from "../engine/avatar-personalization";
import { peopleLabel } from "../engine/avatars";
import { computeReview } from "../engine/metrics";
import { generateObservations } from "../engine/observations";
import { blendWeights, customerTopicWeights, industryWeights } from "../engine/priorities";
import { planRebalance } from "../engine/rebalance";
import { buildRecap } from "../engine/recap";
import { DEFAULT_CUSTOMER_SETTINGS, resetReportPrefs, type Prefs } from "../state/preferences-store";
import { personAvatar } from "./build";
import { pagePortrait, safeRemoteUrl } from "./research.server";
import { normalizeLinkedIn, type PersonResult } from "./types";

const ds = decodeDataset(JSON.parse(readFileSync("src/data/default-dataset.json", "utf8")));
const customer = ds.customers.find((c) => c.id === "CUST001")!;

const result = (over: Partial<PersonResult> = {}): PersonResult => ({
  found: true,
  name: "",
  role: "Head of Procurement",
  locations: ["finland", "Narnia"],
  summary: "Buys workwear services for the group.",
  interests: ["Cost per wearer"],
  wantsToSee: ["Cost per wearer vs last year", "Unused garments", "Delivery reliability", "A fourth one"],
  weights: { water: 0, emissions: 1, cost: 3, circularity: 1, service: 2, hygiene: 0, evidence: 0, improvement: 1 },
  recapTopics: ["service-promise", "not-a-topic", "idle-garments"],
  recapQuestions: { "service-promise": "Do deliveries arrive when you were promised?" },
  photo: null,
  photoSource: null,
  sources: [],
  ...over,
});

const make = (r: PersonResult) => personAvatar(r, { customer, dataset: ds, id: "person-1", linkedin: null, now: "2026-01-15T00:00:00.000Z" });

describe("People added through the pop-up", () => {
  it("is called Anonym and keeps an empty name until the KAM or the research supplies one", () => {
    const p = make(result());
    expect(p.name).toBe("");
    expect(peopleLabel(p)).toBe("Anonym");
    expect(peopleLabel(make(result({ name: "Anna Virtanen" })))).toBe("Anna Virtanen");
  });

  it("keeps only locations where the company has sites, spelled as in the data", () => {
    expect(make(result()).locations).toEqual(["Finland"]);
  });

  it("uses the researched value weights for the report", () => {
    const p = make(result());
    expect(personalizedAvatarWeights(p).cost).toBe(3);
    expect(personalizedAvatarWeights(p).water).toBe(0);
  });

  it("preserves zero researched values instead of substituting the role's interests", () => {
    const weights = { water: 0, emissions: 0, cost: 0, circularity: 0, service: 0, hygiene: 0, evidence: 0, improvement: 0 };
    expect(personalizedAvatarWeights(make(result({ weights })))).toEqual(weights);
  });

  it("shows at most three things the person wants to see", () => {
    expect(make(result()).wantsToSee).toEqual(["Cost per wearer vs last year", "Unused garments", "Delivery reliability"]);
  });

  it("asks the person's two AI-chosen questions as Recap questions 4 and 5, in the person's words", () => {
    const person = make(result());
    expect(person.recapTopics).toEqual(["service-promise", "idle-garments"]);
    const sites = ds.sites.filter((s) => s.customerId === customer.id);
    const siteIds = audienceSiteScope(person, sites);
    const weights = blendWeights({ industry: industryWeights(customer.industry, ds.industryPriorities), topics: customerTopicWeights(customer), avatar: personalizedAvatarWeights(person) });
    const months = ds.meta.months;
    const model = computeReview(ds, { customerId: customer.id, months, siteIds }, "B_LOCAL", DEFAULT_ASSUMPTIONS, weights);
    const plan = planRebalance(ds, customer.id, months, DEFAULT_ASSUMPTIONS, siteIds);
    const observations = generateObservations(model, ds, weights, plan, person);
    const recap = buildRecap({ model, dataset: ds, plan, observations, avatar: person, weights, brief: null, scenario: "base", today: new Date("2026-01-15"), locationLabel: "Finland" });
    expect(recap.chapters.slice(0, 3).map((c) => c.id)).toEqual(["year", "risks", "next"]);
    expect(recap.chapters[3].question).toBe("Do deliveries arrive when you were promised?");
    expect(recap.chapters[4].question).toBe("Are you paying for garments nobody uses?");
  });
});

describe("New report starts over", () => {
  it("removes every saved person and report but keeps company branding and assumptions", () => {
    const prefs: Prefs = {
      theme: "light",
      customAvatars: [make(result())],
      assumptions: { ...DEFAULT_ASSUMPTIONS, washTargetPerMonth: 6 },
      customers: { CUST001: { ...DEFAULT_CUSTOMER_SETTINGS, avatarId: "person-1", reviewNotes: "x", brandColor: "#123456", companyDomain: "northstar.example" }, CUST002: { reviewNotes: "y" } },
      studioAvatarId: "person-1",
    };
    const next = resetReportPrefs(prefs);
    expect(next.customAvatars).toEqual([]);
    expect(next.studioAvatarId).toBeNull();
    expect(next.customers).toEqual({ CUST001: { brandColor: "#123456", companyDomain: "northstar.example" } });
    expect(next.assumptions.washTargetPerMonth).toBe(6);
  });
});

describe("Person research inputs", () => {
  it("accepts LinkedIn profile links only", () => {
    expect(normalizeLinkedIn("linkedin.com/in/anna-virtanen/?utm=x")).toBe("https://linkedin.com/in/anna-virtanen");
    expect(normalizeLinkedIn("https://www.linkedin.com/company/lindstrom")).toBeNull();
    expect(normalizeLinkedIn("https://example.com/in/anna")).toBeNull();
  });

  it("fetches portraits only from public https hosts", () => {
    expect(safeRemoteUrl("https://www.northstar.example/team/anna.jpg")?.hostname).toBe("www.northstar.example");
    expect(safeRemoteUrl("http://www.northstar.example/a.jpg")).toBeNull();
    expect(safeRemoteUrl("https://127.0.0.1/a.jpg")).toBeNull();
    expect(safeRemoteUrl("https://localhost/a.jpg")).toBeNull();
    expect(safeRemoteUrl("https://media.licdn.com/a.jpg")?.hostname).toBe("media.licdn.com");
    expect(safeRemoteUrl("https://user:password@photos.example/a.jpg")).toBeNull();
  });

  it("uses a page's preview image only when the page is about the person", () => {
    const html = '<html><head><title>Anna Virtanen joins NorthStar</title><meta property="og:image" content="/img/anna.jpg"></head></html>';
    expect(pagePortrait(html, "https://news.example/anna", "Anna Virtanen")).toBe("https://news.example/img/anna.jpg");
    expect(pagePortrait(html, "https://news.example/anna", "Matti Korhonen")).toBeNull();
    expect(pagePortrait(html, "https://news.example/anna", "Matti Virtanen")).toBeNull();
  });

  it("reads a named public LinkedIn portrait with accented names and lazy image loading", () => {
    const html = '<title>Hannamari Lindstrom - Wavin | LinkedIn</title><img alt="Hannamari Lindström" data-delayed-url="https://media.licdn.com/dms/image/profile.jpg?x=1&amp;y=2">';
    expect(pagePortrait(html, "https://www.linkedin.com/in/hannamari", "Hannamari Lindström")).toBe("https://media.licdn.com/dms/image/profile.jpg?x=1&y=2");
  });
});
