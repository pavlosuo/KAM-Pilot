import { CalendarPlus, Download } from "lucide-react";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dropdown-menu";
import {
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/design-system/ventura-6bef42/lib/calendar-links";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export function AddToCalendarButton({
  event,
  uid,
  className,
  iconOnly = false,
}: {
  event: CalendarEvent;
  uid?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          className={cn("shrink-0 cursor-pointer", className)}
          aria-label="Add to calendar"
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarPlus className={cn("h-4 w-4", !iconOnly && "mr-2")} />
          {iconOnly ? null : "Add to calendar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => window.open(googleCalendarUrl(event), "_blank", "noopener")}
        >
          <CalendarPlus className="mr-2 h-4 w-4" /> Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => window.open(outlookCalendarUrl(event), "_blank", "noopener")}
        >
          <CalendarPlus className="mr-2 h-4 w-4" /> Outlook
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => downloadIcs(event, uid)}>
          <Download className="mr-2 h-4 w-4" /> Apple / .ics file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
