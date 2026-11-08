import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Linkedin, Loader2, Briefcase, GraduationCap, Check, Info, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  importFromLinkedIn,
  type LinkedInImportResult,
  type ImportedExperience,
  type ImportedEducation,
} from "@/design-system/ventura-6bef42/lib/linkedin-import.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (result: LinkedInImportResult) => Promise<void> | void;
};

type Category = "experience" | "education";

function expToEdu(x: ImportedExperience): ImportedEducation {
  return {
    school: x.company || x.title || "(unnamed)",
    start_date: x.start_date,
    end_date: x.end_date,
    is_current: x.is_current,
    description: x.description,
  };
}

function eduToExp(e: ImportedEducation): ImportedExperience {
  return {
    title: "Student",
    company: e.school || "(unnamed)",
    start_date: e.start_date,
    end_date: e.end_date,
    is_current: e.is_current,
    description: e.description,
    location: "",
  };
}

export function LinkedInImportDialog({ open, onOpenChange, onImport }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkedInImportResult | null>(null);
  const [experiences, setExperiences] = useState<ImportedExperience[]>([]);
  const [educations, setEducations] = useState<ImportedEducation[]>([]);
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState<Category | null>(null);

  useEffect(() => {
    if (result) {
      setExperiences(result.experiences);
      setEducations(result.educations);
    }
  }, [result]);

  const reset = () => {
    setUrl("");
    setResult(null);
    setExperiences([]);
    setEducations([]);
    setLoading(false);
    setAdding(false);
    setDragOver(null);
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      toast.error("Please paste your LinkedIn profile URL.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await importFromLinkedIn({ data: { linkedinUrl: url.trim() } });
      setResult(res);
      if (res.experiences.length === 0 && res.educations.length === 0) {
        toast.info("We couldn't find any relevant startup entries on that profile.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import from LinkedIn.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onImport({ experiences, educations, skipped: [] });
      toast.success("Imported from LinkedIn.");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entries.");
    } finally {
      setAdding(false);
    }
  };

  const onDragStart = (from: Category, index: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ from, index }));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropTo = (to: Category) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const { from, index } = JSON.parse(e.dataTransfer.getData("text/plain")) as {
        from: Category;
        index: number;
      };
      if (from === to) return;
      if (from === "experience") {
        const item = experiences[index];
        if (!item) return;
        setExperiences((arr) => arr.filter((_, i) => i !== index));
        setEducations((arr) => [...arr, expToEdu(item)]);
      } else {
        const item = educations[index];
        if (!item) return;
        setEducations((arr) => arr.filter((_, i) => i !== index));
        setExperiences((arr) => [...arr, eduToExp(item)]);
      }
    } catch {
      /* ignore */
    }
  };

  const onDragOver = (cat: Category) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== cat) setDragOver(cat);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5" /> Import from LinkedIn
          </DialogTitle>
          <DialogDescription>
            Paste your LinkedIn profile URL. Please review each entry yourself to confirm it belongs in the right category.
            Note: LinkedIn data comes from a third-party snapshot and may be slightly out of date - if your most recent roles are missing, add them manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="li-url">LinkedIn URL</Label>
          <div className="flex gap-2">
            <Input
              id="li-url"
              placeholder="https://www.linkedin.com/in/your-handle"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading || adding}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && !result) {
                  e.preventDefault();
                  void handleFetch();
                }
              }}
            />
            <Button onClick={handleFetch} disabled={loading || adding || !url.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
            </Button>
          </div>
        </div>

        {result && (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto rounded-lg border p-3">
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Drag entries between categories to move them, or click the cross to remove.
              </span>
            </div>

            <Section
              icon={<Briefcase className="h-4 w-4" />}
              title="Startup experience"
              count={experiences.length}
              emptyText="No entries assigned here."
              isDragOver={dragOver === "experience"}
              onDragOver={onDragOver("experience")}
              onDragLeave={() => setDragOver(null)}
              onDrop={onDropTo("experience")}
            >
              {experiences.map((x, i) => (
                <Row
                  key={`exp-${i}`}
                  label={`${x.title}${x.company ? ` · ${x.company}` : ""}`}
                  onDragStart={onDragStart("experience", i)}
                  onRemove={() => setExperiences((arr) => arr.filter((_, j) => j !== i))}
                />
              ))}
            </Section>

            <Section
              icon={<GraduationCap className="h-4 w-4" />}
              title="Startup education"
              count={educations.length}
              emptyText="No entries assigned here."
              isDragOver={dragOver === "education"}
              onDragOver={onDragOver("education")}
              onDragLeave={() => setDragOver(null)}
              onDrop={onDropTo("education")}
            >
              {educations.map((e, i) => (
                <Row
                  key={`edu-${i}`}
                  label={e.school}
                  onDragStart={onDragStart("education", i)}
                  onRemove={() => setEducations((arr) => arr.filter((_, j) => j !== i))}
                />
              ))}
            </Section>
          </div>
        )}


        <DialogFooter className="flex-col-reverse sm:flex-row items-center justify-center sm:justify-center">
          {result && (experiences.length > 0 || educations.length > 0) && (
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" /> Add to my profile
                </>
              )}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading || adding}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  count,
  emptyText,
  children,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        {icon} {title}{" "}
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-md transition-colors ${
          isDragOver ? "bg-accent/40 ring-2 ring-primary/40" : ""
        } ${count === 0 ? "border border-dashed p-3" : "space-y-1 p-1"}`}
      >
        {count === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function toTitleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function Row({
  label,
  onDragStart,
  onRemove,
}: {
  label: string;
  onDragStart: (e: React.DragEvent) => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group flex items-center gap-2 rounded border bg-background px-2 py-1 text-sm cursor-move hover:bg-accent/30"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate">{toTitleCase(label || "(unnamed)")}</span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 hover:text-destructive transition"
        aria-label="Remove entry"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
