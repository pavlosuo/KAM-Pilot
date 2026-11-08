import type { Site } from "@/lib/data/types";

/** "NorthStar Helsinki" → "Helsinki" when the site name starts with the customer's brand word. */
export function shortSiteName(site: Pick<Site, "name" | "city">): string {
  const parts = site.name.split(/\s+/);
  if (parts.length > 1 && site.name.includes(site.city)) return parts.slice(1).join(" ");
  return site.name;
}
