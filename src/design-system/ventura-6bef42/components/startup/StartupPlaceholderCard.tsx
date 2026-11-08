import { Card, CardContent } from "@/design-system/ventura-6bef42/components/ui/card";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Badge } from "@/design-system/ventura-6bef42/components/ui/badge";
import { Skeleton } from "@/design-system/ventura-6bef42/components/ui/skeleton";
import {
  Mic,
  Pencil,
  Video,
  Eye,
  Heart,
  MessageCircle,
  FileText,
  Bookmark,
  MoreHorizontal,
  Star,
  Zap,
  Flame,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export function StartupPlaceholderCard() {
  return (
    <Card className="rounded-2xl overflow-hidden border border-dashed border-border/60">
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* LEFT */}
          <div className="p-6 md:border-r border-border flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-14 w-14 rounded-xl shrink-0 mt-[3px]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2 min-w-0">
                  <h2 className="font-semibold text-lg truncate leading-none w-full sm:w-auto text-muted-foreground">
                    Startup name
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
                    <Badge className="shrink-0 rounded-full px-1.5 sm:px-2 py-0 text-[10px] sm:text-[11px] bg-foreground text-background border-transparent gap-1">
                      <Star className="h-3 w-3 fill-current" /> Primary
                    </Badge>
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full px-1.5 sm:px-2 py-0 text-[10px] sm:text-[11px] font-medium gap-1 text-emerald-600 border-emerald-500/40 bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Published
                    </Badge>
                  </div>
                </div>
                <p className="hidden sm:block text-sm text-muted-foreground mt-1 line-clamp-2">
                  Your startup description
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full shrink-0"
                disabled
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            {/* Buttons pushed to bottom */}
            <div className="mt-auto flex flex-col gap-4">
              {/* Engagement metrics */}
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { icon: Heart, color: "text-rose-500" },
                    { icon: MessageCircle, color: "text-blue-500" },
                    { icon: FileText, color: "text-amber-500" },
                    { icon: Bookmark, color: "text-emerald-500" },
                  ].map(({ icon: Icon, color }, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <Icon className={cn("h-4 w-4", color)} />
                      <span className="text-sm font-semibold text-muted-foreground">?</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-3 h-10 w-full rounded-xl border-2 border-border"
                  disabled
                >
                  <Eye className="h-4 w-4" />
                  View pitch video
                </Button>
              </div>

              {/* Post weekly update */}
              <Button
                disabled
                variant="outline"
                className="w-full h-14 rounded-2xl text-muted-foreground justify-center"
              >
                <Mic className="h-4 w-4" /> Post weekly update
              </Button>

              {/* Edit + Pitch video */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-11 rounded-xl border-2 border-border" disabled>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" className="h-11 rounded-xl border-2 border-border" disabled>
                  Pitch video
                  <Video className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="p-6 space-y-5">
            {/* Top row: label + streak pill */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                Startup XP
              </div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: "linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  border: "1px solid #e5e7eb",
                  color: "#9ca3af",
                }}
              >
                <Flame className="h-3.5 w-3.5" />
                ?
              </div>
            </div>

            {/* XP + level */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-muted-foreground">?</span>
                <span className="text-sm font-medium text-muted-foreground">XP</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1 text-lg font-semibold text-muted-foreground">
                  Level ?
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </span>
              </div>
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
              <div className="mt-1.5 text-[11px] text-muted-foreground">?/150 XP · ? to Level ?</div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Badges header + placeholders */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ACHIEVEMENTS ?/18
                </div>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground"
                >
                  View all <span className="text-muted-foreground">›</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <Skeleton className="h-14 w-14 rounded-xl" />
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  +?
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
