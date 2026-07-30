import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type UserRole = "MASTER_ADMIN" | "MANAGER" | "EMPLOYEE" | null;

/** Sesión de soporte activa: el admin está operando dentro de una cuenta cliente. */
export interface SupportSession {
  accountId: string;
  accountName: string;
  reason: string | null;
  expiresAt: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole;
  /** Cuenta activa. Durante una sesión de soporte es la cuenta suplantada. */
  accountId: string | null;
  /** Cuenta propia del usuario, ignorando la suplantación. */
  realAccountId: string | null;
  supportSession: SupportSession | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  startSupportSession: (accountId: string, reason?: string) => Promise<void>;
  endSupportSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    accountId: null,
    realAccountId: null,
    supportSession: null,
    loading: true,
  });

  /** Sesión de soporte vigente del usuario actual (null si no hay). */
  const fetchSupportSession = async (): Promise<SupportSession | null> => {
    const { data, error } = await (supabase.rpc as any)("current_support_session");
    if (error || !data || data.length === 0) return null;
    const row = data[0];
    return {
      accountId: row.account_id,
      accountName: row.account_name,
      reason: row.reason ?? null,
      expiresAt: row.expires_at,
    };
  };

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_accounts")
      .select("account_id, role_id, roles(code)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (error || !data) {
      return { role: null as UserRole, accountId: null, realAccountId: null, supportSession: null };
    }

    const roleCode = (data as any).roles?.code as UserRole;
    const realAccountId = data.account_id;

    // Solo un MASTER_ADMIN puede tener sesión de soporte; para el resto ni se consulta.
    const supportSession = roleCode === "MASTER_ADMIN" ? await fetchSupportSession() : null;

    return {
      role: roleCode,
      // La cuenta activa manda: así todas las consultas .eq("account_id", …)
      // apuntan a la misma cuenta que ya autoriza RLS.
      accountId: supportSession?.accountId ?? realAccountId,
      realAccountId,
      supportSession,
    };
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(async () => {
            const info = await fetchUserRole(session.user.id);
            setState({
              session,
              user: session.user,
              ...info,
              loading: false,
            });
          }, 0);
        } else {
          setState({
            session: null,
            user: null,
            role: null,
            accountId: null,
            realAccountId: null,
            supportSession: null,
            loading: false,
          });
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const info = await fetchUserRole(session.user.id);
        setState({
          session,
          user: session.user,
          ...info,
          loading: false,
        });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  /** Relee rol y cuenta activa tras entrar/salir de una sesión de soporte. */
  const refreshAccountContext = async () => {
    if (!state.user) return;
    const info = await fetchUserRole(state.user.id);
    setState((prev) => ({ ...prev, ...info }));
  };

  const startSupportSession = async (accountId: string, reason?: string) => {
    const { error } = await (supabase.rpc as any)("start_support_session", {
      _account_id: accountId,
      _reason: reason ?? null,
    });
    if (error) throw error;
    await refreshAccountContext();
    // La caché guarda datos de la cuenta anterior: hay que vaciarla entera o
    // se mostrarían mezclados con los de la cuenta a la que entramos.
    queryClient.clear();
  };

  const endSupportSession = async () => {
    const { error } = await (supabase.rpc as any)("end_support_session");
    if (error) throw error;
    await refreshAccountContext();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signOut, startSupportSession, endSupportSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};
