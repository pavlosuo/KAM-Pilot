import type { PersonEvent, PersonRequest, PersonResult } from "./types";

/** Streams the person research; resolves with the profile or rejects with a readable message. */
export async function researchPerson(req: PersonRequest, signal: AbortSignal, onEvent: (e: PersonEvent) => void): Promise<PersonResult> {
  let res: Response;
  try {
    res = await fetch("/api/person", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Could not reach the research service. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "The research service rejected the request.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      nl = buf.indexOf("\n");
      if (!line) continue;
      let ev: PersonEvent;
      try {
        ev = JSON.parse(line) as PersonEvent;
      } catch {
        continue;
      }
      if (ev.type === "result") return ev.result;
      if (ev.type === "error") throw new Error(ev.error);
      onEvent(ev);
    }
  }
  throw new Error("The research ended before it finished. Try again.");
}

/** Square-crops and downsizes a portrait so it fits browser storage (about 10 KB). */
export async function downscalePhoto(dataUrl: string, size = 192): Promise<string | null> {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = dataUrl;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (side < 48) return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Portraits usually have the face in the upper part: crop from the top third.
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, Math.min(img.naturalHeight - side, (img.naturalHeight - side) * 0.25));
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}
