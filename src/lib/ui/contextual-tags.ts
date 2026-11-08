import type { Observation } from "@/lib/engine/observations";
import type { SiteSummary, SignalKey } from "@/lib/engine/metrics";

const INSIGHT_LABELS: Record<string, string> = {
  "value-water": "Water savings",
  "value-emissions": "Carbon savings",
  "value-circularity": "Repair value",
  "opp-utilization": "Financial opportunity",
  "opp-product-repairs": "Durability opportunity",
  "opp-dormant": "Stock recovery opportunity",
  "opp-rebalance": "Stock sharing opportunity",
  "risk-wash-rhythm": "Infrequent washing risk",
  "risk-service-requests": "Service issue risk",
  "data-laundry-share": "Laundry data gap",
  "data-evidence-path": "Reporting evidence gap",
};

export function observationTag(o: Pick<Observation, "id" | "kind" | "tags">): string {
  if (o.id === "risk-late-cycles") return o.kind === "value" ? "On-time service value" : "Late delivery risk";
  const known = INSIGHT_LABELS[o.id];
  if (known) return known;
  const topic = o.tags.includes("cost") ? "Financial" : o.tags.includes("hygiene") ? "Hygiene" : o.tags.includes("service") ? "Service" : o.tags.includes("emissions") ? "Climate" : o.tags.includes("water") ? "Water" : o.tags.includes("circularity") ? "Circularity" : "Reporting";
  const kind = { value: "value", risk: "risk", opportunity: "opportunity", rule: "rule", data: "evidence gap" }[o.kind];
  return `${topic} ${kind}`;
}

const SITE_TOPICS: Record<SignalKey, string> = {
  utilization: "Garment use",
  washRhythm: "Washing frequency",
  requests: "Service requests",
  late: "Late deliveries",
  dormant: "Unused garments",
};

export function siteAttentionTag(site: Pick<SiteSummary, "status" | "signals">): string {
  if (site.status === "on-track") return "On track";
  const worst = [...site.signals].sort((a, b) => a.percentile - b.percentile)[0];
  const topic = worst ? SITE_TOPICS[worst.key] : "Site performance";
  return `${topic} ${site.status === "act" ? "risk" : "watch"}`;
}