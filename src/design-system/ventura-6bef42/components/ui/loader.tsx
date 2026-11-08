import { motion } from "framer-motion";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

export default function Loader({
  title = "Configuring your account...",
  subtitle = "Please wait while we prepare everything for you",
  size = "md",
  className,
  ...props
}: LoaderProps) {
  const sizeConfig = {
    sm: {
      container: "size-20",
      titleClass: "text-sm/tight font-medium",
      subtitleClass: "text-xs/relaxed",
      spacing: "space-y-2",
      maxWidth: "max-w-48",
    },
    md: {
      container: "size-32",
      titleClass: "text-base/snug font-medium",
      subtitleClass: "text-sm/relaxed",
      spacing: "space-y-3",
      maxWidth: "max-w-56",
    },
    lg: {
      container: "size-40",
      titleClass: "text-lg/tight font-semibold",
      subtitleClass: "text-base/relaxed",
      spacing: "space-y-4",
      maxWidth: "max-w-64",
    },
  };

  const config = sizeConfig[size];

  const ringBase =
    "absolute inset-0 rounded-full border border-current opacity-40";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        config.spacing,
        className
      )}
      {...props}
    >
      {/* Enhanced Monochrome Loader */}
      <div
        className={cn(
          "relative flex items-center justify-center",
          config.container
        )}
        aria-busy="true"
        aria-label={title}
      >
        {/* Outer elegant ring with shimmer */}
        <motion.div
          className={cn(ringBase, "text-muted-foreground/30")}
          style={{ borderStyle: "dashed" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        {/* Primary animated ring with gradient */}
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-t-primary border-r-primary/60 border-b-transparent border-l-primary/30"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />

        {/* Secondary elegant ring - counter rotation */}
        <motion.div
          className="absolute inset-5 rounded-full border border-primary/40"
          style={{ borderStyle: "dotted" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner solid ring pulse */}
        <motion.div
          className="absolute inset-8 rounded-full bg-primary/10"
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Accent particles orbiting the inner ring */}
        {[0, 90, 180, 270].map((deg) => (
          <motion.div
            key={deg}
            className="pointer-events-none absolute left-1/2 top-1/2 w-[38%]"
            style={{ originX: 0, originY: 0.5 }}
            animate={{ rotate: [deg, deg + 360] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "linear",
              delay: deg * 0.015,
            }}
          >
            <motion.div
              className="absolute right-0 top-1/2 size-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary"
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: deg * 0.015,
              }}
            />
          </motion.div>
        ))}

        {/* Orbit guide ring */}
        <div className="absolute inset-[26%] rounded-full border border-dashed border-primary/20" />

        {/* Dark mode variants are handled via CSS variables / currentColor */}
      </div>

      {/* Enhanced Typography with Breathing Animation */}
      <div className={cn("space-y-1", config.maxWidth)}>
        {/* Clean title with subtle animation */}
        <motion.p
          className={cn("text-foreground", config.titleClass)}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {title}
        </motion.p>

        {/* Clean subtitle with subtle animation */}
        <motion.p
          className={cn("text-muted-foreground", config.subtitleClass)}
          animate={{ opacity: [0.6, 0.9, 0.6] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        >
          {subtitle}
        </motion.p>
      </div>
    </div>
  );
}
