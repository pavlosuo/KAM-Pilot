import { describe, expect, it } from "vitest";
import { restoreUpload, UPLOAD_STORAGE_KEY } from "./upload-source";

describe("upload-only source", () => {
  it("starts without data when no operator upload exists", () => {
    expect(restoreUpload(undefined)).toBeNull();
  });
  it("does not restore the old mixed demo/upload slot", () => {
    expect(UPLOAD_STORAGE_KEY).toBe("customer-upload-v2");
    expect(UPLOAD_STORAGE_KEY).not.toBe("active-upload");
  });
});