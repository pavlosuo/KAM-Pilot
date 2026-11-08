import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useFileDrop } from "@/design-system/ventura-6bef42/lib/drop";
import { SPECIAL_PROGRAM_LOGOS } from "@/design-system/ventura-6bef42/lib/finnish-accelerators";

const SPECIAL_LOGO_ALIASES: Record<string, string> = {
  ignite: SPECIAL_PROGRAM_LOGOS["Ignite"],
  forward: SPECIAL_PROGRAM_LOGOS["FORWARD accelerator"],
  "forward accelerator": SPECIAL_PROGRAM_LOGOS["FORWARD accelerator"],
};

export function specialLogoFor(name?: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  if (SPECIAL_PROGRAM_LOGOS[trimmed]) return SPECIAL_PROGRAM_LOGOS[trimmed];
  return SPECIAL_LOGO_ALIASES[trimmed.toLowerCase()] ?? null;
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dropdown-menu";

type Props = {
  logoUrl?: string | null;
  /** When provided and logoUrl is empty, the box auto-previews the logo
   *  from logo.dev (via the /api/public/program-logo proxy) based on the name. */
  name?: string | null;
  onUpload: (file: File) => void | Promise<void>;
  onRemove: () => void;
  alt?: string;
  title?: string;
  sizeClass?: string;
};

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function LogoPicker({
  logoUrl,
  name,
  onUpload,
  onRemove,
  alt = "",
  title = "Upload logo",
  sizeClass = "h-14 w-14",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedName = useDebounced((name ?? "").trim(), 350);
  const [autoErrored, setAutoErrored] = useState(false);

  useEffect(() => {
    setAutoErrored(false);
  }, [debouncedName]);

  const previewToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("__lovable_token")
      : null;

  const autoLogoUrl = useMemo(() => {
    if (logoUrl || !debouncedName) return null;
    const special = specialLogoFor(debouncedName);
    if (special) return special;
    const params = new URLSearchParams();
    params.set("name", debouncedName);
    params.set("size", "128");
    if (previewToken) params.set("__lovable_token", previewToken);
    return `/api/public/program-logo?${params.toString()}`;
  }, [logoUrl, debouncedName, previewToken]);

  const handleFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (f) void onUpload(f);
    ev.target.value = "";
  };

  const { dropProps, dragging } = useFileDrop({
    onFile: (f) => onUpload(f),
    accept: (f) => f.type.startsWith("image/"),
  });

  const hasAnyImage = !!logoUrl || (!!autoLogoUrl && !autoErrored);

  const box = (
    <div
      {...dropProps}
      className={`${sizeClass} shrink-0 cursor-pointer overflow-hidden rounded-md border bg-muted flex items-center justify-center transition-shadow hover:shadow-sm ${dragging ? "ring-2 ring-primary border-primary" : ""}`}
      title={title}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={alt} className="h-full w-full object-cover" />
      ) : autoLogoUrl && !autoErrored ? (
        <img
          src={autoLogoUrl}
          alt={alt}
          className="h-full w-full object-contain"
          onError={() => setAutoErrored(true)}
        />
      ) : (
        <ImagePlus className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );

  return (
    <>
      {hasAnyImage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Change logo"
              className="rounded-md outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {box}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => inputRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" /> Upload custom logo
            </DropdownMenuItem>
            {logoUrl && (
              <DropdownMenuItem
                onClick={onRemove}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove custom logo
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Add logo"
          className="rounded-md outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {box}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
}

