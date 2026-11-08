"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

export interface MenuItem {
  icon: LucideIcon | React.FC<{ className?: string }>;
  label: string;
  href?: string;
  iconColor: string;
}

export interface MenuBarProps extends React.HTMLAttributes<HTMLElement> {
  items: MenuItem[];
  activeItem?: string;
  onItemClick?: (label: string) => void;
}

const itemVariants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
};

const backVariants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
};

const sharedTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
  duration: 0.5,
};

export const MenuBar = React.forwardRef<HTMLElement, MenuBarProps>(
  ({ className, items, activeItem, onItemClick, ...props }, ref) => {
    return (
      <motion.nav
        ref={ref}
        className={cn(
          "relative flex items-center gap-1 overflow-visible rounded-2xl border border-border/40 bg-background/80 p-1 backdrop-blur-lg",
          className,
        )}
        initial="initial"
        whileHover="hover"
        {...(props as React.ComponentProps<typeof motion.nav>)}
      >
        <ul className="relative z-10 flex flex-wrap items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === activeItem;

            return (
              <motion.li key={item.label} className="relative">
                <button
                  type="button"
                  onClick={() => onItemClick?.(item.label)}
                  className="block w-full cursor-pointer"
                >
                  <motion.div
                    className="relative block overflow-visible rounded-xl"
                    style={{ perspective: "600px" }}
                    whileHover="hover"
                    initial="initial"
                  >
                    <motion.div
                      className={cn(
                        "relative z-10 flex items-center gap-2 rounded-xl bg-transparent px-3 py-2 text-sm transition-colors",
                        isActive ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                      variants={itemVariants}
                      transition={sharedTransition}
                      style={{ transformStyle: "preserve-3d", transformOrigin: "center bottom" }}
                    >
                      <span
                        className={cn(
                          "transition-colors duration-300",
                          isActive ? item.iconColor : "text-foreground/70",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                    </motion.div>
                    <motion.div
                      className={cn(
                        "absolute inset-0 z-10 flex items-center gap-2 rounded-xl bg-transparent px-3 py-2 text-sm transition-colors",
                        isActive ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                      variants={backVariants}
                      transition={sharedTransition}
                      style={{ transformStyle: "preserve-3d", transformOrigin: "center top", rotateX: 90 }}
                    >
                      <span className={cn("transition-colors duration-300", item.iconColor)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                    </motion.div>
                  </motion.div>
                </button>
                {isActive ? (
                  <motion.span
                    layoutId="glow-menu-active"
                    className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-foreground"
                  />
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      </motion.nav>
    );
  },
);

MenuBar.displayName = "MenuBar";
