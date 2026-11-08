import { useState } from "react";
import { Bell, Rocket, FileText, Play, Award, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/design-system/ventura-6bef42/components/ui/dialog";
import {
  getFollowedStartupsNews,
  toggleStartupFollow,
  type FollowNewsItem,
} from "@/design-system/ventura-6bef42/lib/startup-follows.functions";
import { useAuth } from "@/design-system/ventura-6bef42/hooks/use-auth";
import { safeSrc } from "@/design-system/ventura-6bef42/lib/url";
import { toast } from "sonner";
import greySadEmoji from "@/design-system/ventura-6bef42/assets/grey-sad-emoji.png";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(kind: FollowNewsItem["kind"]) {
  switch (kind) {
    case "weekly_update": return FileText;
    case "progression_card": return Award;
    case "pitch_video": return Play;
    case "pitch_deck": return Rocket;
  }
}

export function NewsBellButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const fetchNews = useServerFn(getFollowedStartupsNews);
  const toggleFollow = useServerFn(toggleStartupFollow);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["followed-news", user?.id],
    queryFn: () => fetchNews(),
    enabled: !!user && open,
    staleTime: 30_000,
  });

  const unfollowMutation = useMutation({
    mutationFn: (startupId: string) => toggleFollow({ data: { startupId, follow: false } }),
    onSuccess: (_res, startupId) => {
      qc.invalidateQueries({ queryKey: ["followed-news", user?.id] });
      qc.invalidateQueries({ queryKey: ["startup-follow", startupId] });
      qc.invalidateQueries({ queryKey: ["my-startup-follows"] });
      toast.success("Unfollowed");
    },
    onError: () => toast.error("Could not unfollow"),
  });

  const items = data?.items ?? [];
  const followed = data?.followed ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="News from followed startups"
        className="relative h-9 w-9 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center transition cursor-pointer shrink-0"
      >
        <Bell className="h-4 w-4 text-foreground" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle>News from startups you follow</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {!user ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Sign in to follow startups and see their news.</div>
            ) : isLoading ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
            ) : followed.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <img src={greySadEmoji} alt="" className="h-14 w-14 opacity-50" />
                <div className="text-sm text-muted-foreground">
                  No news yet. Follow startups to see their updates here.
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 pt-4 pb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Following ({followed.length})
                  </div>
                  <ul className="flex flex-col gap-1">
                    {followed.map((f) => {
                      const logo = safeSrc(f.logoUrl);
                      const pending = unfollowMutation.isPending && unfollowMutation.variables === f.id;
                      return (
                        <li key={f.id} className="flex items-center gap-3 py-1.5">
                          <Link
                            to="/startup/$slug"
                            params={{ slug: f.slug }}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80"
                          >
                            <div className="h-9 w-9 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                              {logo ? (
                                <img src={logo} alt={f.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {f.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium truncate">{f.name}</div>
                          </Link>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => unfollowMutation.mutate(f.id)}
                            className="text-xs px-3 h-8 rounded-full border border-border hover:bg-muted disabled:opacity-50 shrink-0 inline-flex items-center gap-1 cursor-pointer"
                            aria-label={`Unfollow ${f.name}`}
                          >
                            <X className="h-3 w-3" />
                            Unfollow
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="border-t border-border/60 mt-2 px-2 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 px-4 pt-2">
                    Updates
                  </div>
                  {items.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">
                      No new updates since you started following.
                    </div>
                  ) : (
                    <ul className="flex flex-col">
                      {items.map((it) => {
                        const Icon = iconFor(it.kind);
                        const logo = safeSrc(it.logoUrl);
                        return (
                          <li key={it.key}>
                            <Link
                              to="/startup/$slug"
                              params={{ slug: it.startupSlug }}
                              onClick={() => setOpen(false)}
                              className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-muted transition"
                            >
                              <div className="relative h-10 w-10 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                                {logo ? (
                                  <img src={logo} alt={it.startupName} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {it.startupName.charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background">
                                  <Icon className="h-3 w-3" />
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                  <div className="text-sm font-semibold truncate">{it.startupName}</div>
                                  <div className="text-[11px] text-muted-foreground shrink-0">{timeAgo(it.at)}</div>
                                </div>
                                <div className="text-sm text-foreground truncate">{it.title}</div>
                                {it.subtitle && (
                                  <div className="text-xs text-muted-foreground truncate">{it.subtitle}</div>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
