import { useRef, useState, useEffect } from "react";
import * as tus from "tus-js-client";
import { Link } from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Loader2, Upload, Video, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPitchVideoUpload,
  setPitchVideo,
  deletePitchVideo,
  getPitchVideoStatus,
} from "@/design-system/ventura-6bef42/lib/cloudflare-stream.functions";
import { NativeVideoPlayer } from "@/design-system/ventura-6bef42/components/NativeVideoPlayer";
import { useFileDrop } from "@/design-system/ventura-6bef42/lib/drop";
import { FileUpload } from "@/design-system/ventura-6bef42/components/ui/file-upload";

const MAX_DURATION_SECONDS = 120;
const MAX_FILE_BYTES = 600 * 1024 * 1024; // 600 MB cap

type Props = {
  startupId: string;
  currentUid?: string | null;
  onChange?: (uid: string | null) => void;
};

type Status = "idle" | "preparing" | "uploading" | "processing" | "done" | "error";

async function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata"));
    };
    v.src = url;
  });
}

export function PitchVideoUploader({ startupId, currentUid, onChange }: Props) {
  const fnCreate = useServerFn(createPitchVideoUpload);
  const fnSet = useServerFn(setPitchVideo);
  const fnDelete = useServerFn(deletePitchVideo);
  const fnStatus = useServerFn(getPitchVideoStatus);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(currentUid ? "done" : "idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(currentUid ?? null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const next = currentUid ?? null;
    setUid((prev) => {
      if (prev === next) return prev;
      // Don't override an in-flight processing state for the same upload.
      setStatus(next ? "done" : "idle");
      return next;
    });
  }, [currentUid]);


  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Video must be under 600 MB.");
      return;
    }

    let duration: number;
    try {
      duration = await readVideoDuration(file);
    } catch {
      setError("Could not read video. Try a different file.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Could not determine video duration.");
      return;
    }
    if (duration > MAX_DURATION_SECONDS + 1) {
      setError(`Video must be ${MAX_DURATION_SECONDS / 60} minutes or shorter.`);
      return;
    }

    try {
      setStatus("preparing");
      const { uploadURL, uid: newUid } = await fnCreate({
        data: { startupId, fileSize: file.size },
      });

      setStatus("uploading");
      setProgress(0);
      await uploadWithTus(uploadURL, file, (p) => setProgress(p));

      await fnSet({ data: { startupId, uid: newUid, duration: Math.round(duration) } });
      setUid(newUid);
      setStatus("processing");
      onChange?.(newUid);
      toast.success("Video uploaded — processing...");
      // Poll Cloudflare until the video is ready to stream (avoids "unknown error" in iframe).
      const start = Date.now();
      const MAX_MS = 3 * 60 * 1000;
      while (Date.now() - start < MAX_MS) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const s = await fnStatus({ data: { uid: newUid } });
          if (s.ready) {
            setStatus("done");
            return;
          }
          if (s.error) {
            setError(s.error);
            setStatus("error");
            return;
          }
        } catch {
          // keep polling
        }
      }
      // Timed out waiting — still show player; user can refresh.
      setStatus("done");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus("error");
    }
  }

  function uploadWithTus(url: string, file: File, onProgress: (p: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: url,
        uploadUrl: url,
        // 50 MB chunks — Cloudflare requires multiples of 256 KiB and >= 5 MB.
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000],
        metadata: { filename: file.name, filetype: file.type },
        onError: (err) => {
          reject(err instanceof Error ? err : new Error("Network error during upload"));
        },
        onProgress: (loaded, total) => {
          if (total > 0) onProgress(Math.round((loaded / total) * 100));
        },
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  }



  async function handleDelete() {
    if (!uid) return;
    setDeleting(true);
    try {
      await fnDelete({ data: { startupId } });
      setUid(null);
      setStatus("idle");
      setProgress(0);
      onChange?.(null);
      toast.success("Video removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove video");
    } finally {
      setDeleting(false);
    }
  }

  const busy = status === "preparing" || status === "uploading" || status === "processing";

  const { dropProps, dragging } = useFileDrop({
    onFile: (f) => handleFile(f),
    accept: (f) => f.type.startsWith("video/"),
    disabled: busy,
  });

  return (
    <div
      {...dropProps}
      className={`space-y-3 text-center rounded-md ${dragging ? "ring-2 ring-primary" : ""}`}
    >
      {uid && status === "done" && <NativeVideoPlayer uid={uid} className="aspect-[9/16] mx-auto w-full max-w-[300px]" />}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFile(f);
        }}
      />

      {!uid && (
        <FileUpload
          accept="video/*"
          acceptedFileTypes={["video/"]}
          maxFileSize={500 * 1024 * 1024}
          hint="MP4 or MOV · vertical video works best"
          onFileSelect={(f) => void handleFile(f)}
          busy={busy}
          busyLabel={status === "preparing" ? "Preparing upload…" : status === "processing" ? "Processing…" : "Uploading…"}
          progress={status === "uploading" ? progress : null}
        />
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {uid && (
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            size="sm"
            className="w-36 justify-center"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Replace video
              </>
            )}
          </Button>
        )}
        {uid && !busy && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove
          </Button>
        )}
      </div>
      {uid && !busy && (
        <Button asChild className="w-full">
          <Link to="/startups">Save</Link>
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default PitchVideoUploader;
