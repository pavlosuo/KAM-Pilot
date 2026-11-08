import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Camera, CheckCircle2, Eye, FilePlus2, Linkedin, Loader2, MapPin, Pencil, Save, Sparkles, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";
import { Label } from "@/design-system/ventura-6bef42/components/ui/label";
import { Slider } from "@/design-system/ventura-6bef42/components/ui/slider";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { useAccount } from "@/lib/state/account-context";
import { usePreferences } from "@/lib/state/preferences-store";
import { AvatarBadge } from "@/components/review/AvatarBadge";
import { PriorityChips } from "@/components/review/PriorityChips";
import { AddOwnChip, Chip } from "@/components/studio/Chip";
import { usePeople } from "@/components/people/PeopleProvider";
import { locationOptions, resolveLocations } from "@/lib/avatar/audience";
import { avatarLocation, NEUTRAL_LENS, peopleLabel, personName, type Avatar } from "@/lib/engine/avatars";
import { personalizedAvatarWeights } from "@/lib/engine/avatar-personalization";
import { PRIORITY_KEYS, PRIORITY_META, rankPriorities } from "@/lib/engine/priorities";
import { PRIORITY_TEXT } from "@/lib/ui/palette";
import { downscalePhoto } from "@/lib/people/client";

export const Route = createFileRoute("/account/$account/stakeholders")({
  head: () => ({
    meta: [
      { title: "People - Lindström customer value review" },
      { name: "description", content: "The people at the customer: who they are, where they work, what they value and a report made for each of them." },
      { property: "og:title", content: "People - Lindström customer value review" },
      { property: "og:description", content: "Customer stakeholders with their roles, locations, values and personal reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StakeholdersPage,
});

function StakeholdersPage() {
  const a = useAccount();
  const prefs = usePreferences();
  const people = usePeople();
  const [draft, setDraft] = useState<Avatar | null>(null);

  const remove = (av: Avatar) => {
    prefs.deleteAvatar(av.id);
    if (a.avatar.id === av.id) a.update({ avatarId: NEUTRAL_LENS.id, countries: [] });
    toast.success(`${peopleLabel(av)} removed`, { action: { label: "Undo", onClick: () => prefs.upsertAvatar(av) } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-lind-navy">People at {a.customer.name}</h1>
        <Button size="lg" onClick={people.openNewPerson}>
          <UserPlus /> New report for another person
        </Button>
      </div>

      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {a.avatars.map((av) => (
          <li key={av.id}>
            <PersonCard person={av} active={av.id === a.avatar.id} onEdit={() => setDraft({ ...av, name: personName(av) })} onRemove={() => remove(av)} onGenerate={() => people.generateFor(av)} />
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={people.openNewPerson}
            className="group flex h-full min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-lind-line bg-card/60 p-6 text-lind-grey transition-colors hover:border-lind-blue hover:text-lind-blue focus-visible:outline-2"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-lind-mist transition-colors group-hover:bg-lind-blue/10">
              <UserPlus className="h-9 w-9" />
            </span>
            <span className="text-lg font-bold">Add a person</span>
          </button>
        </li>
      </ul>

      <PersonEditor draft={draft} onChange={setDraft} />
    </div>
  );
}

function PersonCard({ person, active, onEdit, onRemove, onGenerate }: { person: Avatar; active: boolean; onEdit: () => void; onRemove: () => void; onGenerate: () => void }) {
  const a = useAccount();
  const prefs = usePreferences();
  const people = usePeople();
  const [findingPhoto, setFindingPhoto] = useState(false);
  const weights = personalizedAvatarWeights(person);
  const named = !!personName(person);
  const findPhoto = async () => {
    setFindingPhoto(true);
    try {
      const response = await fetch("/api/person-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: personName(person), company: a.customer.name, role: person.role, linkedin: person.linkedin ?? null }) });
      if (!response.ok) throw new Error("Photo lookup could not finish. Try again.");
      const result = await response.json() as { photo: string | null; photoSource: string | null };
      const photo = result.photo ? await downscalePhoto(result.photo) : null;
      if (!photo) {
        toast.info("No public photo found. LinkedIn may require sign-in to show it.");
        return;
      }
      prefs.patchAvatar(person.id, { photo, photoSource: result.photoSource });
      toast.success(`Photo found for ${peopleLabel(person)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo lookup could not finish.");
    } finally {
      setFindingPhoto(false);
    }
  };
  return (
    <article className={cn("relative flex h-full flex-col gap-4 rounded-2xl border-2 bg-card p-5 shadow-lind transition-colors", active ? "border-lind-green" : "border-transparent")}>
      {active && (
        <span className="absolute -top-3.5 left-5 inline-flex items-center gap-1.5 rounded-full bg-lind-green px-3 py-0.5 text-sm font-bold text-white">
          <Eye className="h-4 w-4" /> Showing
        </span>
      )}
      <div className="flex items-center gap-4">
        <AvatarBadge avatar={person} size="xl" />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-xl font-bold", named ? "text-lind-ink" : "text-lind-grey")}>{peopleLabel(person)}</p>
          <p className="truncate text-base text-lind-ink">{person.role}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-lind-grey">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{avatarLocation(person)}</span>
          </p>
        </div>
      </div>

      <PriorityChips ranked={rankPriorities(weights)} weights={weights} max={3} />

      {!!person.wantsToSee?.length && (
        <ul className="space-y-2" aria-label="Wants to see">
          {person.wantsToSee.slice(0, 3).map((w) => (
            <li key={w} className="flex items-start gap-2.5 text-base leading-snug text-lind-ink">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lind-green" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-2 pt-2">
        <Button className="flex-1" onClick={onGenerate}>
          <Sparkles /> Generate report
        </Button>
        <Button variant="ghost" size="icon" onClick={() => people.openUpdatePerson(person)} aria-label={`Add info about ${peopleLabel(person)}`} title="Add LinkedIn link or files">
          <FilePlus2 />
        </Button>
        {named && !person.photo && (
          <Button variant="ghost" size="icon" onClick={() => void findPhoto()} disabled={findingPhoto} aria-label={`Find photo of ${peopleLabel(person)}`} title="Find photo">
            {findingPhoto ? <Loader2 /> : <Camera />}
          </Button>
        )}
        {person.linkedin && (
          <Button variant="ghost" size="icon" asChild>
            <a href={person.linkedin} target="_blank" rel="noreferrer" aria-label={`${peopleLabel(person)} on LinkedIn`} title="LinkedIn">
              <Linkedin />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${peopleLabel(person)}`} title="Edit">
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${peopleLabel(person)}`} title="Remove">
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}

function PersonEditor({ draft, onChange }: { draft: Avatar | null; onChange: (d: Avatar | null) => void }) {
  const a = useAccount();
  const prefs = usePreferences();
  const locations = useMemo(() => locationOptions(a.dataset, a.customer.id), [a.dataset, a.customer.id]);
  const selected = draft?.locations ?? (draft?.country ? [draft.country] : []);
  const choices = [...new Set([...locations.countries, ...locations.cities].map((l) => l.value).concat(selected))];
  const original = draft ? a.avatars.find((x) => x.id === draft.id) : undefined;
  const countryChanged = !!draft && !!original && (original.country ?? null) !== (draft.country ?? null);

  const patch = (p: Partial<Avatar>) => onChange(draft ? { ...draft, ...p } : draft);
  const setLocations = (next: string[]) => {
    const resolved = resolveLocations(next, a.customerSites);
    patch({ locations: next, country: resolved.countries.length === 1 ? resolved.countries[0] : null });
  };
  const save = () => {
    if (!draft) return;
    // Research is country-specific: a new country drops the old findings.
    const next = { ...draft, name: draft.name.trim(), role: draft.role.trim() || "Stakeholder", brief: countryChanged ? null : draft.brief };
    prefs.upsertAvatar(next);
    onChange(null);
    toast.success(`Saved ${peopleLabel(next)}`);
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent className="max-h-svh max-w-2xl overflow-y-auto">
        {draft && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-lind-navy">
                <AvatarBadge avatar={draft} size="md" />
                {peopleLabel(draft)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="person-name" className="text-base">
                    Name
                  </Label>
                  <Input id="person-name" value={draft.name} maxLength={60} placeholder="Anonym" onChange={(e) => patch({ name: e.target.value })} className="h-11 text-base" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="person-role" className="text-base">
                    Role
                  </Label>
                  <Input id="person-role" value={draft.role} maxLength={60} onChange={(e) => patch({ role: e.target.value })} className="h-11 text-base" />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-lind-blue" /> Works in
                </Label>
                <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Operating locations">
                  <Chip selected={!selected.length} onClick={() => setLocations([])}>
                    All locations
                  </Chip>
                  {choices.map((location) => (
                    <Chip key={location} selected={selected.includes(location)} onClick={() => setLocations(selected.includes(location) ? selected.filter((l) => l !== location) : [...selected, location])}>
                      {location}
                    </Chip>
                  ))}
                  <AddOwnChip
                    label="Add your own location"
                    placeholder="e.g. Warsaw"
                    onAdd={(value) => {
                      if (!selected.some((l) => l.toLowerCase() === value.toLowerCase())) setLocations([...selected, value]);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base">What they value</Label>
                {PRIORITY_KEYS.map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className={cn("w-36 shrink-0 text-sm font-semibold", PRIORITY_TEXT[k])}>{PRIORITY_META[k].label}</span>
                    <Slider
                      className="flex-1"
                      value={[Math.min(3, draft.weights[k])]}
                      min={0}
                      max={3}
                      step={1}
                      onValueChange={([v]) => patch({ weights: { ...draft.weights, [k]: v } })}
                      aria-label={`${PRIORITY_META[k].label} weight`}
                    />
                    <span className="w-10 shrink-0 text-right text-sm tabular-nums text-lind-grey">{["off", "low", "mid", "top"][Math.min(3, draft.weights[k])]}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 border-t border-lind-line pt-4">
                <Button variant="ghost" size="lg" onClick={() => onChange(null)}>
                  Cancel
                </Button>
                <Button size="lg" onClick={save}>
                  <Save /> Save
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
