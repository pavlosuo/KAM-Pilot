import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import { DatePicker } from "@/design-system/ventura-6bef42/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { listPostponeRequests, reviewPostponeRequest } from "@/design-system/ventura-6bef42/lib/program-kpis.functions";

type Req = {
  id: string;
  startupName: string;
  challengeTitle: string;
  dueDate: string | null;
  reason: string | null;
  requestedAt: string | null;
};

/** Founder requests to extend expired challenges; lead approves with a new deadline or declines. */
export function PostponeRequestsReview({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const load = useServerFn(listPostponeRequests);
  const review = useServerFn(reviewPostponeRequest);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approving, setApproving] = useState<Req | null>(null);
  const [date, setDate] = useState("");

  const { data } = useQuery({
    queryKey: ["program-postpone-requests", slug],
    queryFn: () => load({ data: { slug } }),
  });
  const requests = (data?.requests ?? []) as Req[];

  const decide = async (r: Req, decision: "approved" | "declined", newDueDate?: string) => {
    setBusyId(r.id);
    try {
      await review({ data: { slug, assignmentId: r.id, decision, newDueDate: newDueDate ?? null } });
      toast.success(decision === "approved" ? `New deadline set: ${newDueDate}` : "Request declined");
      void qc.invalidateQueries({ queryKey: ["program-postpone-requests", slug] });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the decision");
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <Card className="rounded-2xl border-amber-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Postpone requests
          <Badge variant="outline" className="ml-1 rounded-full text-xs">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-3 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {r.startupName} · {r.challengeTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.dueDate ? `Deadline was ${r.dueDate}` : "No deadline"}
                {r.requestedAt ? ` · requested ${new Date(r.requestedAt).toLocaleDateString()}` : ""}
              </p>
              {r.reason ? <p className="mt-1 text-xs text-muted-foreground">“{r.reason}”</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="cursor-pointer rounded-full" disabled={busyId === r.id} onClick={() => void decide(r, "declined")}>
                Decline
              </Button>
              <Button size="sm" className="cursor-pointer rounded-full" disabled={busyId === r.id} onClick={() => { setDate(""); setApproving(r); }}>
                Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
      <Dialog open={!!approving} onOpenChange={(v) => (!v ? setApproving(null) : undefined)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New deadline for “{approving?.challengeTitle}”</DialogTitle>
          </DialogHeader>
          <DatePicker value={date} onChange={setDate} disablePast />
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setApproving(null)}>Cancel</Button>
            <Button
              className="rounded-full"
              disabled={!date || !approving || busyId === approving?.id}
              onClick={async () => {
                if (!approving || !date) return;
                await decide(approving, "approved", date);
                setApproving(null);
              }}
            >
              Approve postpone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
