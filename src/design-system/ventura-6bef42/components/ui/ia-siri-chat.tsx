"use client";

import { Mic, Volume2, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

interface VoiceChatProps {
  onStart?: () => void;
  onStop?: (duration: number) => void;
  onVolumeChange?: (volume: number) => void;
  className?: string;
  demoMode?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocity: { x: number; y: number };
}

export function VoiceChat({
  onStart,
  onStop,
  onVolumeChange,
  className,
  demoMode = true,
}: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [duration, setDuration] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>(Array(32).fill(0));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 400,
        y: Math.random() * 400,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.3 + 0.1,
        velocity: {
          x: (Math.random() - 0.5) * 0.5,
          y: (Math.random() - 0.5) * 0.5,
        },
      });
    }
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const animateParticles = () => {
      setParticles((prev) =>
        prev.map((particle) => ({
          ...particle,
          x: (particle.x + particle.velocity.x + 400) % 400,
          y: (particle.y + particle.velocity.y + 400) % 400,
          opacity: particle.opacity + (Math.random() - 0.5) * 0.02,
        })),
      );
      animationRef.current = requestAnimationFrame(animateParticles);
    };
    animationRef.current = requestAnimationFrame(animateParticles);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
        const newWaveform = Array(32)
          .fill(0)
          .map(() => Math.random() * (isListening ? 100 : 20));
        setWaveformData(newWaveform);
        const newVolume = Math.random() * 100;
        setVolume(newVolume);
        onVolumeChange?.(newVolume);
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setWaveformData(Array(32).fill(0));
      setVolume(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isListening, onVolumeChange]);

  useEffect(() => {
    if (!demoMode) return;
    let cancelled = false;
    const demoSequence = async () => {
      if (cancelled) return;
      setIsListening(true);
      onStart?.();
      await new Promise((r) => setTimeout(r, 3000));
      if (cancelled) return;
      setIsListening(false);
      setIsProcessing(true);
      onStop?.(duration);
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelled) return;
      setIsProcessing(false);
      setIsSpeaking(true);
      await new Promise((r) => setTimeout(r, 4000));
      if (cancelled) return;
      setIsSpeaking(false);
      setDuration(0);
      setTimeout(demoSequence, 2000);
    };
    const timeout = setTimeout(demoSequence, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [demoMode, onStart, onStop, duration]);

  const handleToggleListening = () => {
    if (demoMode) return;
    if (isListening) {
      setIsListening(false);
      onStop?.(duration);
      setDuration(0);
    } else {
      setIsListening(true);
      onStart?.();
    }
  };


  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-background relative overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 bg-primary/20 rounded-full"
            style={{ left: particle.x, top: particle.y, opacity: particle.opacity }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-96 h-96 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl"
          animate={{
            scale: isListening ? [1, 1.2, 1] : [1, 1.1, 1],
            opacity: isListening ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className={cn("relative z-10 flex flex-col items-center space-y-8", demoMode ? "pt-10" : "pt-0")}>
        <div className="text-center">
          <span className="text-sm font-medium text-foreground">
            {isListening
              ? "Listening..."
              : isProcessing
                ? "Processing..."
                : isSpeaking
                  ? "Speaking..."
                  : "Tap to record"}
          </span>
        </div>

        <motion.div className="relative" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <motion.button
            onClick={handleToggleListening}
            className={cn(
              "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer",
              "bg-gradient-to-br from-primary/20 to-primary/10 border-2",
              isListening
                ? "border-foreground shadow-lg shadow-foreground/25"
                : isProcessing
                  ? "border-yellow-500 shadow-lg shadow-yellow-500/25"
                  : isSpeaking
                    ? "border-green-500 shadow-lg shadow-green-500/25"
                    : "border-border hover:border-primary/50",
            )}
            animate={{
              boxShadow: isListening
                ? ["0 0 0 0 rgba(0, 0, 0, 0.4)", "0 0 0 20px rgba(0, 0, 0, 0)"]
                : undefined,
            }}
            transition={{ duration: 1.5, repeat: isListening ? Infinity : 0 }}
          >
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
                </motion.div>
              ) : isSpeaking ? (
                <motion.div
                  key="speaking"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Volume2 className="w-12 h-12 text-green-500" />
                </motion.div>
              ) : isListening ? (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Mic className="w-12 h-12 text-foreground" />
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Mic className="w-12 h-12 text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <AnimatePresence>
            {isListening && (
              <>
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-foreground/30"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-foreground/20"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex items-center justify-center space-x-1 h-16">
          {waveformData.map((height, index) => (
            <motion.div
              key={index}
              className={cn(
                "w-1 rounded-full transition-colors duration-300",
                isListening
                  ? "bg-foreground"
                  : isProcessing
                    ? "bg-yellow-500"
                    : isSpeaking
                      ? "bg-green-500"
                      : "bg-muted",
              )}
              animate={{
                height: `${Math.max(4, height * 0.6)}px`,
                opacity: isListening || isSpeaking ? 1 : 0.3,
              }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VoiceChatDemo() {
  return (
    <VoiceChat
      onStart={() => console.log("Voice recording started")}
      onStop={(duration) => console.log(`Voice recording stopped after ${duration}s`)}
      onVolumeChange={(volume) => console.log(`Volume: ${volume}%`)}
      demoMode={true}
    />
  );
}
