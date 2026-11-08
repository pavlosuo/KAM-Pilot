import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { ProgramLogo } from "@/design-system/ventura-6bef42/components/ProgramLogo";
import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { FINNISH_ACCELERATORS } from "@/design-system/ventura-6bef42/lib/finnish-accelerators";

export function parseAcceleratorList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const KNOWN = new Set(FINNISH_ACCELERATORS);

/** Live program logos keyed by program name — always beats the stored snapshot. */
function useLiveProgramLogos(names: string[]) {
  const key = [...names].sort().join("|");
  const { data } = useQuery({
    queryKey: ["program-logos-by-name", key],
    enabled: names.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("programs")
        .select("name, logo_url")
        .in("name", names);
      const map: Record<string, string> = {};
      for (const r of (rows ?? []) as Array<{ name: string; logo_url: string | null }>) {
        if (r.logo_url) map[r.name] = r.logo_url;
      }
      return map;
    },
  });
  return data ?? {};
}

export function BackedByBlock({
  accelerator,
  logos,
}: {
  accelerator?: string | null;
  logos?: Record<string, string> | null;
}) {
  const names = parseAcceleratorList(accelerator);
  const liveLogos = useLiveProgramLogos(names);
  if (names.length === 0) return null;


  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Award className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            BACKED BY
          </h3>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {names.map((n) => {
            const isCustom = !KNOWN.has(n);
            const customLogo = liveLogos[n] ?? logos?.[n] ?? null;
            return (
              <li
                key={n}
                className="group flex flex-col items-center gap-2.5 rounded-xl border bg-gradient-to-br from-card to-muted/30 p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40"
              >
                <ProgramLogo
                  name={n}
                  size={56}
                  logoUrl={customLogo}
                  forceUpload={isCustom}
                />
                <span className="text-xs font-medium leading-tight line-clamp-2">{n}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
