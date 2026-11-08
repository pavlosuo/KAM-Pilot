/**
 * Normalize a user-entered website URL: trims, prepends https:// if no scheme.
 * Returns null if input is empty after trim.
 */
export function normalizeWebsite(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Validate that a website string (after normalization) is a well-formed http(s) URL
 * with a domain that has a dot (e.g. example.com).
 */
export function isValidWebsite(input: string | null | undefined): boolean {
  const normalized = normalizeWebsite(input);
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname.includes(".")) return false;
    if (/\s/.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the URL only if it uses an allowed safe scheme (http/https/mailto/tel),
 * otherwise returns "#". Prevents javascript:, data:, vbscript: XSS via href/src.
 */
export function safeHref(url: string | null | undefined): string {
  if (!url) return "#";
  const trimmed = String(url).trim();
  if (!trimmed) return "#";
  // Allow protocol-relative and relative URLs
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return trimmed;
  try {
    const u = new URL(trimmed, "https://placeholder.local");
    const allowed = ["http:", "https:", "mailto:", "tel:"];
    if (!allowed.includes(u.protocol)) return "#";
    return trimmed;
  } catch {
    return "#";
  }
}

/** Same as safeHref but returns null instead of "#" — for src attributes. */
export function safeSrc(url: string | null | undefined): string | undefined {
  const h = safeHref(url);
  return h === "#" ? undefined : h;
}
