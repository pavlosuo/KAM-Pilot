import { UploadCloud, X, FileIcon, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { type DragEvent, useCallback, useRef, useState } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export interface FileUploadError {
  message: string;
  code: string;
}

interface FileUploadProps {
  /** Called with a valid, validated file */
  onFileSelect?: (file: File) => void;
  onUploadError?: (error: FileUploadError) => void;
  /** input accept attribute, e.g. "application/pdf" or "image/*" */
  accept?: string;
  /** Human-readable hint, e.g. "PDF up to 50 MB" */
  hint?: string;
  /** mime prefixes/patterns the file must match, e.g. ["application/pdf"] */
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  currentFile?: File | null;
  /** Preview label when a file (or remote file) is already set */
  currentFileName?: string | null;
  onFileRemove?: () => void;
  busy?: boolean;
  busyLabel?: string;
  progress?: number | null;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;
const FILE_SIZES = ["Bytes", "KB", "MB", "GB", "TB"] as const;

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unit = FILE_SIZES[i] || FILE_SIZES[FILE_SIZES.length - 1];
  return `${Number.parseFloat((bytes / k ** i).toFixed(decimals))} ${unit}`;
};

export function FileUpload({
  onFileSelect,
  onUploadError,
  accept,
  hint,
  acceptedFileTypes = [],
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  currentFile = null,
  currentFileName = null,
  onFileRemove,
  busy = false,
  busyLabel,
  progress = null,
  disabled = false,
  className,
  compact = false,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<FileUploadError | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const locked = disabled || busy;

  const handleError = useCallback(
    (err: FileUploadError) => {
      setError(err);
      onUploadError?.(err);
      setTimeout(() => setError(null), 4000);
    },
    [onUploadError],
  );

  const handleFileSelect = useCallback(
    (file: File | null) => {
      if (!file) return;
      setError(null);

      if (file.size > maxFileSize) {
        handleError({
          message: `File size exceeds ${formatBytes(maxFileSize)}`,
          code: "FILE_TOO_LARGE",
        });
        return;
      }

      if (acceptedFileTypes.length) {
        const type = file.type.toLowerCase();
        const ok = acceptedFileTypes.some((t) => type.match(t.toLowerCase()));
        if (!ok) {
          handleError({
            message: `File type must be ${acceptedFileTypes.join(", ")}`,
            code: "INVALID_FILE_TYPE",
          });
          return;
        }
      }

      onFileSelect?.(file);
    },
    [acceptedFileTypes, maxFileSize, handleError, onFileSelect],
  );

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!locked) setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (locked) return;
    handleFileSelect(e.dataTransfer.files?.[0] ?? null);
  };

  const label = currentFile?.name ?? currentFileName ?? null;

  return (
    <div className={cn("min-w-0 w-full max-w-full overflow-hidden", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !locked && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !locked) inputRef.current?.click();
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "group relative flex min-w-0 w-full max-w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all duration-200 outline-none",
          compact ? "px-4 py-6" : "px-6 py-10",
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40",
          locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={locked}
          onChange={(e) => {
            handleFileSelect(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div
              key="busy"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex w-full flex-col items-center gap-3"
            >
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <div className="w-full max-w-xs space-y-1.5">
                <p className="truncate text-sm font-medium">{label ?? busyLabel ?? "Uploading…"}</p>
                {typeof progress === "number" && (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        transition={{ ease: "easeOut", duration: 0.3 }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
                  </>
                )}
                {busyLabel && label && (
                  <p className="text-xs text-muted-foreground">{busyLabel}</p>
                )}
              </div>
            </motion.div>
          ) : label ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="grid min-w-0 w-full max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden text-left"
            >
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-primary/10">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="block max-w-full truncate text-sm font-medium" title={label}>{label}</p>
                <p className="max-w-full truncate text-xs text-muted-foreground">
                  {currentFile ? formatBytes(currentFile.size) : hint ?? "Click to replace"}
                </p>
              </div>
              {onFileRemove && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (locked) return;
                    onFileRemove();
                  }}
                  className={cn(
                    "flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors",
                    locked
                      ? "cursor-not-allowed opacity-40"
                      : "cursor-pointer hover:bg-muted hover:text-destructive",
                  )}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={dragging ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20"
              >
                <UploadCloud className="h-6 w-6 text-primary" />
              </motion.div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {dragging ? "Drop your file here" : "Drag and drop your file here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hint ?? `Up to ${formatBytes(maxFileSize)}`}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-medium shadow-sm transition-colors group-hover:border-primary/50 group-hover:text-primary">
                <UploadCloud className="h-3.5 w-3.5" /> Choose file
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-xs text-destructive"
          >
            {error.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileUpload;
