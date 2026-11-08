import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { listMyStartupFollows, toggleStartupFollow } from "@/design-system/ventura-6bef42/lib/startup-follows.functions";

type Props = {
  startupId: string;
  onRequireAuth?: () => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export function StartupFollowButton({
  startupId,
  onRequireAuth,
  className = "",
  activeClassName = "",
  inactiveClassName = "",
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFollowsFn = useServerFn(listMyStartupFollows);
  const toggleFollowFn = useServerFn(toggleStartupFollow);

  const followsQueryKey = ["my-startup-follows", user?.id ?? "anon"] as const;
  const { data: followsData } = useQuery({
    queryKey: followsQueryKey,
    queryFn: () => listFollowsFn(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const isFollowing = !!followsData?.startupIds?.includes(startupId);

  const followMutation = useMutation({
    mutationFn: (follow: boolean) => toggleFollowFn({ data: { startupId, follow } }),
    onMutate: async (follow) => {
      await qc.cancelQueries({ queryKey: followsQueryKey });
      const prev = qc.getQueryData<{ startupIds: string[] }>(followsQueryKey);
      const set = new Set(prev?.startupIds ?? []);
      if (follow) set.add(startupId);
      else set.delete(startupId);
      qc.setQueryData(followsQueryKey, { startupIds: [...set] });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(followsQueryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["followed-news"] });
    },
  });

  const handleClick = () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    followMutation.mutate(!isFollowing);
  };

  const baseClasses =
    "shrink-0 rounded-full font-semibold transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center";
  const stateClasses = isFollowing
    ? activeClassName || "bg-background border border-border text-foreground hover:bg-muted"
    : inactiveClassName || "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={followMutation.isPending}
      aria-pressed={isFollowing}
      className={`${baseClasses} ${stateClasses} ${className}`}
    >
      {followMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        "Following"
      ) : (
        "Follow"
      )}
    </button>
  );
}
