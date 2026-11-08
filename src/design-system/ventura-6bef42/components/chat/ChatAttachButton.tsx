import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { CHAT_ATTACHMENT_ACCEPT, validateChatAttachment } from "@/design-system/ventura-6bef42/lib/chat-attachments";

export function ChatAttachButton({
  file,
  onSelect,
  disabled,
}: {
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={CHAT_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null;
          event.target.value = "";
          if (!picked) return;
          const error = validateChatAttachment(picked);
          if (error) {
            toast.error(error);
            return;
          }
          onSelect(picked);
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 shrink-0"
        disabled={disabled}
        aria-label="Attach a file"
        title="Attach a PDF, image or text file"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      {file ? (
        <span className="flex min-w-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
          <span className="max-w-[12rem] truncate">{file.name}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onSelect(null)}
            aria-label="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
    </div>
  );
}

export function ChatFileChip({ filename }: { filename?: string }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-background/40 px-2 py-1 text-xs">
      <Paperclip className="h-3 w-3" />
      {filename || "Attachment"}
    </span>
  );
}
