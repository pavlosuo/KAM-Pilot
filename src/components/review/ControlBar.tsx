import { CalendarRange, Check, ChevronDown, Scale, UserPlus, UserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/design-system/ventura-6bef42/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system/ventura-6bef42/components/ui/select";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { SCENARIOS, type Scenario } from "@/lib/engine/assumptions";
import { fmtMonth } from "@/lib/engine/format";
import { useAccount } from "@/lib/state/account-context";
import { audienceLabel, avatarLocation } from "@/lib/engine/avatars";
import { usePeople } from "@/components/people/PeopleProvider";
import { AvatarBadge } from "./AvatarBadge";

const SCENARIO_LABEL: Record<Scenario, string> = { low: "Low", base: "Base", high: "High" };

/** Review-wide controls: period, comparison baseline, sensitivity, scope and stakeholder lens. */
export function AvatarSelector() {
  const { update, avatars, avatar, slug, customer, neutral } = useAccount();
  const people = usePeople();
  const applyAvatar = (id: string, country: string | null | undefined) => update({ avatarId: id, countries: country ? [country] : [], pickedObservationIds: null });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-0 max-w-full" data-tour="avatar-switch" aria-label="Change report role">
            <AvatarBadge avatar={avatar} size="sm" />
            <span className="min-w-0 truncate">{neutral ? "Choose a person" : `For ${audienceLabel(avatar)} · ${avatarLocation(avatar)}`}</span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Reports at {customer.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {avatars.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => applyAvatar(a.id, a.country)} className="gap-2">
              <AvatarBadge avatar={a} size="sm" />
              <span className="min-w-0 flex-1 truncate">
                {audienceLabel(a)} · {avatarLocation(a)}
              </span>
              {a.id === avatar.id && <Check className="text-lind-green" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={people.openNewPerson}><UserPlus /> New report for another person</DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/account/$account/stakeholders" params={{ account: slug }}><UserRound /> Manage people</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function ControlBar() {
  const { settings, update, allMonths, months, dataset, baseline } = useAccount();
  const from = months[0];
  const to = months[months.length - 1];

  return (
    <div className="flex flex-wrap items-center gap-2" data-tour="control-bar">
      <div className="flex items-center gap-1 rounded-lg border border-lind-line bg-card px-3 py-1.5 shadow-lind">
        <CalendarRange className="h-4 w-4 text-lind-blue" />
        <Select value={from} onValueChange={(v) => update({ from: v, to: v > to ? v : to })}>
          <SelectTrigger className="h-8 w-[112px] border-none bg-transparent px-1.5 text-sm shadow-none" aria-label="Period start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {fmtMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">–</span>
        <Select value={to} onValueChange={(v) => update({ to: v, from: v < from ? v : from })}>
          <SelectTrigger className="h-8 w-[112px] border-none bg-transparent px-1.5 text-sm shadow-none" aria-label="Period end">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {fmtMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-lind-line bg-card px-3 py-1.5 shadow-lind">
        <Scale className="h-4 w-4 text-lind-green" />
        <Select value={baseline.id} onValueChange={(v) => update({ baselineId: v })}>
          <SelectTrigger className="h-8 w-auto min-w-56 max-w-96 border-none bg-transparent px-1.5 text-sm shadow-none" aria-label="Comparison baseline">
            <span className="truncate text-left">
              <span className="text-muted-foreground">vs </span>
              {baseline.name}
            </span>
          </SelectTrigger>
          <SelectContent>
            {dataset.baselines.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
                {b.selection.toUpperCase() === "DEFAULT" ? " · default" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-1 flex items-center rounded-full bg-lind-mist p-0.5" role="radiogroup" aria-label="Sensitivity scenario">
          {SCENARIOS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={settings.scenario === s}
              onClick={() => update({ scenario: s })}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                settings.scenario === s ? "bg-lind-navy text-white" : "text-lind-grey hover:text-lind-navy",
              )}
            >
              {SCENARIO_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto" />

    </div>
  );
}
