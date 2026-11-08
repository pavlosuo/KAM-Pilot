import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Pipette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { updateProgramBranding } from "@/design-system/ventura-6bef42/lib/program-admin.functions";

const PRESETS = ["#0F172A", "#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#7C3AED"];

type Props = {
  programId: string;
  programName: string;
  programDescription?: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  backgroundMode?: string | null;
  cohortStartDate?: string | null;
  onSaved: () => void | Promise<unknown>;
};

export function ProgramBrandingEditor({
  programId,
  programName,
  programDescription,
  logoUrl,
  themeColor,
  backgroundMode,
  cohortStartDate,
  onSaved,
}: Props) {
  const save = useServerFn(updateProgramBranding);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(programName);
  const [description, setDescription] = useState(programDescription ?? "");
  const [color, setColor] = useState(themeColor ?? "#4F46E5");
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [bg, setBg] = useState<"light" | "dark">(backgroundMode === "dark" ? "dark" : "light");
  const [cohortStart, setCohortStart] = useState(cohortStartDate ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [eyeDropperOpen, setEyeDropperOpen] = useState(false);
  const eyeDropperSupported =
    typeof window !== "undefined" && "EyeDropper" in window;

  async function pickColor() {
    if (!eyeDropperSupported) {
      toast.error("Your browser does not support the colour pipette.");
      return;
    }
    setEyeDropperOpen(true);
    try {
      const eyeDropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
      const result = await eyeDropper.open();
      setColor(result.sRGBHex.toUpperCase());
    } catch {
      // user cancelled or API error — no-op
    } finally {
      setEyeDropperOpen(false);
    }
  }

  useEffect(() => {
    setName(programName);
    setDescription(programDescription ?? "");
    setColor(themeColor ?? "#4F46E5");
    setLogo(logoUrl ?? "");
    setBg(backgroundMode === "dark" ? "dark" : "light");
  }, [themeColor, logoUrl, backgroundMode, programName, programDescription]);

  const dirty =
    programName !== name.trim() ||
    (programDescription ?? "") !== description.trim() ||
    (themeColor ?? "") !== color ||
    (logoUrl ?? "") !== logo ||
    (backgroundMode === "dark" ? "dark" : "light") !== bg;

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${uid}/program-${programId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("startup-logos")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      const { data } = supabase.storage.from("startup-logos").getPublicUrl(path);
      setLogo(data.publicUrl);
      toast.success("Logo uploaded — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
    <div className="mt-3 grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Program name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short description shown to founders"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Cohort start date</Label>
        <Input
          type="date"
          value={cohortStart}
          onChange={(e) => setCohortStart(e.target.value)}
          className="h-9"
        />
        <p className="text-[11px] text-muted-foreground">
          Experience points in this cohort are counted from this date.
        </p>
      </div>
    </div>
    <div className="mt-3 grid gap-4 rounded-md border bg-muted/20 p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
      {/* Logo */}
      <div className="space-y-1.5">
        <Label className="text-xs">Logo</Label>
        <div className="flex items-center gap-2">
          <div
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border bg-background"
            style={{ borderColor: color }}
          >
            {logo ? (
              <img src={logo} alt={`${programName} logo`} className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
          </Button>
          {logo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer text-muted-foreground"
              onClick={() => setLogo("")}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Theme colour */}
      <div className="space-y-1.5">
        <Label className="text-xs">Dashboard theme colour</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#4F46E5"}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            className="h-9 w-10 cursor-pointer rounded-md border bg-background p-1"
            aria-label="Theme colour"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            placeholder="#4F46E5"
            className="h-9 w-28 font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 cursor-pointer"
            disabled={!eyeDropperSupported || eyeDropperOpen}
            onClick={() => void pickColor()}
            aria-label="Pick colour from screen"
            title="Pick colour from screen"
          >
            {eyeDropperOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pipette className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={`Use ${p}`}
                onClick={() => setColor(p)}
                className="h-6 w-6 cursor-pointer rounded-full border border-border transition hover:scale-110"
                style={{ backgroundColor: p }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Label className="text-xs">Dashboard background</Label>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background p-1">

          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setBg(m)}
              className={`cursor-pointer rounded-sm px-3 py-1 text-xs font-medium transition ${
                bg === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {m === "light" ? "White" : "Dark"}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        className="cursor-pointer"
        disabled={!dirty || busy}
        onClick={async () => {
          if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
            toast.error("Use a hex colour like #4F46E5");
            return;
          }
            if (name.trim().length < 2) {
              toast.error("Program name must be at least 2 characters");
              return;
            }
            setBusy(true);
            try {
            await save({
              data: {
                programId,
                name: name.trim(),
                description: description.trim() || null,
                logoUrl: logo ? logo : null,
                themeColor: color ? color : null,
                backgroundMode: bg,
                cohortStartDate: cohortStart || null,
              },
            });
            await onSaved();
            toast.success("Program updated");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to save program");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
      </Button>
    </div>
    </>
  );
}

export default ProgramBrandingEditor;
