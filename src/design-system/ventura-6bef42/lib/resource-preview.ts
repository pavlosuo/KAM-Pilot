/** Preview-image helpers for AI-recommended resources (shared by block + preloader). */

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** YouTube video id from watch / youtu.be / embed / shorts URLs. */
export function youtubeId(url: string) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (!h.endsWith("youtube.com")) return null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?]+)/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

/** Best-effort preview image for a resource: YouTube thumb, then site preview. */
export function previewFor(url: string | null, imageUrl: string | null) {
  if (imageUrl) return imageUrl;
  if (!url) return null;
  const yt = youtubeId(url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  const host = hostOf(url);
  if (!host) return null;
  return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
}

export function faviconFor(url: string | null) {
  const host = hostOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : null;
}

/** Warm the browser image cache so previews render instantly when opened. */
export function warmPreviewImages(
  resources: Array<{ url: string | null; imageUrl: string | null }>,
) {
  if (typeof window === "undefined") return;
  for (const r of resources) {
    const src = previewFor(r.url, r.imageUrl);
    if (!src) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}
