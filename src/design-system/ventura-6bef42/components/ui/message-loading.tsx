"use client";

import { motion } from "framer-motion";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface MessageLoadingProps {
  className?: string;
}

export function MessageLoading({ className }: MessageLoadingProps) {
  return (
    <div className={cn("flex items-center space-x-1 h-5", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-current"
          animate={{
            y: [0, -6, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}
