import type { ReactNode } from "react";
import { Header } from "@/design-system/ventura-6bef42/components/Header";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { Progress } from "@/design-system/ventura-6bef42/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export function OnboardingShell({
  steps,
  step,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  saving,
  nextDisabled,
  hideBack,
  hideNext,
}: {
  steps: readonly string[];
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  saving?: boolean;
  nextDisabled?: boolean;
  hideBack?: boolean;
  hideNext?: boolean;
}) {
  const isLast = step === steps.length - 1;
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-2xl px-6 pt-10 pb-24">
          <div className="mb-8">
            <div className="mb-2 text-xs text-muted-foreground">
              Step {step + 1} of {steps.length}
            </div>
            <Progress value={((step + 1) / steps.length) * 100} className="h-1.5" />
          </div>

          {title ? <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1> : null}
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}

          <div className="mt-8 space-y-6">{children}</div>

          <div
            className={cn(
              "mt-10 flex items-center gap-3",
              hideBack && hideNext ? "hidden" : hideBack ? "justify-end" : hideNext ? "justify-start" : "justify-between",
            )}
          >
            {!hideBack && (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={saving}
                data-particles="true"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {!hideNext && (
              <Button type="button" onClick={onNext} disabled={saving || nextDisabled} data-particles="true">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isLast ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : null}
                {isLast ? "Finish" : "Continue"}
                {!isLast && !saving ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  const extra = value.filter((v) => !options.includes(v));
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground/80 hover:border-foreground/40",
            )}
          >
            {opt}
          </button>
        );
      })}
      {extra.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className="cursor-pointer rounded-full border border-foreground bg-foreground px-3.5 py-1.5 text-sm text-background transition-colors"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
