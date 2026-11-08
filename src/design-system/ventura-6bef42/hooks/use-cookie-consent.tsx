import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

type Consent = "accepted" | "rejected" | null;

type CookieConsentContextValue = {
  consent: Consent;
  accept: () => void;
  reject: () => void;
  open: () => void;
  close: () => void;
  isOpen: boolean;
  /** True when the user has rejected non-essential tracking. Use to gate analytics + personalization. */
  isRejected: boolean;
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

const STORAGE_KEY = "cookie-consent";

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<Consent>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Consent;
      if (stored === "accepted" || stored === "rejected") {
        setConsent(stored);
      } else {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  }, []);

  const accept = useCallback(() => {
    setConsent("accepted");
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
    setIsOpen(false);
  }, []);

  const reject = useCallback(() => {
    setConsent("rejected");
    try { localStorage.setItem(STORAGE_KEY, "rejected"); } catch {}
    setIsOpen(false);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <CookieConsentContext.Provider
      value={{ consent, accept, reject, open, close, isOpen, isRejected: consent === "rejected" }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  return ctx;
}
