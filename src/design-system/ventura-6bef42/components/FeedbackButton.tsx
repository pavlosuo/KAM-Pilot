import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bug, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/design-system/ventura-6bef42/components/ui/radio-group";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { toast } from "sonner";

const MAX_FILES = 3;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB combined
const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

type Attachment = { file: File; previewUrl: string };

interface FeedbackButtonProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function FeedbackButton({ open: openProp, onOpenChange, showTrigger = true }: FeedbackButtonProps = {}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    setMessage("");
    setType("bug");
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (incoming.length !== files.length) {
      toast.error("Only image files are allowed.");
    }
    const slotsLeft = MAX_FILES - attachments.length;
    if (slotsLeft <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} screenshots.`);
      return;
    }
    const accepted = incoming.slice(0, slotsLeft);
    const currentBytes = attachments.reduce((sum, a) => sum + a.file.size, 0);
    let runningBytes = currentBytes;
    const finalAccepted: File[] = [];
    for (const f of accepted) {
      if (runningBytes + f.size > MAX_TOTAL_BYTES) {
        toast.error("Combined screenshot size must stay under 5 MB.");
        break;
      }
      runningBytes += f.size;
      finalAccepted.push(f);
    }
    if (finalAccepted.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...finalAccepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error("Please describe your report in a bit more detail.");
      return;
    }
    if (trimmed.length > 4000) {
      toast.error("Please keep your report under 4000 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const uploadedPaths: string[] = [];
      if (attachments.length > 0) {
        if (!user?.id) {
          toast.error("Please sign in to attach screenshots.");
          setSubmitting(false);
          return;
        }
        const folder = `${user.id}/${crypto.randomUUID()}`;
        for (let i = 0; i < attachments.length; i++) {
          const { file } = attachments[i];
          const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
          const path = `${folder}/${i}-${Date.now()}.${ext || "png"}`;
          const { error: upErr } = await supabase.storage
            .from("feedback-screenshots")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;
          uploadedPaths.push(path);
        }
      }

      const { error } = await supabase.from("feedback_reports").insert({
        type,
        message: trimmed,
        page_url: typeof window !== "undefined" ? window.location.href : null,
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        screenshot_paths: uploadedPaths,
      });
      if (error) throw error;
      toast.success("Thanks! Your report has been submitted.");
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalBytes = attachments.reduce((sum, a) => sum + a.file.size, 0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const triggerButton = showTrigger ? (
    <button
      type="button"
      data-particles="true"
      onClick={() => setOpen(true)}
      aria-label="Report a bug or request a feature"
      style={{ position: "fixed", bottom: "1.25rem", right: "1.25rem", zIndex: 50 }}
      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Bug className="h-5 w-5" />
    </button>
  ) : null;

  return (
    <>
      {mounted && triggerButton ? createPortal(triggerButton, document.body) : null}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Found a bug or have an idea? Let us know — we read every report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as "bug" | "feature")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="bug" id="fb-bug" />
                  <Label htmlFor="fb-bug" className="font-normal">Bug report</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="feature" id="fb-feature" />
                  <Label htmlFor="fb-feature" className="font-normal">Feature request</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-message">Description</Label>
              <Textarea
                id="fb-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "What went wrong? What did you expect to happen?"
                    : "What would you like to see? How would it help you?"
                }
                rows={6}
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground">{message.length}/4000</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Screenshots (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  {attachments.length}/{MAX_FILES} · {(totalBytes / (1024 * 1024)).toFixed(1)} / 5 MB
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, idx) => (
                    <div
                      key={a.previewUrl}
                      className="group relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted"
                    >
                      <img
                        src={a.previewUrl}
                        alt={`Screenshot ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 focus:opacity-100"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_FILES || submitting}
                className="gap-2"
              >
                <ImagePlus className="h-4 w-4" />
                Attach screenshot
              </Button>
              <p className="text-xs text-muted-foreground">
                Up to 3 images, 5 MB total. PNG, JPG, WEBP or GIF.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
