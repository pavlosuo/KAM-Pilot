import { describe, expect, it } from "vitest";
import { conversionInput, conversionTasks, convertedBlob, blobBase64 } from "./conversion";
import { convertPresentation, conversionOutputUrl } from "./conversion.server";

describe("automatic PowerPoint conversion", () => {
  it("converts the generated presentation through Office and returns editable PowerPoint", () => {
    const tasks = conversionTasks("review.pptx");
    expect(tasks.source.operation).toBe("import/upload");
    expect(tasks.rebuild).toMatchObject({ input_format: "pptx", output_format: "odp", engine: "office" });
    expect(tasks.powerpoint).toMatchObject({ input: "rebuild", output_format: "pptx", filename: "review.pptx" });
    expect(tasks.download.input).toBe("powerpoint");
  });
  it("does not accept arbitrary paths or malformed encoded input", () => {
    expect(conversionInput.safeParse({ file: "UEsDBA==", filename: "../../review.pptx" }).success).toBe(false);
    expect(conversionInput.safeParse({ file: "not base64!", filename: "review.pptx" }).success).toBe(false);
  });
  it("downloads only from the conversion provider, not caller-selected hosts", () => {
    expect(conversionOutputUrl("https://storage.cloudconvert.com/job/review.pptx").hostname).toBe("storage.cloudconvert.com");
    for (const url of ["http://storage.cloudconvert.com/a", "https://localhost/a", "https://storage.cloudconvert.com.evil.test/a", "https://user@storage.cloudconvert.com/a"]) {
      expect(() => conversionOutputUrl(url)).toThrow();
    }
  });
  it("returns converted bytes and deletes the job without forwarding credentials to storage", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (String(url).includes("storage.cloudconvert.com")) return new Response(new Uint8Array([80, 75, 3, 4, 7]));
      return Response.json({ data: { id: "test-job", status: "finished", tasks: [{ name: "download", status: "finished", result: { files: [{ url: "https://storage.cloudconvert.com/test/review.pptx" }] } }] } });
    };
    const result = await convertPresentation({ file: "UEsDBA==", filename: "review.pptx" }, { gateway: "test", connection: "test" }, fetcher);
    expect([...new Uint8Array(await convertedBlob(result.file).arrayBuffer())]).toEqual([80, 75, 3, 4, 7]);
    expect(calls[1]?.init?.headers).toBeUndefined();
    expect(calls[1]?.init?.redirect).toBe("manual");
    expect(calls[2]?.init?.method).toBe("DELETE");
    expect(await blobBase64(convertedBlob(result.file))).toBe(result.file);
  });
  it("surfaces failed conversion and cleans up instead of returning the unconverted file", async () => {
    let deleted = false;
    const fetcher: typeof fetch = async (_url, init) => {
      if (init?.method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
      return Response.json({ data: { id: "failed-job", status: "error", tasks: [{ status: "error", message: "Cannot open file", code: "OPEN_FAILED" }] } });
    };
    await expect(convertPresentation({ file: "UEsDBA==", filename: "review.pptx" }, { gateway: "test", connection: "test" }, fetcher)).rejects.toThrow("Cannot open file");
    expect(deleted).toBe(true);
  });
  it("uploads the presentation without embedding it in the gateway job request", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let lookedUp = false;
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      if (String(url).includes("upload.cloudconvert.com")) return new Response(null, { status: 201 });
      if (String(url).includes("storage.cloudconvert.com")) return new Response(new Uint8Array([80, 75, 3, 4]));
      if (init?.method === "POST") return Response.json({ data: { id: "upload-job", status: "processing", tasks: [{ name: "source", status: "waiting", result: { form: { url: "https://upload.cloudconvert.com/test/", parameters: { signature: "test" } } } }] } });
      lookedUp = true;
      return Response.json({ data: { id: "upload-job", status: "finished", tasks: [{ name: "download", status: "finished", result: { files: [{ url: "https://storage.cloudconvert.com/test/review.pptx" }] } }] } });
    };
    await convertPresentation({ file: "UEsDBA==", filename: "review.pptx" }, { gateway: "test", connection: "test" }, fetcher);
    expect(String(calls[0]?.init?.body)).not.toContain("UEsDBA==");
    expect(calls[1]?.init?.headers).toBeUndefined();
    expect((calls[1]?.init?.body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(calls[1]?.init?.redirect).toBe("manual");
    expect(lookedUp).toBe(true);
  });
  it.each(["upload", "download"])("rejects %s redirects without following them and deletes the job", async (stage) => {
    let deleted = false;
    const fetcher: typeof fetch = async (url, init) => {
      if (init?.method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
      if (String(url).includes(`${stage === "upload" ? "upload" : "storage"}.cloudconvert.com`)) {
        expect(init?.redirect).toBe("manual");
        return new Response(null, { status: 302, headers: { Location: "https://evil.test/file" } });
      }
      return Response.json({ data: { id: "redirect-job", status: "finished", tasks: [
        ...(stage === "upload" ? [{ name: "source", status: "waiting", result: { form: { url: "https://upload.cloudconvert.com/test/", parameters: {} } } }] : []),
        { name: "download", status: "finished", result: { files: [{ url: "https://storage.cloudconvert.com/test/review.pptx" }] } },
      ] } });
    };
    await expect(convertPresentation({ file: "UEsDBA==", filename: "review.pptx" }, { gateway: "test", connection: "test" }, fetcher)).rejects.toThrow("[302]");
    expect(deleted).toBe(true);
  });
});