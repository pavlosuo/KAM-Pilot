import * as React from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface ExpandableImageProps {
  src: string;
  alt?: string;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Wraps a trigger (image or any element) so clicking opens a fullscreen
 * popup showing the expanded image. If `children` is provided it is used
 * as the trigger; otherwise an <img> with `src`/`alt` is rendered.
 */
export function ExpandableImage({ src, alt, title, className, children }: ExpandableImageProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("cursor-zoom-in p-0 border-0 bg-transparent", className)}
        aria-label={alt ? `Expand ${alt}` : "Expand image"}
      >
        {children ?? <img src={src} alt={alt ?? ""} />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-fit max-w-[95vw] justify-items-center border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">{title ?? alt ?? "Image"}</DialogTitle>
          <div className="relative">
            <img
              src={src}
              alt={alt ?? ""}
              className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
              style={{ minHeight: "min(300px, 60vh)" }}
            />
            <DialogClose className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white opacity-80 transition hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
