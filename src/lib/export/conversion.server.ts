import { conversionTasks, MAX_CONVERSION_BYTES } from "./conversion";

const GATEWAY = "https://connector-gateway.lovable.dev/udc_cloudconvert";
type Job = { id: string; status: string; tasks?: { name?: string; status: string; message?: string; code?: string; result?: { form?: { url: string; parameters: Record<string, string | number> }; files?: { url?: string; filename?: string }[] } }[] };

/** Fetch only provider-owned HTTPS output URLs, without forwarding credentials. */
export function conversionOutputUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !(url.hostname === "storage.cloudconvert.com" || url.hostname.endsWith(".storage.cloudconvert.com") || url.hostname === "upload.cloudconvert.com")) {
    throw new Error("CloudConvert returned an unexpected download address.");
  }
  return url;
}

export async function convertPresentation(input: { file: string; filename: string }, credentials: { gateway: string; connection: string }, fetcher: typeof fetch = fetch) {
  const signal = AbortSignal.timeout(180_000);
  const headers = { Authorization: `Bearer ${credentials.gateway}`, "X-Connection-Api-Key": credentials.connection, "Content-Type": "application/json" };
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetcher(`${GATEWAY}${path}`, { ...init, headers, signal });
    if (!response.ok) {
      const body = await response.text();
      console.error(`CloudConvert [${response.status}]: ${body}`);
      throw new Error(`CloudConvert [${response.status}]: ${body}`);
    }
    return response;
  };
  let jobId: string | undefined;
  try {
    const created = await call("/v2/jobs", { method: "POST", body: JSON.stringify({ tasks: conversionTasks(input.filename) }) });
    let job = ((await created.json()) as { data: Job }).data;
    if (!job?.id || !/^[\w-]+$/.test(job.id)) throw new Error("CloudConvert did not return a conversion job.");
    jobId = job.id;
    const upload = job.tasks?.find((task) => task.name === "source")?.result?.form;
    if (upload) {
      const form = new FormData();
      for (const [key, value] of Object.entries(upload.parameters)) form.append(key, String(value));
      const binary = atob(input.file);
      const source = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      if (source.length > MAX_CONVERSION_BYTES || source[0] !== 80 || source[1] !== 75) throw new Error("Invalid PowerPoint input.");
      form.append("file", new Blob([source]), input.filename);
      // Workers support manual redirects, not redirect: "error". Reject 3xx via ok below.
      const uploaded = await fetcher(conversionOutputUrl(upload.url), { method: "POST", body: form, signal, redirect: "manual" });
      if (!uploaded.ok) throw new Error(`CloudConvert upload failed [${uploaded.status}]: ${await uploaded.text()}`);
    }
    while (job.status === "waiting" || job.status === "processing") {
      await new Promise<void>((resolve, reject) => {
        const aborted = () => { clearTimeout(timer); reject(new Error("PowerPoint conversion timed out. Please try again.")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, 2000);
        if (signal.aborted) aborted();
        else signal.addEventListener("abort", aborted, { once: true });
      });
      job = ((await (await call(`/v2/jobs/${jobId}`)).json()) as { data: Job }).data;
    }
    if (job.status !== "finished") {
      const failed = job.tasks?.find((task) => task.status === "error");
      throw new Error(`CloudConvert: ${failed?.message ?? "PowerPoint conversion failed"}${failed?.code ? ` (${failed.code})` : ""}`);
    }
    const file = job.tasks?.find((task) => task.name === "download")?.result?.files?.[0];
    if (!file?.url) throw new Error("CloudConvert returned no converted presentation.");
    const response = await fetcher(conversionOutputUrl(file.url), { signal, redirect: "manual" });
    if (!response.ok) throw new Error(`Converted presentation download failed [${response.status}].`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 4 || bytes.length > MAX_CONVERSION_BYTES || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) {
      throw new Error("CloudConvert returned an invalid or oversized presentation.");
    }
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return { file: btoa(binary) };
  } finally {
    // Remove uploaded and converted files after the result has been read, even on failure.
    if (jobId) {
      try {
        const result = await fetcher(`${GATEWAY}/v2/jobs/${jobId}`, { method: "DELETE", headers, signal: AbortSignal.timeout(10_000) });
        if (!result.ok) console.error(`CloudConvert cleanup [${result.status}]: ${await result.text()}`);
      } catch { console.error("CloudConvert cleanup failed; provider automatically deletes completed jobs after 24 hours."); }
    }
  }
}