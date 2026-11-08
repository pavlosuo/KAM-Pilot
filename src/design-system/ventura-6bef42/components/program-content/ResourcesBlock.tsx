import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  GraduationCap,
  Loader2,
  Mic,
  Rocket,
  Sparkles,
  TrendingUp,
  Video,
  Wrench,
} from "lucide-react";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system/ventura-6bef42/components/ui/card";
import { Skeleton } from "@/design-system/ventura-6bef42/components/ui/skeleton";
import { getStartupResources } from "@/design-system/ventura-6bef42/lib/startup-resources.functions";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";
import { InfoHint } from "@/design-system/ventura-6bef42/components/program-content/InfoHint";
import { faviconFor, hostOf, previewFor } from "@/design-system/ventura-6bef42/lib/resource-preview";

const PER_PAGE = 4;

const KIND_ICON: Record<string, typeof Video> = {
  video: Video,
  essay: FileText,
  interview: Mic,
  book: BookOpen,
  template: FileText,
  framework: Wrench,
  legal: Gavel,
  program: Rocket,
  tool: Wrench,
  course: GraduationCap,
  website: Globe,
};

function ResourceThumb({
  url,
  imageUrl,
  title,
  Icon,
}: {
  url: string | null;
  imageUrl: string | null;
  title: string;
  Icon: typeof Video;
}) {
  const [src, setSrc] = useState<string | null>(() => previewFor(url, imageUrl));
  const favicon = faviconFor(url);

  return (
    <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg bg-gradient-to-br from-muted to-muted/40">
      {src ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setSrc(src === favicon ? null : favicon)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function ResourcesBlock({
  startupId,
  programId,
}: {
  startupId: string;
  programId: string | null;
}) {
  const [page, setPage] = useState(0);
  const load = useServerFn(getStartupResources);

  const { data, isLoading } = useQuery({
    queryKey: ["startup-resources", startupId],
    queryFn: () => load({ data: { startupId, programId } }),
    staleTime: 30 * 60_000,
    retry: false,
  });

  const resources = data?.resources ?? [];
  const pageCount = Math.max(1, Math.ceil(Math.min(resources.length, 12) / PER_PAGE));
  const current = resources.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <Card className="h-full">
      <CardHeader className="min-h-[68px] justify-center pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Recommended <span className="hidden sm:inline">by Ventura for you</span>
            <InfoHint text="Picked from your profile and the goals in your weekly updates. Refreshed every Monday." />
          </CardTitle>

          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous resources"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page + 1}/{pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                aria-label="More resources"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : current.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Building your reading list</p>
            <p className="text-xs text-muted-foreground">
              Publish a weekly update and Ventura AI will match resources to your stage.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {current.map((r) => {
              const Icon = KIND_ICON[r.kind] ?? Globe;
              const host = hostOf(r.url);
              return (
                <a
                  key={r.id}
                  href={r.url ?? "#"}
                  target={r.url ? "_blank" : undefined}
                  rel="noreferrer"
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-2xl border bg-card p-3 shadow-sm transition-all duration-300",
                    r.url
                      ? "hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
                      : "cursor-default",
                  )}
                >
                  <ResourceThumb url={r.url} imageUrl={r.imageUrl} title={r.title} Icon={Icon} />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold leading-tight">
                        {r.title}
                      </h3>
                      {r.url && (
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                    {r.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center gap-1.5 overflow-hidden pt-3">
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-primary-foreground hover:bg-primary/15 shrink-0 truncate capitalize"
                      >
                        {r.kind}
                      </Badge>
                      {(r.sourceLabel || host) && (
                        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                          {r.sourceLabel ?? host}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InvestorReadinessBlock({ startupName }: { startupName: string }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Investor readiness &amp; matching
          </CardTitle>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Ventura AI will score how investor ready {startupName} is and match you with investors
          from our base.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-dashed p-5 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Readiness assessment</p>
          <p className="text-xs text-muted-foreground">
            Built from your profile, weekly updates and program challenges.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled className="cursor-not-allowed">
            <Loader2 className="mr-1.5 h-4 w-4" />
            Assess readiness
          </Button>
          <Button variant="outline" disabled className="cursor-not-allowed">
            Match with an investor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
