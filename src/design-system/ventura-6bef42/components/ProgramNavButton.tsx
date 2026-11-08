import { Link } from "@tanstack/react-router";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export function ProgramNavButton({
  programName,
  logoUrl,
  themeColor,
  glow = false,
  programKey,
  variant = "desktop",
  onNavigate,
}: {
  programName: string;
  logoUrl: string | null;
  themeColor: string | null;
  glow?: boolean;
  programKey: string;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const style = themeColor && glow
    ? ({
        ["--program-glow" as string]: themeColor,
      } as React.CSSProperties)
    : undefined;

  const glowClasses = themeColor && glow
    ? "animate-program-button-glow shadow-[0_0_10px_0_var(--program-glow)]"
    : "";

  const logo = logoUrl ? (
    <img
      src={logoUrl}
      alt=""
      aria-hidden
      className="h-5 w-5 shrink-0 rounded-full bg-white object-contain ring-2 ring-black"
    />
  ) : (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold uppercase text-primary"
    >
      {programName.slice(0, 1)}
    </span>
  );

  if (variant === "mobile") {
    return (
      <Link
        to="/program-content"
        search={{ program: programKey }}
        onClick={onNavigate}
        style={style}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-3 text-base font-medium leading-relaxed text-foreground/90 hover:bg-accent",
          glowClasses,
        )}
      >
        {logo}
        <span className="truncate">{programName}</span>
      </Link>
    );
  }

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      style={style}
      className={cn(
        "h-auto min-h-9 rounded-full border px-5 gap-2 max-w-[220px] leading-relaxed",
        glowClasses,
      )}
      data-particles="false"
    >
      <Link to="/program-content" search={{ program: programKey }}>
        {logo}
        <span className="truncate py-0.5 leading-relaxed">{programName}</span>
      </Link>
    </Button>
  );
}


