import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { getProgramWorkspace } from "@/design-system/ventura-6bef42/lib/program-content.functions";

export type ProgramWorkspaceItem = Awaited<
  ReturnType<typeof getProgramWorkspace>
>["items"][number];

/** Programs the signed-in user's startups belong to. Shared by header + /program-content. */
export function useProgramWorkspace() {
  const { user } = useAuth();
  const load = useServerFn(getProgramWorkspace);

  const query = useQuery({
    queryKey: ["program-workspace", user?.id ?? "anon"],
    queryFn: () => load({ data: undefined as never }),
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    items: (query.data?.items ?? []) as ProgramWorkspaceItem[],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
