import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export interface LiquidMetalButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * CSS-only "liquid metal" inspired button: animated chrome gradient outline,
 * metallic fill, soft inner highlight, and a shimmer that sweeps on hover.
 */
export const LiquidMetalButton = forwardRef<
  HTMLButtonElement,
  LiquidMetalButtonProps
>(({ className, children, disabled, style, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "group relative isolate inline-flex items-center justify-center overflow-hidden rounded-full p-[1.5px]",
        "cursor-pointer transition-transform duration-300 will-change-transform",
        "hover:scale-[1.02] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        className,
      )}
      style={{
        ...style,
        background:
          "conic-gradient(from 145deg,#b5b5b5,#ffffff,#8f8f8f,#ffffff,#b5b5b5)",
      }}
      {...props}
    >
      {/* Inner metallic surface */}
      <span
        className="relative z-10 inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(0,0,0,0.22),0_6px_20px_-8px_rgba(0,0,0,0.45)]"
        style={{
          background:
            "linear-gradient(180deg,#fafafa 0%,#dcdcdc 45%,#bfbfbf 55%,#f4f4f4 100%)",
        }}
      >
        {/* Shimmer sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:translate-x-full group-hover:opacity-100"
        />
        <span className="relative">{children}</span>
      </span>
    </button>
  );
});
LiquidMetalButton.displayName = "LiquidMetalButton";
