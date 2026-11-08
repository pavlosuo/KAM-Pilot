import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { DEMO_STARTUPS, type DemoStartup } from "@/design-system/ventura-6bef42/lib/demo-startups";

export type ShowcaseStartup = DemoStartup & { logoUrl?: string | null };

const COLORS = DEMO_STARTUPS.map((s) => s.logoColor);

/** Real published startups (with logos) for the home page; demo set while loading/empty. */
export function useShowcaseStartups(): ShowcaseStartup[] {
  const { data } = useQuery({
    queryKey: ["home-showcase-startups"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("startups")
        .select("slug, name, one_liner, industry, stage, location, country, logo_url")
        .eq("is_published", true)
        .eq("hidden_from_discovery", false)
        .not("logo_url", "is", null)
        .order("discovery_order", { ascending: true, nullsFirst: false })
        .limit(12);
      return (rows ?? []).map(
        (r: any, i: number): ShowcaseStartup => ({
          slug: r.slug,
          name: r.name,
          founder: "",
          tagline: r.one_liner ?? "",
          industry: r.industry || "Startup",
          stage: r.stage || "Early stage",
          location: r.location || r.country || "Finland",
          story: "",
          traction: "",
          asking: "",
          logoColor: COLORS[i % COLORS.length],
          avatar: "",
          logoUrl: r.logo_url,
        }),
      );
    },
  });
  return data && data.length >= 3 ? data : DEMO_STARTUPS;
}
