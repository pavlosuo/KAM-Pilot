"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type RefObject, useRef, useState } from "react";
import type { ButtonProps } from "@/design-system/ventura-6bef42/components/ui/button";
import { Button } from "@/design-system/ventura-6bef42/components/ui/button";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface ParticleButtonProps extends ButtonProps {
  onSuccess?: () => void;
  successDuration?: number;
}

function SuccessParticles({
  buttonRef,
}: {
  buttonRef: RefObject<HTMLButtonElement>;
}) {
  const rect = buttonRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return (
    <AnimatePresence>
      {[...Array(6)].map((_, i) => (
        <motion.div
          animate={{
            scale: [0, 1, 0],
            x: [0, (i % 2 ? 1 : -1) * (Math.random() * 50 + 20)],
            y: [0, -Math.random() * 50 - 20],
          }}
          className="pointer-events-none fixed z-[100] h-1 w-1 rounded-full bg-foreground"
          initial={{ scale: 0, x: 0, y: 0 }}
          key={i}
          style={{ left: centerX, top: centerY }}
          transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
        />
      ))}
    </AnimatePresence>
  );
}

export default function ParticleButton({
  children,
  onClick,
  onSuccess,
  successDuration = 1000,
  className,
  ...props
}: ParticleButtonProps) {
  const [showParticles, setShowParticles] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // fire immediately, before any async work in onClick resolves
    setShowParticles(true);
    window.setTimeout(() => {
      setShowParticles(false);
      onSuccess?.();
    }, successDuration);
    onClick?.(e);
  };

  return (
    <>
      {showParticles && (
        <SuccessParticles buttonRef={buttonRef as RefObject<HTMLButtonElement>} />
      )}
      <Button
        className={cn(
          "relative transition-transform duration-100",
          showParticles && "scale-95",
          className
        )}
        data-particles="true"
        onClick={handleClick}
        ref={buttonRef}
        {...props}
      >
        {children}
      </Button>
    </>
  );
}
