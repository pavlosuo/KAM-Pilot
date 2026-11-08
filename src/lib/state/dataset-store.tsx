import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { encodeDataset, type EncodedDataset } from "@/lib/data/codec";
import type { Dataset, IngestReport } from "@/lib/data/types";
import type { UploadedFileSheets } from "@/lib/data/merge-files";
import { idbDelete, idbGet, idbSet } from "./idb";
import { restoreUpload, UPLOAD_FILES_KEY, UPLOAD_STORAGE_KEY } from "@/lib/data/upload-source";

type Source = "empty" | "upload";

interface DatasetState {
  dataset: Dataset | null;
  report: IngestReport | null;
  source: Source;
  loading: boolean;
  error: string | null;
  /** The uploaded files (max. three) the active dataset was combined from. */
  files: UploadedFileSheets[];
  saveFiles: (files: UploadedFileSheets[]) => Promise<void>;
  activateUpload: (ds: Dataset, report: IngestReport) => Promise<void>;
  clearUpload: () => Promise<void>;
}

const Ctx = createContext<DatasetState | null>(null);
const KEY = UPLOAD_STORAGE_KEY;

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [report, setReport] = useState<IngestReport | null>(null);
  const [files, setFiles] = useState<UploadedFileSheets[]>([]);
  const [source, setSource] = useState<Source>("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [stored, storedFiles] = await Promise.all([
          idbGet<{ enc: EncodedDataset; report: IngestReport }>(KEY).catch(() => undefined),
          idbGet<UploadedFileSheets[]>(UPLOAD_FILES_KEY).catch(() => undefined),
        ]);
        if (!alive) return;
        const upload = restoreUpload(stored);
        if (upload) {
          setDataset(upload.dataset);
          setReport(upload.report);
          setSource("upload");
        }
        if (Array.isArray(storedFiles)) setFiles(storedFiles);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveFiles = useCallback(async (next: UploadedFileSheets[]) => {
    setFiles(next);
    if (next.length) await idbSet(UPLOAD_FILES_KEY, next).catch(() => undefined);
    else await idbDelete(UPLOAD_FILES_KEY).catch(() => undefined);
  }, []);

  const activateUpload = useCallback(async (ds: Dataset, rep: IngestReport) => {
    await idbSet(KEY, { enc: encodeDataset(ds), report: rep });
    setDataset(ds);
    setReport(rep);
    setSource("upload");
  }, []);

  const clearUpload = useCallback(async () => {
    await idbDelete(KEY).catch(() => undefined);
    setDataset(null);
    setReport(null);
    setSource("empty");
  }, []);

  const value = useMemo(
    () => ({ dataset, report, source, loading, error, files, saveFiles, activateUpload, clearUpload }),
    [dataset, report, source, loading, error, files, saveFiles, activateUpload, clearUpload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataset() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDataset must be used within DatasetProvider");
  return ctx;
}
