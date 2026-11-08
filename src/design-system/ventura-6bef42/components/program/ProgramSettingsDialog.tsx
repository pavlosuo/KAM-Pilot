import { getProgramAiCredits } from "@/design-system/ventura-6bef42/lib/ai-credits.functions";
import { AiCreditsMeter } from "@/design-system/ventura-6bef42/components/AiCreditsMeter";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pipette, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system/ventura-6bef42/components/ui/tabs";
import {
  getProgramSettings,
  updateProgramCredentials,
  updateProgramSelfBranding,
  uploadProgramLogo,
} from "@/design-system/ventura-6bef42/lib/program-settings.functions";

const PRESETS = ["#0F172A", "#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#7C3AED"];

type Props = {
  slug: string;
  programName: string;
  onSaved: () => void | Promise<unknown>;
  triggerClassName?: string;
};

export function ProgramSettingsDialog({ slug, programName, onSaved, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const load = useServerFn(getProgramSettings);
  const saveBranding = useServerFn(updateProgramSelfBranding);
  const saveCreds = useServerFn(updateProgramCredentials);
  const upload = useServerFn(uploadProgramLogo);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["program-settings", slug],
    queryFn: () => load({ data: { slug } }),
    enabled: open,
    staleTime: 0,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("cursor-pointer", triggerClassName)}
          aria-label="Dashboard settings"
          title="Dashboard settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dashboard settings</DialogTitle>
          <DialogDescription>Manage sign-in details and branding for {programName}.</DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="branding">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="branding" className="cursor-pointer">
                Branding
              </TabsTrigger>
              <TabsTrigger value="account" className="cursor-pointer">
                Login &amp; password
              </TabsTrigger>
              <TabsTrigger value="ai" className="cursor-pointer">
                AI credits
              </TabsTrigger>
            </TabsList>

            <TabsContent value="branding" className="pt-4">
              <BrandingTab
                key={`${data.logoUrl}-${data.themeColor}-${data.backgroundMode}`}
                slug={slug}
                programName={programName}
                initialLogo={data.logoUrl}
                initialColor={data.themeColor}
                initialBackground={data.backgroundMode}
                upload={upload}
                save={saveBranding}
                onSaved={async () => {
                  await refetch();
                  await onSaved();
                }}
              />
            </TabsContent>

            <TabsContent value="account" className="pt-4">
              <AccountTab
                slug={slug}
                initialLoginId={data.loginId}
                save={saveCreds}
                onSaved={async () => {
                  await refetch();
                }}
              />
            </TabsContent>
            <TabsContent value="ai" className="pt-4">
              <ProgramAiCredits slug={slug} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BrandingTab({
  slug,
  programName,
  initialLogo,
  initialColor,
  initialBackground,
  upload,
  save,
  onSaved,
}: {
  slug: string;
  programName: string;
  initialLogo: string | null;
  initialColor: string | null;
  initialBackground: "light" | "dark";
  upload: (args: { data: { slug: string; base64: string; contentType: string; ext: string } }) => Promise<{ url: string }>;
  save: (args: {
    data: {
      slug: string;
      logoUrl: string | null;
      themeColor: string | null;
      backgroundMode?: "light" | "dark";
    };
  }) => Promise<{ ok: true }>;
  onSaved: () => void | Promise<unknown>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(initialLogo ?? "");
  const [color, setColor] = useState(initialColor ?? "#4F46E5");
  const [bg, setBg] = useState<"light" | "dark">(initialBackground);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const eyeDropperSupported = typeof window !== "undefined" && "EyeDropper" in window;

  const dirty =
    (initialLogo ?? "") !== logo || (initialColor ?? "") !== color || initialBackground !== bg;

  async function pickColor() {
    if (!eyeDropperSupported) {
      toast.error("Your browser does not support the colour pipette.");
      return;
    }
    setPicking(true);
    try {
      const ed = new (window as unknown as {
        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
      }).EyeDropper();
      const res = await ed.open();
      setColor(res.sRGBHex.toUpperCase());
    } catch {
      // cancelled
    } finally {
      setPicking(false);
    }
  }

  async function onUpload(file: File) {
    if (file.size > 2_500_000) {
      toast.error("Logo must be smaller than 2.5 MB");
      return;
    }
    setUploading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (const b of buf) bin += String.fromCharCode(b);
      const res = await upload({
        data: {
          slug,
          base64: btoa(bin),
          contentType: file.type || "image/png",
          ext: file.name.split(".").pop() ?? "png",
        },
      });
      setLogo(res.url);
      toast.success("Logo uploaded — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs">Logo</Label>
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border bg-background"
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

      <div className="space-y-2">
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
            disabled={!eyeDropperSupported || picking}
            onClick={() => void pickColor()}
            aria-label="Pick colour from screen"
            title="Pick colour from screen"
          >
            {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pipette className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1 pt-1">
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

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Label className="text-xs">Dashboard background</Label>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border bg-background p-1">

          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setBg(m)}
              className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition ${
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
        className="w-full cursor-pointer"
        disabled={!dirty || busy}
        onClick={async () => {
          if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
            toast.error("Use a hex colour like #4F46E5");
            return;
          }
          setBusy(true);
          try {
            await save({
              data: {
                slug,
                logoUrl: logo ? logo : null,
                themeColor: color ? color : null,
                backgroundMode: bg,
              },
            });
            await onSaved();
            toast.success("Branding saved");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to save branding");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save branding"}
      </Button>
    </div>
  );
}

function AccountTab({
  slug,
  initialLoginId,
  save,
  onSaved,
}: {
  slug: string;
  initialLoginId: string;
  save: (args: {
    data: { slug: string; currentPassword: string; loginId?: string; newPassword?: string };
  }) => Promise<{ ok: boolean; reason?: string }>;
  onSaved: () => void | Promise<unknown>;
}) {
  const [loginId, setLoginId] = useState(initialLoginId);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword && newPassword !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const changedLogin = loginId.trim() && loginId.trim() !== initialLoginId;
    if (!changedLogin && !newPassword) {
      toast.error("Nothing to update");
      return;
    }
    setBusy(true);
    try {
      const res = await save({
        data: {
          slug,
          currentPassword,
          ...(changedLogin ? { loginId: loginId.trim() } : {}),
          ...(newPassword ? { newPassword } : {}),
        },
      });
      if (!res.ok) {
        toast.error(
          res.reason === "login_taken" ? "That login ID is already taken" : "Current password is incorrect",
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      await onSaved();
      toast.success("Sign-in details updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="settings-login">Login ID</Label>
        <Input
          id="settings-login"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-current">Current password</Label>
        <Input
          id="settings-current"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-new">New password</Label>
          <Input
            id="settings-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Leave blank to keep"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-confirm">Confirm new password</Label>
          <Input
            id="settings-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>
      <Button type="submit" className="w-full cursor-pointer" disabled={busy || !currentPassword}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
      </Button>
    </form>
  );
}

function ProgramAiCredits({ slug }: { slug: string }) {
  const load = useServerFn(getProgramAiCredits);
  const { data, isLoading } = useQuery({ queryKey: ["program-ai-credits", slug], queryFn: () => load({ data: { slug } }) });
  if (isLoading || !data) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <AiCreditsMeter pools={data} />;
}

export default ProgramSettingsDialog;
