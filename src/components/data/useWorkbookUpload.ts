import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { IngestReport } from "@/lib/data/types";
import type { RawSheet } from "@/lib/data/ingest";
import { combinedSourceName, MAX_UPLOAD_FILES, mergeUploadedSheets, type MergeSummary, type UploadedFileSheets } from "@/lib/data/merge-files";
import { useDataset } from "@/lib/state/dataset-store";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_UPLOAD = ".xlsx,.xlsm,.xls,.pdf";

export type UploadKind = "excel" | "pdf";

export function uploadKind(name: string): UploadKind | null {
  if (/\.(xlsx|xlsm|xls)$/i.test(name)) return "excel";
  if (/\.pdf$/i.test(name)) return "pdf";
  return null;
}

export interface UploadProgress {
  stage: "reading" | "pages" | "mapping";
  file?: string;
  done?: number;
  total?: number;
}

const fileId = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

async function readFileSheets(file: File, onPages: (done: number, total: number) => void): Promise<RawSheet[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (uploadKind(file.name) === "pdf") {
    const { readPdfPages, pagesToSheets } = await import("@/lib/data/pdf-tables");
    const pages = await readPdfPages(buf, onPages);
    return pagesToSheets(pages).sheets;
  }
  const { readWorkbookSheets } = await import("@/lib/data/ingest");
  return readWorkbookSheets(buf);
}

/**
 * Reads up to three Excel/PDF files in the browser, combines their tables and
 * validates the result once. The active dataset always matches the file list:
 * when the combination is incomplete, nothing is active until a file is added
 * or removed.
 */
export function useWorkbookUpload() {
  const { files, saveFiles, activateUpload, clearUpload } = useDataset();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [lastReport, setLastReport] = useState<IngestReport | null>(null);
  const [summary, setSummary] = useState<MergeSummary | null>(null);

  const combine = useCallback(
    async (list: UploadedFileSheets[]): Promise<boolean> => {
      await saveFiles(list);
      if (!list.length) {
        setLastReport(null);
        setSummary(null);
        await clearUpload();
        return false;
      }
      setProgress({ stage: "mapping" });
      const { ingestRawSheets } = await import("@/lib/data/ingest");
      const merged = mergeUploadedSheets(list);
      setSummary(merged.summary);
      const name = combinedSourceName(list);
      const res = ingestRawSheets(merged.sheets, name, {
        datasetId: `upload-${Date.now()}`,
        datasetName: list.map((f) => f.name.replace(/\.[^.]+$/, "")).join(" + "),
        passportAssetsPerSite: Infinity,
      });
      setLastReport(res.report);
      if (!res.dataset) {
        await clearUpload();
        return false;
      }
      await activateUpload(res.dataset, res.report);
      return true;
    },
    [saveFiles, activateUpload, clearUpload],
  );

  const addFiles = useCallback(
    async (incoming: File[]): Promise<boolean> => {
      const room = MAX_UPLOAD_FILES - files.length;
      if (room <= 0) {
        toast.error(`You can combine up to ${MAX_UPLOAD_FILES} files. Remove one first.`);
        return false;
      }
      const accepted: File[] = [];
      for (const f of incoming) {
        if (!uploadKind(f.name)) toast.error(`${f.name} is not an Excel workbook or a PDF.`);
        else if (f.size > MAX_UPLOAD_BYTES) toast.error(`${f.name} is larger than 25 MB.`);
        else if (files.some((x) => x.id === fileId(f)) || accepted.some((x) => fileId(x) === fileId(f))) toast.error(`${f.name} is already in the list.`);
        else accepted.push(f);
      }
      if (incoming.length > room) toast.warning(`Only ${room} more file${room === 1 ? "" : "s"} can be added (maximum ${MAX_UPLOAD_FILES}).`);
      const take = accepted.slice(0, room);
      if (!take.length) return false;

      setBusy(true);
      try {
        const read: UploadedFileSheets[] = [];
        for (const f of take) {
          setProgress({ stage: "reading", file: f.name });
          try {
            const sheets = await readFileSheets(f, (done, total) => setProgress({ stage: "pages", file: f.name, done, total }));
            if (!sheets.length) {
              toast.error(`No data tables were recognised in ${f.name}`, {
                description: "Use a file with column headers such as customer_id, site_id and month.",
              });
              continue;
            }
            read.push({ id: fileId(f), name: f.name, kind: uploadKind(f.name)!, size: f.size, sheets });
          } catch (e) {
            console.error(e);
            toast.error(uploadKind(f.name) === "pdf" ? `${f.name} could not be read. Is it a text-based (not scanned) PDF?` : `${f.name} could not be read. Is it a valid Excel file?`);
          }
        }
        if (!read.length) return false;
        const ok = await combine([...files, ...read]);
        if (ok) toast.success(read.length === 1 ? `Added ${read[0].name}` : `Added ${read.length} files`);
        return ok;
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [files, combine],
  );

  const removeFile = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await combine(files.filter((f) => f.id !== id));
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [files, combine],
  );

  /** Single-file replacement used by the Trust center. */
  const upload = useCallback(
    async (file: File) => {
      await saveFiles([]);
      const ok = await (async () => {
        const kind = uploadKind(file.name);
        if (!kind) {
          toast.error("Choose an Excel workbook (.xlsx) or a PDF with data tables.");
          return false;
        }
        setBusy(true);
        try {
          setProgress({ stage: "reading", file: file.name });
          const sheets = await readFileSheets(file, (done, total) => setProgress({ stage: "pages", file: file.name, done, total }));
          return await combine([{ id: fileId(file), name: file.name, kind, size: file.size, sheets }]);
        } catch (e) {
          console.error(e);
          toast.error("The file could not be read.");
          return false;
        } finally {
          setBusy(false);
          setProgress(null);
        }
      })();
      if (ok) toast.success(`Loaded ${file.name}`);
      return ok;
    },
    [saveFiles, combine],
  );

  return { files, addFiles, removeFile, upload, busy, progress, lastReport, summary };
}
