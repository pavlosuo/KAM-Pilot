import { useEffect, useState } from "react";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";

type Announcement = { id: string; enabled: boolean; message: string; updated_at: string };

export function SiteAnnouncementBanner() {
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("ventura:announcementDismissed");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("site_announcements")
          .select("id, enabled, message, updated_at")
          .limit(1)
          .maybeSingle();
        if (!active) return;
        setAnn((data as Announcement | null) ?? null);
      } catch {
        /* an announcement must never interrupt page rendering */
      }
    };
    void load();
    const channel = supabase
      .channel("site_announcements_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_announcements" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  if (!ann || !ann.enabled || !ann.message.trim()) return null;
  const key = `${ann.id}:${ann.updated_at}`;
  if (dismissedKey === key) return null;

  const onDismiss = () => {
    try {
      window.localStorage.setItem("ventura:announcementDismissed", key);
    } catch {
      // ignore
    }
    setDismissedKey(key);
  };

  return (
    <div className="sticky top-0 z-[60] w-full bg-red-600 text-white shadow-sm">
      <div className="relative flex items-center justify-center px-4 py-2 text-sm">
        <AlertTriangle className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
        <p className="w-full whitespace-pre-wrap break-words px-12 text-center leading-snug">
          {ann.message}
        </p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="absolute right-2 top-1/2 shrink-0 -translate-y-1/2 cursor-pointer rounded-md p-1 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
