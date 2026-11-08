import { z } from "zod";

export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const MAX_CONVERSION_BYTES = 10_000_000;
export const conversionInput = z.object({
  filename: z.string().regex(/^[\w.-]+\.pptx$/i).max(180),
  file: z.string().min(4).max(Math.ceil(MAX_CONVERSION_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

export function conversionTasks(filename: string) {
  return {
    source: { operation: "import/upload" },
    rebuild: { operation: "convert", input: "source", input_format: "pptx", output_format: "odp", engine: "office" },
    powerpoint: { operation: "convert", input: "rebuild", input_format: "odp", output_format: "pptx", engine: "office", filename },
    download: { operation: "export/url", input: "powerpoint", inline: false, archive_multiple_files: false },
  };
}

export async function blobBase64(blob: Blob): Promise<string> {
  if (blob.size > MAX_CONVERSION_BYTES) throw new Error("The presentation is too large to convert. Download PDF instead.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function convertedBlob(file: string): Blob {
  const binary = atob(file);
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], { type: PPTX_MIME });
}