"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, UploadCloud, X, Loader2, FileIcon } from "lucide-react";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
const BUCKET = "update-attachments";

type Row = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  startupId: string;
  /** When set, manage attachments of an already-published update instead of the pending draft. */
  weeklyUpdateId?: string | null;
}

export function AttachFilesButton({ startupId, weeklyUpdateId }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const totalBytes = rows.reduce((s, r) => s + r.file_size, 0);

  async function refresh() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const query = supabase
      .from("weekly_update_attachments")
      .select("id,file_name,file_size,mime_type,storage_path")
      .eq("startup_id", startupId)
      .eq("author_id", user.id)
      .order("created_at", { ascending: true });
    const { data, error } = await (weeklyUpdateId
      ? query.eq("weekly_update_id", weeklyUpdateId)
      : query.is("weekly_update_id", null));
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const remainingSlots = MAX_FILES - rows.length;
    if (remainingSlots <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    const accepted = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.warning(`Only ${remainingSlots} more file(s) allowed.`);
    }

    const incomingBytes = accepted.reduce((s, f) => s + f.size, 0);
    if (totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
      toast.error("Total attachment size cannot exceed 50 MB.");
      return;
    }

    setUploading(true);
    try {
      for (const file of accepted) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${startupId}/${user.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { error: insErr } = await supabase
          .from("weekly_update_attachments")
          .insert({
            startup_id: startupId,
            weekly_update_id: weeklyUpdateId ?? null,
            author_id: user.id,
            storage_path: path,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
          } as never);
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          toast.error(`${file.name}: ${insErr.message}`);
        }
      }
      await refresh();
      toast.success("Attachments saved.");
    } finally {
      setUploading(false);
    }
  }

  async function removeRow(row: Row) {
    const { error } = await supabase
      .from("weekly_update_attachments")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  function onPickFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    uploadFiles(files);
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    setDragging(false);
    const files = Array.from(ev.dataTransfer.files ?? []);
    uploadFiles(files);
  }

  const reachedMax = rows.length >= MAX_FILES;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 cursor-pointer"
        >
          <Paperclip className="h-4 w-4" />
          Attach files
          {rows.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
              {rows.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach files to this update</DialogTitle>
          <DialogDescription>
            Documents, PDFs, screenshots, photos, or short videos. Up to {MAX_FILES} files, 50 MB total.
            They'll appear in the full investor version of this update.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => !reachedMax && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!reachedMax) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => !reachedMax && onDrop(e)}
          disabled={uploading || reachedMax}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all",
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/[0.03]",
            (uploading || reachedMax) && "opacity-60 cursor-not-allowed",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
          )}
          <div className="text-sm font-medium">
            {reachedMax
              ? "Maximum number of files reached"
              : uploading
                ? "Uploading…"
                : dragging
                  ? "Drop to upload"
                  : "Click to browse or drag & drop"}
          </div>
          <div className="text-xs text-muted-foreground">
            {rows.length}/{MAX_FILES} files · {formatBytes(totalBytes)} / 50 MB
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPickFiles}
          />
        </button>

        <div className="max-h-60 space-y-2 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-2 text-center text-xs text-muted-foreground">
              No files attached yet.
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2"
              >
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.file_name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(r.file_size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(r)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
