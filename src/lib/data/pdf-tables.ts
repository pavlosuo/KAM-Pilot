import { TABLES, normalizeHeader, type TableSpec } from "./schema";
import { matchField, type RawSheet } from "./ingest";

/**
 * Deterministic PDF table reader. PDFs exported from Excel, Power BI or
 * Tableau carry each cell as positioned text; we rebuild lines from the
 * y-coordinate, recognise header rows against the same field aliases the
 * workbook import uses, and assign every value to the header column it sits
 * under. Numbers are never interpreted by AI.
 */

export interface PdfTextItem {
  str: string;
  /** Left edge in PDF units. */
  x: number;
  /** Baseline, measured from the bottom of the page. */
  y: number;
  w: number;
  h: number;
}

export interface PdfPage {
  items: PdfTextItem[];
}

interface Cell {
  text: string;
  x0: number;
  x1: number;
}

interface Line {
  y: number;
  cells: Cell[];
}

export interface PdfReadStats {
  pages: number;
  textItems: number;
  tables: Array<{ name: string; table: string; rows: number; pages: number[] }>;
  skippedLines: number;
}

function groupLines(items: PdfTextItem[]): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; h: number; items: PdfTextItem[] }> = [];
  for (const it of sorted) {
    const tol = Math.max(1.5, Math.min(it.h || 8, 12) * 0.45);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const its = l.items.sort((a, b) => a.x - b.x);
      const cells: Cell[] = [];
      for (const it of its) {
        const prev = cells[cells.length - 1];
        const gap = prev ? it.x - prev.x1 : Infinity;
        // Text runs closer than ~a space belong to the same cell.
        if (prev && gap < Math.max(1, (it.h || 8) * 0.35)) {
          prev.text = `${prev.text}${gap > 0.5 ? " " : ""}${it.str}`.replace(/\s+/g, " ");
          prev.x1 = Math.max(prev.x1, it.x + it.w);
        } else {
          cells.push({ text: it.str.trim(), x0: it.x, x1: it.x + Math.max(it.w, 1) });
        }
      }
      return { y: l.y, cells: cells.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text) };
    });
}

/** Best table whose fields match a candidate header line (all required fields present). */
function detectHeader(line: Line, preferred: TableSpec | null): TableSpec | null {
  if (line.cells.length < 2) return null;
  let best: { spec: TableSpec; score: number } | null = null;
  for (const spec of TABLES) {
    const hits = new Set<string>();
    for (const c of line.cells) {
      const f = matchField(spec, c.text);
      if (f) hits.add(f.key);
    }
    const required = spec.fields.filter((f) => f.required);
    const reqHits = required.filter((f) => hits.has(f.key)).length;
    if (reqHits < required.length || hits.size < Math.max(2, Math.ceil(line.cells.length * 0.6))) continue;
    const score = hits.size / spec.fields.length + hits.size / line.cells.length + (preferred?.key === spec.key ? 1 : 0);
    if (!best || score > best.score) best = { spec, score };
  }
  return best?.spec ?? null;
}

function titleSpec(line: Line): TableSpec | null {
  if (line.cells.length !== 1) return null;
  const n = normalizeHeader(line.cells[0].text.replace(/\(.*\)$/, ""));
  return TABLES.find((t) => t.sheetAliases.includes(n) || normalizeHeader(t.label) === n || normalizeHeader(t.key) === n) ?? null;
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** Assigns each value cell to the header column it overlaps most (nearest centre otherwise). */
function assignRow(cells: Cell[], header: Cell[]): Array<string | null> {
  const out: Array<string | null> = header.map(() => null);
  // Column bands: from a header's left edge to the next header's left edge.
  const bands = header.map((h, i) => ({ x0: i === 0 ? -Infinity : (header[i - 1].x1 + h.x0) / 2, x1: i === header.length - 1 ? Infinity : (h.x1 + header[i + 1].x0) / 2 }));
  for (const c of cells) {
    let best = -1;
    let bestOverlap = 0;
    bands.forEach((b, i) => {
      const o = overlap(c.x0, c.x1, b.x0, b.x1);
      if (o > bestOverlap) {
        bestOverlap = o;
        best = i;
      }
    });
    if (best < 0) {
      const mid = (c.x0 + c.x1) / 2;
      best = header.reduce((bi, h, i) => (Math.abs((h.x0 + h.x1) / 2 - mid) < Math.abs((header[bi].x0 + header[bi].x1) / 2 - mid) ? i : bi), 0);
    }
    out[best] = out[best] ? `${out[best]} ${c.text}` : c.text;
  }
  return out;
}

/** Rebuilds data tables from positioned PDF text. Pure; unit-tested without a PDF engine. */
export function pagesToSheets(pages: PdfPage[]): { sheets: RawSheet[]; stats: PdfReadStats } {
  const sheets: Array<RawSheet & { table: string; pages: Set<number> }> = [];
  let current: { sheet: (typeof sheets)[number]; header: Cell[]; spec: TableSpec } | null = null;
  let pendingTitle: { text: string; spec: TableSpec } | null = null;
  let skipped = 0;
  let textItems = 0;

  pages.forEach((page, pi) => {
    textItems += page.items.length;
    for (const line of groupLines(page.items)) {
      const title = titleSpec(line);
      if (title) {
        pendingTitle = { text: line.cells[0].text, spec: title };
        current = null;
        continue;
      }
      const spec = detectHeader(line, pendingTitle?.spec ?? current?.spec ?? null);
      if (spec) {
        if (current && current.spec.key === spec.key && !pendingTitle) {
          // Header repeated on a new page: keep filling the same table, refresh column positions.
          current.header = line.cells;
          current.sheet.pages.add(pi + 1);
          continue;
        }
        const name = pendingTitle && pendingTitle.spec.key === spec.key ? pendingTitle.text : spec.label;
        const sheet = { name, headers: line.cells.map((c) => c.text), rows: [] as unknown[][], table: spec.key, pages: new Set([pi + 1]) };
        sheets.push(sheet);
        current = { sheet, header: line.cells, spec };
        pendingTitle = null;
        continue;
      }
      if (!current) {
        skipped++;
        continue;
      }
      const row = assignRow(line.cells, current.header);
      const filled = row.filter((v) => v != null && v !== "").length;
      // Page numbers, footers and wrapped fragments are not data rows.
      if (filled < Math.max(2, Math.ceil(current.header.length * 0.4))) {
        skipped++;
        continue;
      }
      current.sheet.rows.push(row);
      current.sheet.pages.add(pi + 1);
    }
  });

  return {
    sheets: sheets.map(({ name, headers, rows }) => ({ name, headers, rows })),
    stats: {
      pages: pages.length,
      textItems,
      tables: sheets.map((s) => ({ name: s.name, table: s.table, rows: s.rows.length, pages: [...s.pages] })),
      skippedLines: skipped,
    },
  };
}

export const MAX_PDF_PAGES = 600;

/** Browser-only: extracts positioned text from a PDF with pdf.js. */
export async function readPdfPages(data: Uint8Array, onProgress?: (done: number, total: number) => void): Promise<PdfPage[]> {
  // Run pdf.js's worker code on the page itself: worker message passing stalls in
  // embedded previews (≈5 s per table page), while in-page parsing takes milliseconds.
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const pdfjs = await import("pdfjs-dist");
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`This PDF has ${doc.numPages} pages; the limit is ${MAX_PDF_PAGES}.`);
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const it of tc.items) {
      if (!("str" in it) || !it.str) continue;
      const [, , , d, e, f] = it.transform as number[];
      items.push({ str: it.str, x: e, y: f, w: it.width, h: it.height || Math.abs(d) || 8 });
    }
    pages.push({ items });
    page.cleanup();
    onProgress?.(i, doc.numPages);
  }
  await task.destroy();
  return pages;
}
