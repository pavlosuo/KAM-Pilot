export function DictationWaveform({ className = "" }: { className?: string }) {
  const bars = Array.from({ length: 28 });
  return (
    <div
      className={`flex h-full w-full items-center justify-center gap-1 ${className}`}
      aria-label="Recording audio"
      role="img"
    >
      {bars.map((_, i) => (
        <span
          key={i}
          className="inline-block w-1 rounded-full bg-primary/70"
          style={{
            animation: `dictation-wave 1s ease-in-out ${i * 60}ms infinite`,
            height: "20%",
          }}
        />
      ))}
      <style>{`
        @keyframes dictation-wave {
          0%, 100% { height: 15%; opacity: 0.5; }
          50% { height: 80%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
