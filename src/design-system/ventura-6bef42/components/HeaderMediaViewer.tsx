import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Expand } from "lucide-react";

export function isVideoMediaUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(url);
}

interface HeaderMediaViewerProps {
  src: string;
  alt?: string;
  /** When true, the whole hero area is clickable (use for images, not videos with controls) */
  overlayClickable?: boolean;
}

/**
 * Overlay for a profile/startup hero cover that lets the visitor "inspect"
 * the header image or video in a fullscreen popup.
 */
export function HeaderMediaViewer({ src, alt, overlayClickable = true }: HeaderMediaViewerProps) {
  const [open, setOpen] = React.useState(false);
  const isVideo = isVideoMediaUrl(src);

  return (
    <>
      {overlayClickable && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={alt ? `Expand ${alt}` : "Expand header media"}
          className="absolute inset-0 z-[5] cursor-zoom-in bg-transparent"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `Expand ${alt}` : "Expand header media"}
        className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border backdrop-blur-md transition hover:bg-background cursor-pointer"
      >
        <Expand className="h-3.5 w-3.5" />
        {isVideo ? "Play" : "View"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[90vw] max-w-4xl rounded-2xl bg-background p-2">
          <DialogTitle className="sr-only">{alt ?? "Header media"}</DialogTitle>
          <div className="flex h-full w-full items-center justify-center">
            {isVideo ? (
              <video
                src={src}
                className="max-h-[80vh] w-full rounded-xl bg-black"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={src}
                alt={alt ?? ""}
                className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
