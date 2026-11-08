import { useId, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";

type ShareProfileDialogProps = {
  handle: string;
  name: string;
  profileType: "mentor" | "investor";
};

export function ShareProfileDialog({ handle, name, profileType }: ShareProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const qrId = useId().replace(/:/g, "");
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/${profileType}/${handle}`
      : `https://venturafund.eu/${profileType}/${handle}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const downloadQr = () => {
    const canvas = document.getElementById(qrId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${handle}-profile-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-full text-xs">
          <Share2 className="h-3.5 w-3.5" /> Share profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {name}</DialogTitle>
          <DialogDescription>Copy the public profile link or download its QR code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Copy a link</label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">QR code</label>
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5">
              <QRCodeCanvas id={qrId} value={url} size={200} level="M" includeMargin />
              <Button type="button" variant="outline" size="sm" onClick={downloadQr} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download PNG
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}