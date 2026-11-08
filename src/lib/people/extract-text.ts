import { PERSON_TEXT_LIMIT } from "./types";

/**
 * Reads the text of an uploaded CRM extract or meeting notes in the browser
 * (files never leave the device; only their text is sent for the research).
 */

export const PERSON_FILE_ACCEPT = ".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.pptx,.odt,.txt,.md,.rtf,.eml";
export const MAX_PERSON_FILE_BYTES = 25 * 1024 * 1024;

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export function personFileSupported(name: string): boolean {
  return PERSON_FILE_ACCEPT.split(",").includes(`.${ext(name)}`);
}

/** Collapses whitespace and caps the length sent to the AI. */
export function tidy(text: string, limit = PERSON_TEXT_LIMIT): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, limit);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Text of Office XML: paragraph ends become new lines, tags are removed. */
export function xmlText(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|text:p|text:h)>/g, "\n")
    .replace(/<(w:tab|w:br|a:br|text:tab|text:line-break)\b[^>]*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

/** Plain text out of a rich-text file (control words and groups removed). */
export function rtfText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "");
}

async function zipText(data: ArrayBuffer, pick: (name: string) => boolean): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);
  const names = Object.keys(zip.files)
    .filter(pick)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts = await Promise.all(names.map((n) => {
    const entry = zip.file(n);
    return entry ? entry.async("string") : Promise.resolve("");
  }));
  return parts.map(xmlText).join("\n\n");
}

export async function extractPersonFileText(file: File): Promise<string> {
  if (file.size > MAX_PERSON_FILE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
  const kind = ext(file.name);
  const data = await file.arrayBuffer();
  switch (kind) {
    case "txt":
    case "md":
    case "csv":
    case "eml":
      return tidy(new TextDecoder().decode(data));
    case "rtf":
      return tidy(rtfText(new TextDecoder().decode(data)));
    case "docx":
      return tidy(await zipText(data, (n) => /^word\/(document|footnotes|comments)\d*\.xml$/.test(n)));
    case "pptx":
      return tidy(await zipText(data, (n) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n)));
    case "odt":
      return tidy(await zipText(data, (n) => n === "content.xml"));
    case "pdf": {
      const { readPdfPages } = await import("@/lib/data/pdf-tables");
      const pages = await readPdfPages(new Uint8Array(data));
      return tidy(
        pages
          .map((p) =>
            [...p.items]
              .sort((a, b) => b.y - a.y || a.x - b.x)
              .map((i) => i.str)
              .join(" "),
          )
          .join("\n\n"),
      );
    }
    case "xlsx":
    case "xlsm":
    case "xls": {
      const { readWorkbookSheets } = await import("@/lib/data/ingest");
      const sheets = readWorkbookSheets(data);
      const lines: string[] = [];
      for (const s of sheets) {
        lines.push(`Sheet ${s.name}`);
        for (const row of s.rows.slice(0, 400)) {
          const cells = s.headers.map((h, i) => [h, row[i]] as const).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
          if (cells.length) lines.push(cells.map(([h, v]) => `${h || "?"}: ${String(v)}`).join("; "));
        }
      }
      return tidy(lines.join("\n"));
    }
    default:
      throw new Error(`${file.name} is not a supported file. Use PDF, Word, Excel, PowerPoint or text.`);
  }
}
