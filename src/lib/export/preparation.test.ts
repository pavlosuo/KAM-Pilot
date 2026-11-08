import { describe, expect, it } from "vitest";
import { createPreparationStore } from "./preparation";

describe("automatic PowerPoint preparation", () => {
  it("shares one conversion across dashboard and download views", async () => {
    const store = createPreparationStore();
    let calls = 0;
    const run = async () => { calls++; return { blob: new Blob(["converted"]), filename: "report.pptx" }; };
    store.prepare("report", run);
    store.prepare("report", run);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(1);
    expect(store.get("report")?.status).toBe("ready");
  });
  it("serializes changed reports and never returns a previous version for the new key", async () => {
    const store = createPreparationStore();
    let release: () => void = () => {};
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    let secondStarted = false;
    store.prepare("old", async () => { await waiting; return { blob: new Blob(), filename: "old.pptx" }; });
    store.prepare("new", async () => { secondStarted = true; return { blob: new Blob(), filename: "new.pptx" }; });
    await Promise.resolve();
    expect(secondStarted).toBe(false);
    expect(store.get("new")?.status).toBe("preparing");
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.get("new")).toMatchObject({ status: "ready", file: { filename: "new.pptx" } });
  });
  it("does not automatically retry a failure but permits an explicit retry", async () => {
    const store = createPreparationStore();
    let calls = 0;
    const run = async () => { calls++; throw new Error("Conversion unavailable"); };
    store.prepare("report", run);
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.prepare("report", run);
    expect(calls).toBe(1);
    expect(store.get("report")).toEqual({ status: "error", error: "Conversion unavailable" });
    store.prepare("report", run, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(2);
  });
});