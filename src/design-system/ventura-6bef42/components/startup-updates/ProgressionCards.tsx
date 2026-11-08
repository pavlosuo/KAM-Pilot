import { useMemo, useRef, useState } from "react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic.mjs";
import { ImagePlus, Loader2, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/design-system/ventura-6bef42/components/ui/popover";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { toast } from "sonner";

export interface ProgressionCard {
  id?: string;
  label: string;
  value: string | null;
  icon_name: string | null;
  image_url?: string | null;
  description?: string | null;
}

interface Props {
  cards: ProgressionCard[];
  editable?: boolean;
  onChange?: (index: number, patch: Partial<ProgressionCard>) => void;
  onDelete?: (index: number) => void;
  onAdd?: () => void;
  badgeVariant?: "default" | "summary";
  columns?: 1 | 2;
  onCardClick?: (card: ProgressionCard) => void;
}

type PickerMode = "menu" | "icons" | "photo";

export function ProgressionCardsGrid({ cards, editable = false, onChange, onDelete, onAdd, badgeVariant = "default", columns = 1, onCardClick }: Props) {
  if (!cards.length && !editable) return null;
  return (
    <div className={cn("grid w-full gap-3", columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
      {cards.map((c, i) => (
        <CardRow
          key={c.id ?? `card-${i}`}
          card={c}
          editable={editable}
          badgeVariant={badgeVariant}
          onChange={(patch) => onChange?.(i, patch)}
          onDelete={onDelete ? () => onDelete(i) : undefined}
          onCardClick={onCardClick ? () => onCardClick(c) : undefined}
        />
      ))}
      {editable && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 p-4 text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add card
        </button>
      )}
    </div>
  );
}


function CardRow({
  card,
  editable,
  onChange,
  onDelete,
  badgeVariant = "default",
  onCardClick,
}: {
  card: ProgressionCard;
  editable: boolean;
  onChange: (patch: Partial<ProgressionCard>) => void;
  onDelete?: () => void;
  badgeVariant?: "default" | "summary";
  onCardClick?: () => void;
}) {
  const hasDescription = !editable && !!(card.description && card.description.trim());
  const rowClass = cn(
    "group relative flex w-full items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left shadow-sm transition-all duration-200",
    editable && "cursor-pointer hover:border-primary/60 hover:shadow-md hover:scale-[1.01]",
    (hasDescription || (!editable && onCardClick)) && "cursor-pointer hover:border-primary/60 hover:shadow-md",
  );

  if (editable) {
    return (
      <Dialog>
        <div className={rowClass}>
          <DialogTrigger asChild>
            <button type="button" className="absolute inset-0 z-0 cursor-pointer rounded-2xl" aria-label="Edit card" />
          </DialogTrigger>
          <div className="pointer-events-none relative z-10">
            <VisualBadge card={card} badgeVariant={badgeVariant} />
          </div>
          <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-1">
            <span className="break-words text-lg font-semibold leading-tight text-foreground">
              {card.value || "Value"}
            </span>
            <span className="break-words text-sm text-muted-foreground">{card.label || "Label"}</span>
          </div>
          <span className="pointer-events-none relative z-10 shrink-0 text-muted-foreground/60 transition group-hover:text-muted-foreground">
            <Pencil className="h-4 w-4" />
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete card"
              className="relative z-10 shrink-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3">
            <IconEditor card={card} onChange={onChange} badgeVariant={badgeVariant} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Input
                value={card.value ?? ""}
                onChange={(e) => onChange({ value: e.target.value })}
                className="text-lg font-semibold"
                placeholder="Value"
              />
              <Input
                value={card.label}
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="Label"
              />
              <Textarea
                value={card.description ?? ""}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Short explanation shown when a visitor clicks this card (2-3 sentences)"
                className="min-h-[90px] resize-none text-sm"
              />
            </div>
          </div>
          <DialogClose asChild>
            <Button className="mt-2 self-end">Done</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    );
  }



  const inner = (
    <>
      {editable ? (
        <IconEditor card={card} onChange={onChange} badgeVariant={badgeVariant} />
      ) : card.image_url && !hasDescription ? (
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="cursor-pointer outline-none" onClick={(e) => e.stopPropagation()}>
              <VisualBadge card={card} badgeVariant={badgeVariant} />
            </button>
          </DialogTrigger>
        <DialogContent className="w-fit max-w-[95vw] border-0 bg-transparent p-0 shadow-none [&>button]:hidden justify-items-center">
          <div className="relative">
            <img
              src={card.image_url}
              alt={card.label}
              className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
            />
            <DialogClose className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white opacity-80 transition hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogContent>
        </Dialog>
      ) : (
        <VisualBadge card={card} badgeVariant={badgeVariant} />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editable ? (
          <>
            <div className="group/field relative -mx-1 -my-0.5 cursor-pointer rounded-md px-1 py-0.5 transition-all duration-200 hover:bg-muted/60 hover:ring-1 hover:ring-border">
              <Input
                value={card.value ?? ""}
                onChange={(e) => onChange({ value: e.target.value })}
                className="h-8 cursor-pointer border-0 bg-transparent p-0 pr-6 text-lg font-semibold leading-tight text-foreground shadow-none focus-visible:ring-0"
                placeholder="Value"
              />
              <Pencil className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/0 transition-all duration-200 group-hover/field:scale-110 group-hover/field:text-muted-foreground" />
            </div>
            <div className="group/field relative -mx-1 -my-0.5 cursor-pointer rounded-md px-1 py-0.5 transition-all duration-200 hover:bg-muted/60 hover:ring-1 hover:ring-border">
              <Input
                value={card.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="h-7 cursor-pointer border-0 bg-transparent p-0 pr-6 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
                placeholder="Label"
              />
              <Pencil className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/0 transition-all duration-200 group-hover/field:scale-110 group-hover/field:text-muted-foreground" />
            </div>
            <div className="group/field relative -mx-1 mt-1 cursor-pointer rounded-md px-1 py-0.5 transition-all duration-200 hover:bg-muted/60 hover:ring-1 hover:ring-border">
              <Textarea
                value={card.description ?? ""}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Short explanation shown when a visitor clicks this card (2-3 sentences)"
                className="min-h-[56px] cursor-pointer resize-none border-0 bg-transparent py-0 pl-0 pr-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
              />
            </div>
          </>
        ) : (
          <>
            <span className="break-words text-lg font-semibold leading-tight text-foreground">
              {card.value}
            </span>
            <span className="break-words text-sm text-muted-foreground">{card.label}</span>
          </>
        )}
      </div>
      {editable && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete card"
          className="shrink-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );

  if (!editable && onCardClick) {
    return (
      <button type="button" className={rowClass} onClick={onCardClick}>
        {inner}
      </button>
    );
  }

  if (hasDescription) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className={rowClass}>
            {inner}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <VisualBadge card={card} badgeVariant={badgeVariant} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-lg font-semibold text-foreground">{card.value}</span>
                <span className="truncate text-sm font-normal text-muted-foreground">{card.label}</span>
              </span>
            </DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {card.description}
          </p>
        </DialogContent>
      </Dialog>
    );
  }



  return <div className={rowClass}>{inner}</div>;
}

function VisualBadge({ card, badgeVariant = "default" }: { card: ProgressionCard; badgeVariant?: "default" | "summary" }) {
  if (card.image_url) {
    const imageClass =
      badgeVariant === "summary"
        ? "h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted"
        : "h-9 w-9 shrink-0 overflow-hidden rounded-xl border bg-muted";
    return (
      <div className={imageClass}>
        <img src={card.image_url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  const badgeClass =
    badgeVariant === "summary"
      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded bg-black text-white"
      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground";
  return (
    <div className={badgeClass}>
      <DynamicIcon
        name={(card.icon_name ?? "circle") as IconName}
        size={18}
        fallback={() => <DynamicIcon name="circle" size={18} />}
      />
    </div>
  );
}

function IconEditor({
  card,
  onChange,
  badgeVariant = "default",
}: {
  card: ProgressionCard;
  onChange: (patch: Partial<ProgressionCard>) => void;
  badgeVariant?: "default" | "summary";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>("menu");

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMode("menu");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/icon relative shrink-0 cursor-pointer rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Change icon or image"
          title="Click to change"
        >
          <VisualBadge card={card} badgeVariant={badgeVariant} />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 opacity-0 transition group-hover/icon:bg-black/45 group-hover/icon:opacity-100">
            <Pencil className="h-4 w-4 text-white" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        {mode === "menu" && (
          <div className="flex flex-col gap-2">
            <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">
              Change visual
            </div>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setMode("icons")}
            >
              <Pencil className="h-4 w-4" /> Put another icon
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setMode("photo")}
            >
              <ImagePlus className="h-4 w-4" /> Upload a photo
            </Button>
          </div>
        )}
        {mode === "icons" && (
          <IconPicker
            current={card.icon_name}
            onPick={(name) => {
              onChange({ icon_name: name, image_url: null });
              setOpen(false);
            }}
            onBack={() => setMode("menu")}
          />
        )}
        {mode === "photo" && (
          <PhotoUploader
            currentUrl={card.image_url ?? null}
            onUploaded={(url) => {
              onChange({ image_url: url });
              setOpen(false);
            }}
            onRemove={() => {
              onChange({ image_url: null });
              setOpen(false);
            }}
            onBack={() => setMode("menu")}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function IconPicker({
  current,
  onPick,
  onBack,
}: {
  current: string | null;
  onPick: (name: string) => void;
  onBack: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? (iconNames as string[]).filter((n) => n.includes(term))
      : (iconNames as string[]);
    return list.slice(0, 300);
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search icons…"
          className="h-8"
        />
      </div>
      <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto pr-1">
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onPick(name)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-foreground hover:border-border hover:bg-muted",
              current === name && "border-primary bg-primary/10",
            )}
          >
            <DynamicIcon name={name as IconName} size={18} />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-6 py-6 text-center text-xs text-muted-foreground">
            No icons match
          </div>
        )}
      </div>
      {q.trim() === "" && (
        <div className="text-[10px] text-muted-foreground">
          Showing first 300 of {iconNames.length}. Type to search all.
        </div>
      )}
    </div>
  );
}

function PhotoUploader({
  currentUrl,
  onUploaded,
  onRemove,
  onBack,
}: {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/progression-cards/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("startup-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("startup-logos").getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) upload(f);
        }}
        disabled={uploading}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/[0.03]",
          uploading && "opacity-70",
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
        )}
        <div className="text-sm font-medium">
          {uploading ? "Uploading…" : "Drop or click to upload"}
        </div>
        <div className="text-[11px] text-muted-foreground">PNG, JPG, SVG · up to a few MB</div>
      </button>
      {currentUrl && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center gap-1 self-start text-xs text-destructive hover:underline"
        >
          <X className="h-3 w-3" /> Remove current photo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
    </div>
  );
}
