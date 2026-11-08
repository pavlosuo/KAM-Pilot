import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { FINNISH_ACCELERATOR_DOMAINS, SPECIAL_PROGRAM_LOGOS } from "@/design-system/ventura-6bef42/lib/finnish-accelerators";
import { toast } from "sonner";
import { useFileDrop } from "@/design-system/ventura-6bef42/lib/drop";

function normalizeDomain(input?: string | null): string | null {
  const raw = input?.trim().toLowerCase();
  if (!raw) return null;

  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).hostname.replace(/^www\./, "").replace(/\.+$/, "");
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#:]/)[0]
      .replace(/\.+$/, "");
  }
}

type Props = {
  name: string;
  /** Existing custom logo URL (overrides logo.dev) */
  logoUrl?: string | null;
  /** Called when user uploads a custom logo file. Receives the public URL. */
  onCustomLogo?: (url: string) => void;
  size?: number;
  /** Always show upload UI (skip Logo.dev), e.g. for "Other / Not listed" programs */
  forceUpload?: boolean;
};

export function ProgramLogo({ name, logoUrl, onCustomLogo, size = 40, forceUpload = false }: Props) {
  const specialLogo = forceUpload ? null : SPECIAL_PROGRAM_LOGOS[name];
  // A program's own logo (set in the dashboard / program settings) always wins;
  // the built-in special logos are only a fallback when none is stored.
  const effectiveLogoUrl = logoUrl ?? specialLogo ?? null;
  const domain = forceUpload ? null : normalizeDomain(FINNISH_ACCELERATOR_DOMAINS[name]);
  const previewToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("__lovable_token")
      : null;
  const [errored, setErrored] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setErrored(false);
  }, [name, domain]);

  const showCustom = !!effectiveLogoUrl;
  const showLogoDev = !forceUpload && !effectiveLogoUrl && !errored;
  const needsUpload = !effectiveLogoUrl && (errored || forceUpload);

  async function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const path = `${user.id}/program-logos/${slug}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("startup-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("startup-logos").getPublicUrl(path);
      onCustomLogo?.(data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const boxStyle = { width: size, height: size };
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  params.set("name", name);
  params.set("size", String(size * 2));
  if (previewToken) params.set("__lovable_token", previewToken);
  const proxyUrl = `/api/public/program-logo?${params.toString()}`;

  const canUpload = !!onCustomLogo && (needsUpload || showCustom);
  const { dropProps, dragging } = useFileDrop({
    onFile: async (f) => {
      if (!onCustomLogo) return;
      if (f.size > 5 * 1024 * 1024) {
        toast.error("Logo must be under 5MB");
        return;
      }
      setUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const ext = f.name.split(".").pop()?.toLowerCase() || "png";
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const path = `${user.id}/program-logos/${slug}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("startup-logos")
          .upload(path, f, { upsert: true, contentType: f.type });
        if (error) throw error;
        const { data } = supabase.storage.from("startup-logos").getPublicUrl(path);
        onCustomLogo?.(data.publicUrl);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    accept: (f) => f.type.startsWith("image/"),
    disabled: !canUpload || uploading,
  });
  const Box: any = canUpload ? "button" : "div";
  const boxProps: any = canUpload
    ? {
        type: "button",
        onClick: () => fileRef.current?.click(),
        disabled: uploading,
        title: showCustom ? "Replace logo" : "Upload logo",
        "aria-label": showCustom ? "Replace logo" : "Upload logo",
      }
    : {};


  return (
    <div className="flex items-center gap-2">
      <Box
        style={boxStyle}
        className={`shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          canUpload ? "cursor-pointer transition hover:border-primary/50 hover:bg-muted/70 disabled:opacity-60" : ""
        } ${dragging ? "ring-2 ring-primary border-primary" : ""}`}
        {...(canUpload ? dropProps : {})}
        {...boxProps}
      >

        {showCustom ? (
          <img src={effectiveLogoUrl!} alt={name} className="h-full w-full object-contain" />
        ) : showLogoDev ? (
          <img
            src={proxyUrl}
            alt={name}
            className="h-full w-full object-contain"
            onError={() => {
              setErrored(true);
              console.warn("Program logo load failed", { name, domain, proxyUrl });
            }}
          />
        ) : uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : onCustomLogo ? (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        ) : (
          <img
            src="/favicon.ico"
            alt={name}
            className="h-full w-full object-contain p-1.5"
          />
        )}
      </Box>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
