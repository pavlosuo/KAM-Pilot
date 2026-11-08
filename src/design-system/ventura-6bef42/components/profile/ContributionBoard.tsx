import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/design-system/ventura-6bef42/components/ui/tooltip";

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of the current ISO week determines the year.
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ContributionBoard({ weeks }: { weeks: string[] }) {
  const cells = useMemo(() => {
    const active = new Set(
      weeks
        .map((w) => new Date(`${w}T00:00:00Z`))
        .filter((d) => !Number.isNaN(d.getTime()))
        .map((d) => isoWeekKey(d)),
    );
    const today = new Date();
    const out: Array<{ key: string; label: string; on: boolean; monthStart: boolean }> = [];
    let lastMonth = -1;
    for (let i = 51; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      d.setUTCDate(d.getUTCDate() - i * 7);
      const m = d.getUTCMonth();
      const monthStart = m !== lastMonth;
      lastMonth = m;
      out.push({
        key: isoWeekKey(d) + "-" + i,
        label: `Week of ${MONTH[m]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
        on: active.has(isoWeekKey(d)),
        monthStart,
      });
    }
    return out;
  }, [weeks]);

  const total = cells.filter((c) => c.on).length;

  return (
    <div>
      <TooltipProvider delayDuration={80}>
        <div className="grid w-fit grid-cols-8 gap-1.5 mx-auto">
          {cells.map((c) => (
            <Tooltip key={c.key}>
              <TooltipTrigger asChild>
                <div
                  className={`h-5 w-5 rounded-[3px] border transition-colors cursor-pointer ${
                    c.on
                      ? "border-emerald-500/60 bg-emerald-500"
                      : "border-border bg-muted"
                  }`}
                  aria-label={`${c.label}: ${c.on ? "update published" : "no update"}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-xs">
                  {c.on ? "Weekly update published" : "No weekly update"} · {c.label}
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      <div className="mt-3 text-center text-xs text-muted-foreground">
        {total} active {total === 1 ? "week" : "weeks"} in the last 52 weeks
      </div>
    </div>
  );
}
