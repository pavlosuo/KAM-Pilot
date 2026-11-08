import { useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

type Props = {
  logoUrl: string | null;
  onLogo: (url: string) => void;
  onRemove?: () => void;
};

export function OtherProgramLogoUploader({ logoUrl, onLogo, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function uploadFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/program-logos/other-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("startup-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("startup-logos").getPublicUrl(path);
      onLogo(data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (file) uploadFile(file);
  }

  function handleDrop(ev: React.DragEvent) {
    ev.preventDefault();
    setDragging(false);
    const file = ev.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }

  if (logoUrl) {
    return (
      <div className="group relative flex items-center gap-4 rounded-xl border bg-gradient-to-br from-primary/5 to-background p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm">
          <img src={logoUrl} alt="Program logo" className="h-full w-full object-contain" />
        </div>
        <div className="hidden flex-1 min-w-0 sm:block">
          <div className="text-sm font-medium">Logo added</div>
          <div className="text-xs text-muted-foreground">Looks great. You can replace or remove it anytime.</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace"}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Remove logo"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      disabled={uploading}
      className={cn(
        "group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
        "bg-gradient-to-br from-muted/30 via-background to-muted/20",
        dragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/[0.03]",
        uploading && "opacity-70 cursor-wait",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border bg-background shadow-sm transition-all",
          dragging
            ? "border-primary text-primary scale-110"
            : "text-muted-foreground group-hover:text-primary group-hover:border-primary/40 group-hover:scale-105",
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : dragging ? (
          <UploadCloud className="h-5 w-5" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
      </div>
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-foreground">
          {uploading ? "Uploading…" : dragging ? "Drop to upload" : "Upload program logo"}
        </div>
        <div className="text-xs text-muted-foreground">
          Click to browse or drag & drop · PNG, JPG, SVG
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </button>
  );
}
