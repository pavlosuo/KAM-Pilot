import { findSheet, matchField, type RawSheet } from "./ingest";
import { TABLES, normalizeHeader, type TableKey } from "./schema";

/** Up to three files can be combined into one review dataset. */
export const MAX_UPLOAD_FILES = 3;

export interface UploadedFileSheets {
  /** Stable id of the uploaded file (name + size + last modified). */
  id: string;
  name: string;
  kind: "excel" | "pdf";
  size: number;
  sheets: RawSheet[];
}

export interface MergeSummary {
  /** Table label → names of the files it was read from. */
  tables: Array<{ table: TableKey; label: string; files: string[]; rows: number; duplicatesDropped: number }>;
  /** Sheets in a file that matched no known table. */
  unused: Array<{ file: string; sheet: string }>;
}

/** Master tables are keyed by their id column: the first file that lists an id wins. */
const KEYED: Partial<Record<TableKey, string>> = {
  customers: "customer_id",
  laundries: "laundry_id",
  products: "product_id",
  sites: "site_id",
  baselines: "baseline_id",
  assumptions: "assumption_id",
};

function cellKey(v: unknown): string {
  if (v instanceof Date) return `d:${v.toISOString()}`;
  if (v == null || v === "") return "";
  return typeof v === "number" ? `n:${v}` : `s:${String(v).trim().toLowerCase()}`;
}

/**
 * Combines the sheets of several uploaded files before validation. Sheets that
 * describe the same table (e.g. the 2024 and 2025 activity exports, or master
 * data in the workbook and monthly figures in a PDF) are stacked into one
 * table with columns aligned by their recognised field; identical rows and
 * repeated master-data ids are dropped. Validation then runs once on the
 * combined tables, so every join and reconciliation check covers all files.
 */
export function mergeUploadedSheets(files: UploadedFileSheets[]): { sheets: RawSheet[]; summary: MergeSummary } {
  const used = new Set<RawSheet>();
  const out: RawSheet[] = [];
  const summary: MergeSummary = { tables: [], unused: [] };

  for (const spec of TABLES) {
    const parts: Array<{ file: string; sheet: RawSheet }> = [];
    for (const f of files) {
      const sheet = findSheet(spec, f.sheets.filter((s) => !used.has(s)));
      if (sheet) parts.push({ file: f.name, sheet });
    }
    if (!parts.length) continue;
    for (const p of parts) used.add(p.sheet);

    // Column order: the first file's headers, then any extra recognised fields from later files.
    const headers = [...parts[0].sheet.headers];
    const colFor = (header: string): number => {
      const field = matchField(spec, header)?.key;
      const n = normalizeHeader(header);
      const idx = headers.findIndex((h) => (field ? matchField(spec, h)?.key === field : normalizeHeader(h) === n));
      if (idx >= 0) return idx;
      headers.push(header);
      return headers.length - 1;
    };
    const maps = parts.map((p) => p.sheet.headers.map((h) => (h.trim() ? colFor(h) : -1)));

    const keyField = KEYED[spec.key];
    const keyCol = keyField ? headers.findIndex((h) => matchField(spec, h)?.key === keyField) : -1;
    const seen = new Set<string>();
    const rows: unknown[][] = [];
    let duplicates = 0;
    parts.forEach((p, pi) => {
      for (const raw of p.sheet.rows) {
        if (!raw || raw.every((c) => c == null || c === "")) continue;
        const row: unknown[] = new Array(headers.length).fill(null);
        maps[pi].forEach((col, i) => {
          if (col >= 0) row[col] = raw[i] ?? null;
        });
        const key = keyCol >= 0 && row[keyCol] != null && row[keyCol] !== "" ? `id:${cellKey(row[keyCol])}` : row.map(cellKey).join("|");
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        rows.push(row);
      }
    });
    out.push({ name: parts[0].sheet.name, headers, rows });
    summary.tables.push({ table: spec.key, label: spec.label, files: [...new Set(parts.map((p) => p.file))], rows: rows.length, duplicatesDropped: duplicates });
  }

  for (const f of files) {
    for (const s of f.sheets) if (!used.has(s)) summary.unused.push({ file: f.name, sheet: s.name });
  }
  return { sheets: out, summary };
}

/** Labels of the known tables recognised in one file (for the upload list). */
export function tablesInFile(file: Pick<UploadedFileSheets, "sheets">): string[] {
  const used = new Set<RawSheet>();
  const out: string[] = [];
  for (const spec of TABLES) {
    const sheet = findSheet(spec, file.sheets.filter((s) => !used.has(s)));
    if (!sheet) continue;
    used.add(sheet);
    out.push(spec.label);
  }
  return out;
}

/** Display name of the combined source, e.g. "pack.xlsx + repairs.pdf". */
export function combinedSourceName(files: Array<{ name: string }>): string {
  return files.map((f) => f.name).join(" + ");
}
