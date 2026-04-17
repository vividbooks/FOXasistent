import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";

export type AppRole = "ADMIN" | "EMPLOYEE";

type Meta = {
  app_user_id?: string;
  role?: string;
  name?: string;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  appUserId: string | null;
  role: AppRole | null;
  displayName: string | null;
};

const AuthCtx = createContext<
  AuthState & {
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
  }
 | null>(null);

function readMeta(session: Session | null): Pick<AuthState, "appUserId" | "role" | "displayName"> {
  if (!session?.user) {
    return { appUserId: null, role: null, displayName: null };
  }
  const m = session.user.user_metadata as Meta | undefined;
  const r = m?.role === "ADMIN" || m?.role === "EMPLOYEE" ? m.role : null;
  return {
    appUserId: m?.app_user_id ?? null,
    role: r,
    displayName: m?.name ?? session.user.email ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setSession(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setSession(data.session ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabaseConfigured) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    if (supabaseConfigured) await supabase.auth.signOut();
    setSession(null);
  }, []);

  const meta = readMeta(session);

  const value = useMemo(
    () => ({
      loading,
      session,
      ...meta,
      signOut,
      refresh,
    }),
    [loading, session, meta.appUserId, meta.role, meta.displayName, signOut, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
