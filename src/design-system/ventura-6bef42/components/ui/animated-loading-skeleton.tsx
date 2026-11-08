import { useEffect, useState } from "react";
import { motion, useAnimation, type AnimationDefinition } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface GridConfig {
  numCards: number;
  cols: number;
  xBase: number;
  yBase: number;
  xStep: number;
  yStep: number;
}

const getGridConfig = (width: number): GridConfig => ({
  numCards: 6,
  cols: width >= 1024 ? 3 : width >= 640 ? 2 : 1,
  xBase: 40,
  yBase: 60,
  xStep: 210,
  yStep: 230,
});

const generateSearchPath = (config: GridConfig): AnimationDefinition => {
  const { numCards, cols, xBase, yBase, xStep, yStep } = config;
  const rows = Math.ceil(numCards / cols);
  const allPositions: { x: number; y: number }[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row * cols + col < numCards) {
        allPositions.push({ x: xBase + col * xStep, y: yBase + row * yStep });
      }
    }
  }

  const shuffled = allPositions.sort(() => Math.random() - 0.5).slice(0, 4);
  if (shuffled.length === 0) return {};
  shuffled.push(shuffled[0]);

  return {
    x: shuffled.map((p) => p.x),
    y: shuffled.map((p) => p.y),
    scale: Array(shuffled.length).fill(1.2),
    transition: {
      duration: shuffled.length * 2,
      repeat: Infinity,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      times: shuffled.map((_, i) => i / (shuffled.length - 1)),
    },
  };
};

const frameVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

const glowVariants = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 1, repeat: Infinity, ease: "easeInOut" as const },
  },
};

export const AnimatedLoadingSkeleton = ({
  className = "",
  fullscreen = false,
}: {
  className?: string;
  fullscreen?: boolean;
}) => {
  const [windowWidth, setWindowWidth] = useState(0);
  const controls = useAnimation();

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!windowWidth) return;
    void controls.start(generateSearchPath(getGridConfig(windowWidth)));
  }, [windowWidth, controls]);

  const config = getGridConfig(windowWidth);

  return (
    <motion.div
      variants={frameVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative w-full overflow-hidden bg-background",
        fullscreen ? "h-full rounded-none border-0 p-0" : "rounded-2xl border border-border bg-card p-4 sm:p-6",
        className
      )}
      aria-busy="true"
      aria-label="Loading"
    >
      <motion.div
        animate={controls}
        className="pointer-events-none absolute left-0 top-0 z-10 hidden sm:block"
        style={{ x: 0, y: 0 }}
      >
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30"
        >
          <Search className="h-4 w-4 text-primary" />
        </motion.div>
      </motion.div>

      <div
        className={cn(
          "grid h-full gap-4",
          fullscreen ? "p-4 sm:p-6 auto-rows-fr" : "",
          config.cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : config.cols === 2 ? "sm:grid-cols-2" : "grid-cols-1"
        )}
      >
        {Array.from({ length: config.numCards }).map((_, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className={cn(
              "space-y-3 rounded-xl border border-border bg-muted/30 p-4",
              fullscreen && "flex h-full flex-col justify-between"
            )}
          >
            <div className={cn("w-full animate-pulse rounded-lg bg-muted", fullscreen ? "flex-1" : "h-24")} />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default AnimatedLoadingSkeleton;
