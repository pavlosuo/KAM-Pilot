import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { getStartupProgramBadges } from "@/design-system/ventura-6bef42/lib/program-badges.functions";
import { SPECIAL_PROGRAM_LOGOS } from "@/design-system/ventura-6bef42/lib/finnish-accelerators";

type ProgramBadge = { id: string; name: string; logo_url: string | null };

// Shows the accelerator/incubator programs a startup has been approved into.
export function ProgramMembershipBadges({ startupId }: { startupId: string }) {
  const { data } = useQuery({
    queryKey: ["startup-programs", startupId],
    queryFn: async () => {
      const res = await getStartupProgramBadges({ data: { startupId } });
      return res.programs as ProgramBadge[];
    },
  });


  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {data.map((p) => {
        const logo = p.logo_url ?? SPECIAL_PROGRAM_LOGOS[p.name] ?? null;
        return (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            {logo ? (
              <img
                src={logo}
                alt={`${p.name} logo`}
                className="h-4 w-4 shrink-0 rounded-full bg-background object-contain"
              />
            ) : (
              <BadgeCheck className="h-3.5 w-3.5" />
            )}
            {p.name} cohort
            <span className="relative ml-0.5 flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

