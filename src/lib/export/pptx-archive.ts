const CONTENT_TYPES = "[Content_Types].xml";
const STANDARD_DEFAULTS: Record<string, string> = {
  xml: "application/xml",
  rels: "application/vnd.openxmlformats-package.relationships+xml",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
};
// Characters XML 1.0 forbids; uploaded spreadsheet text can carry them.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/**
 * Rebuild the PptxGenJS package the way Office writes it so strict readers
 * (PowerPoint's file validation / Protected View) accept it: content types
 * first, no folder entries, only declared parts and extensions that exist,
 * schema child order in presentation.xml and standard notes size.
 */
export async function normalizePptxArchive(bytes: Uint8Array): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const source = await JSZip.loadAsync(bytes);
  const parts = Object.values(source.files).filter((f) => !f.dir && f.name !== CONTENT_TYPES);
  const names = new Set(parts.map((f) => f.name));

  const contents = new Map<string, string | Uint8Array>();
  for (const f of parts) {
    if (/\.(xml|rels)$/i.test(f.name)) contents.set(f.name, (await f.async("string")).replace(INVALID_XML, ""));
    else contents.set(f.name, await f.async("uint8array"));
  }

  for (const [name, value] of contents) {
    if (typeof value === "string" && /^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(name)) {
      contents.set(name, fixParagraphProperties(value));
    }
  }

  const presentation = contents.get("ppt/presentation.xml");
  if (typeof presentation === "string") {
    let xml = presentation;
    const notes = xml.match(/<p:notesMasterIdLst>.*?<\/p:notesMasterIdLst>/s)?.[0];
    if (notes) xml = xml.replace(notes, "").replace("</p:sldMasterIdLst>", `</p:sldMasterIdLst>${notes}`);
    xml = xml.replace(/<p:notesSz cx="\d+" cy="\d+"\s*\/>/, '<p:notesSz cx="6858000" cy="9144000"/>');
    contents.set("ppt/presentation.xml", xml);
  }

  const typesXml = (await source.file(CONTENT_TYPES)?.async("string")) ?? "";
  const overrides = (typesXml.match(/<Override\b[^>]*\/>/g) ?? []).filter((entry) => {
    const part = entry.match(/PartName="([^"]+)"/)?.[1];
    return !!part && names.has(part.replace(/^\//, ""));
  });
  const extensions = new Set(["xml", "rels", ...[...names].map((n) => n.split(".").pop()?.toLowerCase() ?? "")]);
  const defaults = [...extensions]
    .filter((ext) => STANDARD_DEFAULTS[ext])
    .map((ext) => `<Default Extension="${ext}" ContentType="${STANDARD_DEFAULTS[ext]}"/>`);
  const types =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults.join("")}${overrides.join("")}</Types>`;

  const out = new JSZip();
  const order = [CONTENT_TYPES, "_rels/.rels", ...[...contents.keys()].filter((n) => n !== "_rels/.rels").sort()];
  for (const name of order) {
    const data = name === CONTENT_TYPES ? types : contents.get(name);
    if (data !== undefined) out.file(name, data, { createFolders: false });
  }
  // STORE matches the user's confirmed-working first NorthStar export.
  // The failing Mediora v2 also uses STORE, so compression alone does not
  // explain the remaining Windows PowerPoint refusal.
  return out.generateAsync({ type: "uint8array", compression: "STORE" });
}

const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g;
const PARAGRAPH_PROPS = /<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g;

/**
 * A DrawingML paragraph may carry one <a:pPr>, and only as its first child.
 * Remove repeated or misplaced properties emitted in multi-run text.
 * This repairs a schema violation, but does not establish the cause of a
 * Windows PowerPoint open failure: the working reference also contains it.
 */
export function fixParagraphProperties(xml: string): string {
  return xml.replace(PARAGRAPH, (_match, body: string) => {
    let index = 0;
    const fixed = body.replace(PARAGRAPH_PROPS, (props: string, offset: number) => {
      const keep = index === 0 && offset === 0;
      index += 1;
      return keep ? props : "";
    });
    return `<a:p>${fixed}</a:p>`;
  });
}
