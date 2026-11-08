import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Switch } from "@/design-system/ventura-6bef42/components/ui/switch";
import {
  listPrograms,
  createProgram,
  rotateProgramPassword,
  setProgramActive,
  deleteProgram,
} from "@/design-system/ventura-6bef42/lib/program-admin.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProgramBrandingEditor } from "./ProgramBrandingEditor";

type Credentials = { slug?: string; loginId: string; password: string };

export function ProgramsSection() {
  const queryClient = useQueryClient();
  const load = useServerFn(listPrograms);
  const create = useServerFn(createProgram);
  const rotate = useServerFn(rotateProgramPassword);
  const setActive = useServerFn(setProgramActive);
  const remove = useServerFn(deleteProgram);

  const queryKey = ["admin-programs"];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => load({}) });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cohortStart, setCohortStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Accelerator programs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="program-name">Program name</Label>
              <Input
                id="program-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ventura Accelerator 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-desc">Description (optional)</Label>
              <Textarea
                id="program-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-cohort-start">Cohort start date (optional)</Label>
              <Input
                id="program-cohort-start"
                type="date"
                value={cohortStart}
                onChange={(e) => setCohortStart(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Experience points for this cohort are counted from this date. Leave empty to count all time.
              </p>
            </div>
          </div>
          <div className="flex items-end">
            <Button
              className="cursor-pointer"
              disabled={busy || name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await create({
                    data: {
                      name: name.trim(),
                      description: description.trim() || null,
                      cohortStartDate: cohortStart || null,
                    },
                  });
                  setCreds(res);
                  setName("");
                  setDescription("");
                  setCohortStart("");
                  await queryClient.invalidateQueries({ queryKey });
                  toast.success("Program created");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to create program");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create program
            </Button>
          </div>
        </div>

        {creds && (
          <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
            <p className="font-medium">Share these credentials with the program lead now.</p>
            <p className="text-muted-foreground">The password is shown only once.</p>
            {creds.slug && (
              <CopyRow label="Dashboard link" value={`${origin}/program/${creds.slug}`} />
            )}
            <CopyRow label="Login ID" value={creds.loginId} />
            <CopyRow label="Password" value={creds.password} />
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setCreds(null)}>
              Done
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading programs…
          </div>
        ) : (data?.programs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No programs yet.</p>
        ) : (
          <div className="space-y-2">
            {data!.programs.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
               <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {p.theme_color && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: p.theme_color }}
                        aria-hidden
                      />
                    )}
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {!p.is_active && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {origin}/program/{p.slug} · login: {p.loginId ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.approvedCount} approved · {p.pendingCount} pending
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={async (v) => {
                      await setActive({ data: { programId: p.id, isActive: v } });
                      await queryClient.invalidateQueries({ queryKey });
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={async () => {
                      const res = await rotate({ data: { programId: p.id } });
                      setCreds({ ...res, slug: p.slug });
                      toast.success("New password generated");
                    }}
                  >
                    New password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-destructive"
                    onClick={async () => {
                      if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
                      await remove({ data: { programId: p.id } });
                      await queryClient.invalidateQueries({ queryKey });
                    }}
                  >
                    Delete
                  </Button>
                </div>
               </div>
                <ProgramBrandingEditor
                  programId={p.id}
                  programName={p.name}
                  programDescription={p.description}
                  logoUrl={p.logo_url}
                  themeColor={p.theme_color}
                  backgroundMode={p.background_mode}
                  cohortStartDate={p.cohort_start_date}
                  onSaved={() => queryClient.invalidateQueries({ queryKey })}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="truncate text-xs">{value}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 cursor-pointer"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
