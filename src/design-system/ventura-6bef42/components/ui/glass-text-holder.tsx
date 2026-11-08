import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

const glassHolderVariants = cva(
  "relative isolate rounded-full transition-all",
  {
    variants: {
      size: {
        default: "text-base font-medium",
        sm: "text-sm font-medium",
        lg: "text-lg font-medium",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { size: "default" },
  },
);

const glassHolderTextVariants = cva(
  "glass-holder-text relative block select-none tracking-tighter",
  {
    variants: {
      size: {
        default: "px-6 py-3.5",
        sm: "px-4 py-2",
        lg: "px-8 py-4",
        icon: "flex h-10 w-10 items-center justify-center",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export interface GlassTextHolderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassHolderVariants> {
  contentClassName?: string;
}

const GlassTextHolder = React.forwardRef<HTMLDivElement, GlassTextHolderProps>(
  ({ className, children, size, contentClassName, ...props }, ref) => {
    return (
      <div className={cn("glass-holder-wrap rounded-full inline-block", className)}>
        <div
          ref={ref}
          className={cn("glass-holder", glassHolderVariants({ size }))}
          {...props}
        >
          <span className={cn(glassHolderTextVariants({ size }), contentClassName)}>
            {children}
          </span>
        </div>
        <div className="glass-holder-shadow rounded-full" aria-hidden />
      </div>
    );
  },
);
GlassTextHolder.displayName = "GlassTextHolder";

export { GlassTextHolder, glassHolderVariants };
