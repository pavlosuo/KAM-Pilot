import type { AssetCycle } from "./types";

/**
 * Compact packing for the full RFID cycle history (garment passports).
 * Row: [assetId, cycleNumber, pickupMinutes, inOffset, outOffset, deliveredOffset, late]
 * Minutes are relative to the earliest pickup; offsets are minutes after pickup.
 */
export interface PackedCycles {
  epoch: string;
  ids: string[];
  rows: number[][];
}

const toMin = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 16)}:00Z`) / 60000);
const fromMin = (m: number) => new Date(m * 60000).toISOString().slice(0, 16);

export function packCycles(cycles: AssetCycle[]): PackedCycles {
  const valid = cycles.filter((c) => c.pickup && c.delivered);
  const epochMin = valid.reduce((m, c) => Math.min(m, toMin(c.pickup)), Number.POSITIVE_INFINITY);
  const ids: string[] = [];
  const idx = new Map<string, number>();
  const rows = valid.map((c) => {
    let i = idx.get(c.assetId);
    if (i == null) {
      i = ids.length;
      ids.push(c.assetId);
      idx.set(c.assetId, i);
    }
    const p = toMin(c.pickup);
    const off = (v: string) => (v ? toMin(v) - p : -1);
    return [i, c.cycleNumber, p - epochMin, off(c.inLaundry), off(c.outLaundry), off(c.delivered), c.late ? 1 : 0];
  });
  return { epoch: Number.isFinite(epochMin) ? fromMin(epochMin) : "2025-01-01T00:00", ids, rows };
}

export function unpackCycles(p: PackedCycles): AssetCycle[] {
  const e = toMin(p.epoch);
  return p.rows.map(([i, n, pm, io, oo, d, late]) => {
    const pickupMin = e + pm;
    const at = (o: number) => (o >= 0 ? fromMin(pickupMin + o) : "");
    return {
      assetId: p.ids[i],
      cycleNumber: n,
      pickup: fromMin(pickupMin),
      inLaundry: at(io),
      outLaundry: at(oo),
      delivered: at(d),
      hours: d >= 0 ? Math.round((d / 60) * 10) / 10 : 0,
      late: late === 1,
    };
  });
}

