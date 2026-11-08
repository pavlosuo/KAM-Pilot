import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Textarea } from "@/design-system/ventura-6bef42/components/ui/textarea";
import { sendStartupFounderMessage, type RoleHomeRole, type StartupMatch } from "@/design-system/ventura-6bef42/lib/role-home.functions";

export function MessageFounderDialog({ role, startup, open, onOpenChange }: { role: RoleHomeRole; startup: StartupMatch | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const send = useServerFn(sendStartupFounderMessage);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => { if (startup && open) setBody(`Hi, I came across ${startup.name} on Ventura and would enjoy learning more about what you're building.`); }, [startup, open]);
  const submit = async () => {
    if (!startup || !body.trim()) return;
    setSending(true);
    try { await send({ data: { role, startupId: startup.startupId, body: body.trim() } }); toast.success("Message sent to the founder"); onOpenChange(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not send the message"); }
    finally { setSending(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Message {startup?.name ?? "the founder"}</DialogTitle></DialogHeader><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} className="resize-none bg-background" /><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={sending || !body.trim()} onClick={() => void submit()}><Send className="mr-2 h-4 w-4" />{sending ? "Sending…" : "Send message"}</Button></DialogFooter></DialogContent></Dialog>;
}
