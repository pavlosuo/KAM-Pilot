import { decodeDataset, type EncodedDataset } from "./codec";
import type { Dataset, IngestReport } from "./types";

export const UPLOAD_STORAGE_KEY = "customer-upload-v2";
/** Raw tables of each uploaded file, kept so files can be added or removed later. */
export const UPLOAD_FILES_KEY = "customer-upload-files-v1";

/** Only operator uploads saved by this workflow can become active data. */
export function restoreUpload(stored: { enc: EncodedDataset; report: IngestReport } | undefined): { dataset: Dataset; report: IngestReport } | null {
  if (!stored?.enc || !stored.report) return null;
  return { dataset: decodeDataset(stored.enc), report: stored.report };
}
