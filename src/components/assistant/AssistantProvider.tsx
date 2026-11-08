import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AssistantDialog } from "./AssistantDialog";

interface AssistantApi {
  open: (prompt?: string) => void;
  close: () => void;
}

const Ctx = createContext<AssistantApi | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<{ text: string; nonce: number } | null>(null);
  const nonce = useRef(0);

  const open = useCallback((text?: string) => {
    if (text?.trim()) {
      nonce.current += 1;
      setPrompt({ text: text.trim(), nonce: nonce.current });
    }
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const api = useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <AssistantDialog open={isOpen} onOpenChange={setOpen} pendingPrompt={prompt} />
    </Ctx.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
