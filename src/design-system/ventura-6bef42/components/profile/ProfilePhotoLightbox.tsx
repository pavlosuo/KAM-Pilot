"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ventura-6bef42/components/ui/avatar";
import { X } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface ProfilePhotoLightboxProps {
  photoUrl?: string | null;
  name: string;
  initials: string;
  avatarClassName?: string;
  fallbackClassName?: string;
}

export function ProfilePhotoLightbox({
  photoUrl,
  name,
  initials,
  avatarClassName,
  fallbackClassName,
}: ProfilePhotoLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative cursor-zoom-in rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            avatarClassName,
          )}
          aria-label={`Enlarge photo of ${name}`}
        >
          <Avatar className={cn("h-full w-full", avatarClassName)}>
            {photoUrl && <AvatarImage src={photoUrl} alt={name} className="object-cover" />}
            <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="!w-fit max-w-[90vw] justify-items-center border-none bg-transparent p-0 shadow-none sm:!w-fit sm:max-w-[80vw]"
      >
        <div className="relative w-fit max-w-full">
          <DialogClose className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg ring-1 ring-border/50 backdrop-blur transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl bg-muted shadow-2xl"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-muted text-4xl font-semibold text-muted-foreground">
              {initials}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
