import type { Dataset } from "./types";

/**
 * Columnar + dictionary encoding for large tables so the bundled default
 * dataset and uploaded datasets stored in the browser stay compact.
 */
type Columnar = { __columnar: true; cols: string[]; dicts: Array<string[] | null>; rows: unknown[][] };

const LARGE: Array<keyof Dataset> = ["activity", "repairs", "cycles", "impacts", "assets", "assetCycles", "laundryMonths", "waste"];

export type EncodedDataset = Record<string, unknown>;

export function encodeDataset(ds: Dataset): EncodedDataset {
  const out: EncodedDataset = { ...ds };
  for (const key of LARGE) {
    const rows = ds[key] as unknown as Array<Record<string, unknown>>;
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const dicts = cols.map((c) => {
      const values = new Set<string>();
      for (const r of rows) {
        const v = r[c];
        if (typeof v !== "string") return null;
        values.add(v);
        if (values.size > 256) return null;
      }
      return rows.length > 20 ? [...values] : null;
    });
    const index = dicts.map((d) => (d ? new Map(d.map((v, i) => [v, i])) : null));
    out[key] = {
      __columnar: true,
      cols,
      dicts,
      rows: rows.map((r) => cols.map((c, i) => (index[i] ? index[i]!.get(r[c] as string) : r[c]))),
    } satisfies Columnar;
  }
  return out;
}

export function decodeDataset(enc: EncodedDataset): Dataset {
  const out: Record<string, unknown> = { ...enc };
  for (const key of LARGE) {
    const v = enc[key] as Columnar | unknown[] | undefined;
    if (v && !Array.isArray(v) && (v as Columnar).__columnar) {
      const { cols, rows, dicts } = v as Columnar;
      out[key] = rows.map((r) => {
        const o: Record<string, unknown> = {};
        cols.forEach((c, i) => {
          const d = dicts?.[i];
          o[c] = d ? d[r[i] as number] : r[i];
        });
        return o;
      });
    }
  }
  return out as unknown as Dataset;
}
