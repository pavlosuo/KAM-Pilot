import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Loader2, Megaphone, Send, Target, UserRound } from "lucide-react";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { Progress } from "@/design-system/ventura-6bef42/components/ui/progress";
import { AddToCalendarButton } from "@/design-system/ventura-6bef42/components/ui/add-to-calendar-button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ventura-6bef42/components/ui/dialog";
import {
  getFounderProgramPanel,
  reportFounderKpiValue,
  sendMessageToProgram,
} from "@/design-system/ventura-6bef42/lib/program-founder.functions";
import { KPI_STATUS_LABEL, kpiPercent, kpiStatus, kpiStatusClass } from "@/design-system/ventura-6bef42/lib/program-kpi-status";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

type Assignment = {
  id: string;
  current_value: number;
  completed_at: string | null;
  program_kpis: {
    title: string;
    description: string | null;
    target_value: number;
    unit: string | null;
    due_date: string | null;
  } | null;
};

export function ProgramPanel({ startupId }: { startupId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getFounderProgramPanel);
  const report = useServerFn(reportFounderKpiValue);
  const [savingId, setSavingId] = useState<string | null>(null);

  const sendMessage = useServerFn(sendMessageToProgram);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgProgramId, setMsgProgramId] = useState<string | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);

  const queryKey = ["founder-program-panel", startupId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => load({ data: { startupId } }),
  });

  if (isLoading || !data || data.programs.length === 0) return null;

  return (
    <div className="space-y-4">
      {data.programs.map((p) => {
        const kpis = (p.kpis ?? []) as unknown as Assignment[];
        return (
          <Card key={p.id} className="rounded-2xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                {p.logoUrl ? (
                  <img
                    src={p.logoUrl}
                    alt={`${p.name} logo`}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Program workspace</p>
                </div>
                {p.coach ? (
                  <Badge variant="secondary" className="ml-auto gap-1">
                    <UserRound className="h-3 w-3" /> Coach: {p.coach.name}
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto shrink-0 cursor-pointer gap-1.5"
                  onClick={() => {
                    setMsgProgramId(p.id);
                    setMsgBody("");
                    setMsgOpen(true);
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Message program
                </Button>
              </div>

              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-muted-foreground" /> Your KPIs
                </p>
                {kpis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No KPIs assigned yet.</p>
                ) : (
                  kpis.map((a) => {
                    const target = Number(a.program_kpis?.target_value ?? 0);
                    const status = kpiStatus(
                      a.current_value,
                      target,
                      a.program_kpis?.due_date ?? null,
                      a.completed_at,
                    );
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {a.program_kpis?.title ?? "KPI"}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn("text-xs", kpiStatusClass(status))}
                            >
                              {KPI_STATUS_LABEL[status]}
                            </Badge>
                          </div>
                          {a.program_kpis?.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {a.program_kpis.description}
                            </p>
                          ) : null}
                          <Progress
                            value={kpiPercent(a.current_value, target)}
                            className="mt-2 h-1.5"
                          />
                          {a.program_kpis?.due_date ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Due {a.program_kpis.due_date}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            defaultValue={a.current_value}
                            className="h-8 w-24"
                            onBlur={async (e) => {
                              const value = Number(e.target.value);
                              if (Number.isNaN(value) || value === a.current_value) return;
                              setSavingId(a.id);
                              try {
                                await report({ data: { assignmentId: a.id, value } });
                                await qc.invalidateQueries({ queryKey });
                                toast.success("Progress updated");
                              } catch {
                                toast.error("Could not save progress");
                              } finally {
                                setSavingId(null);
                              }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            / {target}
                            {a.program_kpis?.unit ? ` ${a.program_kpis.unit}` : ""}
                          </span>
                          {savingId === a.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {p.announcements.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Megaphone className="h-4 w-4 text-muted-foreground" /> Announcements
                  </p>
                  {p.announcements.slice(0, 5).map((a) => {
                    const row = a as unknown as {
                      id: string;
                      title: string;
                      body: string;
                      published_at: string;
                    };
                    return (
                      <div key={row.id} className="rounded-xl border p-3">
                        <p className="text-sm font-medium">{row.title}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {row.body}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(row.published_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {p.events.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" /> Upcoming
                  </p>
                  {p.events.slice(0, 5).map((e) => {
                    const row = e as unknown as {
                      id: string;
                      title: string;
                      description?: string | null;
                      starts_at: string;
                      location: string | null;
                      url?: string | null;
                    };
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <p className="truncate text-sm font-medium">{row.title}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          <p className="text-xs text-muted-foreground">
                            {new Date(row.starts_at).toLocaleString()}
                            {row.location ? ` · ${row.location}` : ""}
                          </p>
                          <AddToCalendarButton
                            iconOnly
                            uid={row.id}
                            event={{
                              title: row.title,
                              description: row.description ?? null,
                              location: row.location,
                              url: row.url ?? null,
                              startsAt: row.starts_at,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message program</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-background/60 p-3 text-sm text-muted-foreground">
              This message will be sent to the program leads. They can reply through the program
              dashboard.
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                rows={5}
                placeholder="What would you like to share with the program team?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="cursor-pointer"
              disabled={!msgBody.trim() || sending || !msgProgramId}
              onClick={async () => {
                if (!msgProgramId) return;
                setSending(true);
                try {
                  await sendMessage({
                    data: { startupId, programId: msgProgramId, body: msgBody.trim() },
                  });
                  setMsgOpen(false);
                  setMsgBody("");
                  toast.success("Message sent");
                } catch {
                  toast.error("Could not send message");
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

