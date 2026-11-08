/**
 * Shared attachment rules for every AI assistant chat in the app.
 * Images and PDFs are sent to the model as file parts; plain-text formats are
 * inlined as text so models that only accept PDF documents can still read them.
 */
export const CHAT_ATTACHMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json";

export const CHAT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const TEXT_EXTENSIONS = ["txt", "md", "csv", "json"];

export type ChatAttachmentPart =
  | { type: "file"; mediaType: string; filename: string; url: string }
  | { type: "text"; text: string };

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateChatAttachment(file: File): string | null {
  const ext = extensionOf(file.name);
  const allowed =
    file.type === "application/pdf" ||
    ext === "pdf" ||
    IMAGE_TYPES.includes(file.type) ||
    TEXT_EXTENSIONS.includes(ext);
  if (!allowed) {
    return "Only PDF, images (PNG, JPG, WEBP, GIF) and text files (TXT, MD, CSV, JSON) can be attached.";
  }
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) return "Files must be 8 MB or smaller.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

/** Convert a validated file into message parts the AI SDK can send to the model. */
export async function chatAttachmentToParts(file: File): Promise<ChatAttachmentPart[]> {
  const ext = extensionOf(file.name);
  if (TEXT_EXTENSIONS.includes(ext)) {
    const text = (await file.text()).slice(0, 200_000);
    return [{ type: "text", text: `Attached file "${file.name}":\n\n${text}` }];
  }
  const mediaType = file.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream");
  return [{ type: "file", mediaType, filename: file.name, url: await readAsDataUrl(file) }];
}
