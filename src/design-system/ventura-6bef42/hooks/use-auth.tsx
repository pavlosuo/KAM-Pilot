import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/design-system/ventura-6bef42/integrations/supabase/client";

export type AppRole = "founder" | "investor" | "admin" | "mentor";

export const ACTIVE_ROLE_KEY = "ventura:activeRole";

export function readActiveRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ACTIVE_ROLE_KEY);
  return v === "founder" || v === "investor" || v === "admin" || v === "mentor" ? v : null;
}

export function writeActiveRole(role: AppRole | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) localStorage.setItem(ACTIVE_ROLE_KEY, role);
    else localStorage.removeItem(ACTIVE_ROLE_KEY);
  } catch {
    /* ignore */
  }
}

/** Picks the role to act as: the remembered one when the account still has it. */
export function pickActiveRole(roles: AppRole[], remembered: AppRole | null): AppRole | null {
  if (remembered && roles.includes(remembered)) return remembered;
  if (roles.includes("admin")) return "admin";
  return roles[0] ?? null;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  founder: "Founder",
  investor: "Investor",
  mentor: "Coach",
  admin: "Admin",
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  /** The role the user is currently acting as. */
  role: AppRole | null;
  /** Every role attached to the account. */
  roles: AppRole[];
  loading: boolean;
  setActiveRole: (role: AppRole) => void;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) {
        setRoles([]);
        setRole(null);
        return;
      }
      const list = (data ?? []).map((r) => r.role as AppRole);
      setRoles(list);
      setRole(pickActiveRole(list, readActiveRole()));
    } catch {
      setRoles([]);
      setRole(null);
    }
  };

  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!currentSession) {
          setSession(null);
          setRoles([]);
          setRole(null);
          return;
        }

        setSession(currentSession);
        setLoading(false);
        void fetchRole(currentSession.user.id);
      } catch {
        setSession(null);
        setRoles([]);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return;

      setSession((prev) => {
        const hadSession = Boolean(prev);
        if (s?.user) {
          // Token refreshes fire when the tab regains focus. Flipping `loading`
          // there would unmount the whole authenticated subtree (closing open
          // dialogs), so only block the UI when there was no session before.
          if (!hadSession) setLoading(true);
          // Defer to avoid deadlocks
          setTimeout(() => {
            void fetchRole(s.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setRoles([]);
          setRole(null);
          setLoading(false);
        }
        return s;
      });
    });


    void hydrateAuth();

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    role,
    roles,
    loading,
    setActiveRole: (next: AppRole) => {
      writeActiveRole(next);
      setRole(next);
    },
    refreshRole: async () => {
      if (session?.user) await fetchRole(session.user.id);
    },
    signOut: async () => {
      writeActiveRole(null);
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (typeof window === "undefined") {
      return {
        user: null,
        session: null,
        role: null,
        roles: [] as AppRole[],
        loading: true,
        setActiveRole: () => {},
        refreshRole: async () => {},
        signOut: async () => {},
      };
    }
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
