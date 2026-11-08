import { afterEach, describe, expect, it, vi } from "vitest";
import { findPortrait } from "./research.server";

afterEach(() => vi.unstubAllGlobals());

describe("Public LinkedIn portraits", () => {
  const page = "https://www.linkedin.com/in/hannamari-lindstrom";
  const image = "https://media.licdn.com/dms/image/profile.jpg";
  it("fetches the photo actually shown by the verified public profile", async () => {
    const fetcher = vi.fn(async (url: URL) => url.hostname === "www.linkedin.com"
      ? new Response(`<title>Hannamari Lindström | LinkedIn</title><img alt="Hannamari Lindström" src="${image}">`, { headers: { "content-type": "text/html" } })
      : new Response(new Uint8Array(2000), { headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await findPortrait({ pageUrl: page, imageUrl: "https://media.licdn.com/guessed.jpg" }, "Hannamari Lindström", new Set([page]));
    expect(result?.photo).toMatch(/^data:image\/jpeg;base64,/);
    expect(result?.source).toBe(page);
    expect(fetcher.mock.calls.map(([url]) => url.toString())).toEqual([page, image]);
  });
  it("does not fetch guessed photos when LinkedIn requires sign-in", async () => {
    const fetcher = vi.fn(async () => new Response("Access blocked", { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await findPortrait({ pageUrl: page, imageUrl: image }, "Hannamari Lindström", new Set([page]))).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a portrait page the search did not return", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await findPortrait({ pageUrl: page, imageUrl: image }, "Hannamari Lindström", new Set())).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});