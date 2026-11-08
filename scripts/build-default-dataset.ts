/**
 * Regenerates the bundled default dataset from the challenge workbook using
 * the same ingestion code the app uses for uploads.
 *
 *   bun scripts/build-default-dataset.ts <path-to-xlsx>
 *
 * Writes three files: the dataset (with a small garment-passport sample), the
 * ingestion report, and the full packed RFID cycle history (lazy-loaded).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ingestWorkbook } from "../src/lib/data/ingest";
import { encodeDataset } from "../src/lib/data/codec";
import { packCycles } from "../src/lib/data/asset-cycles";

const src = process.argv[2] ?? "/mnt/user-uploads/Lindstrom_SinceAI_Customer_Value_Synthetic_Data_Pack.xlsx";
const buf = readFileSync(src);
const opts = { datasetId: "lindstrom-sinceai-2026", datasetName: "Lindström × Since AI synthetic data pack" };
const name = src.split("/").pop() ?? "workbook.xlsx";
const { dataset, report } = ingestWorkbook(new Uint8Array(buf), name, opts);
const full = ingestWorkbook(new Uint8Array(buf), name, { ...opts, passportAssetsPerSite: Infinity });
if (!dataset || !full.dataset) {
  console.error(JSON.stringify(report.issues, null, 2));
  process.exit(1);
}
const round = (v: unknown) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v);
const json = JSON.stringify(encodeDataset(dataset), (_k, v) => round(v));
writeFileSync("src/data/default-dataset.json", json);
writeFileSync("src/data/default-report.json", JSON.stringify(report, null, 1));
const cycles = JSON.stringify(packCycles(full.dataset.assetCycles));
writeFileSync("src/data/default-asset-cycles.json", cycles);
console.log("dataset bytes", json.length, "cycle history bytes", cycles.length, "cycles", full.dataset.assetCycles.length);
console.log("issues", report.issues.length, "checks", report.reconciliation.map((c) => `${c.status} ${c.id}`).join(" | "));
