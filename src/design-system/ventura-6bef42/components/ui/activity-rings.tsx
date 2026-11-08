"use client";

import { motion } from "framer-motion";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export interface ActivityRing {
  label: string;
  /** 0-100 */
  value: number;
  color: string;
  size: number;
  current: number;
  target: number;
  unit: string;
}

const CircleProgress = ({ data, index }: { data: ActivityRing; index: number }) => {
  const strokeWidth = Math.max(12, Math.round(data.size * 0.115));
  const radius = (data.size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.max(0, Math.min(100, data.value));
  const offset = ((100 - clamped) / 100) * circumference;

  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: data.size, height: data.size }}
    >
      <svg width={data.size} height={data.size} className="-rotate-90 overflow-visible">
        <circle
          cx={data.size / 2}
          cy={data.size / 2}
          r={radius}
          fill="none"
          stroke="#E5E5EA"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={data.size / 2}
          cy={data.size / 2}
          r={radius}
          fill="none"
          stroke={data.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, delay: index * 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${data.color}55)` }}
        />
      </svg>
    </div>
  );
};

export function ActivityRings({
  rings,
  title,
  className,
}: {
  rings: ActivityRing[];
  title?: string;
  className?: string;
}) {
  const outer = Math.max(...rings.map((r) => r.size));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "flex flex-row items-center gap-4 rounded-2xl bg-card p-4 sm:gap-10 sm:p-6",
        className,
      )}
    >
      <div
        className="relative shrink-0 scale-[0.65] sm:scale-100"
        style={{ width: outer, height: outer }}
      >
        {rings.map((ring, i) => (
          <CircleProgress key={ring.label} data={ring} index={i} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-6">
        {title ? (
          <p className="hidden text-sm font-semibold uppercase tracking-widest text-muted-foreground sm:block">
            {title}
          </p>
        ) : null}
        {rings.map((ring, i) => (
          <motion.div
            key={ring.label}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.18, ease: "easeOut" }}
            className="flex flex-col gap-0.5 sm:gap-1"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-xs">
              {ring.label}
            </span>
            <span
              className="text-xl font-bold leading-none tabular-nums sm:text-3xl"
              style={{ color: ring.color }}
            >
              {ring.current}/{ring.target}
              <span className="ml-1 text-xs font-semibold uppercase text-foreground sm:ml-2 sm:text-base">
                {ring.unit}
              </span>
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default ActivityRings;
