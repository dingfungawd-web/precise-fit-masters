import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (loginId: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => checkUser(s.user.id), 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) checkUser(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function checkUser(userId: string) {
    // Block inactive users
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.status === "inactive") {
      await supabase.auth.signOut();
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setIsAdmin(!!data?.some((r) => r.role === "admin"));
  }

  async function resolveEmail(loginId: string): Promise<string | null> {
    const trimmed = loginId.trim();
    if (trimmed.includes("@")) return trimmed;
    const { data, error } = await supabase.rpc("get_email_by_employee_id", {
      _employee_id: trimmed,
    });
    if (error) return null;
    return (data as string | null) ?? null;
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isAdmin,
    signIn: async (loginId, password) => {
      const email = await resolveEmail(loginId);
      if (!email) {
        return { error: "員工編號不存在或帳號已停用" };
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      // Double-check status after login
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (profile?.status === "inactive") {
          await supabase.auth.signOut();
          return { error: "此帳號已停用" };
        }
      }
      return { error: null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
