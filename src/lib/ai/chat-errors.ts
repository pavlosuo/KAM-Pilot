/** Turns a chat transport error into a sentence for a toast. */
export function chatErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // not JSON
  }
  if (/credits|402/i.test(raw)) return "AI credits are used up for this workspace. Add credits in Settings → Plans & credits.";
  if (/429|rate/i.test(raw)) return "The assistant is busy. Please wait a few seconds and try again.";
  return raw && raw.length < 200 ? raw : "The assistant is unavailable right now. Please try again.";
}

export function messageText(parts: Array<{ type: string; text?: string }> | undefined): string {
  return (parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}
