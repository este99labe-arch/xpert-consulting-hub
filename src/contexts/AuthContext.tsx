import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type UserRole = "MASTER_ADMIN" | "MANAGER" | "EMPLOYEE" | null;

interface AuthState {
  session: Session | null;
  user: User | null;
  role: UserRole;
  accountId: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    accountId: null,
    loading: true,
  });

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_accounts")
      .select("account_id, role_id, roles(code)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (error || !data) return { role: null as UserRole, accountId: null };

    const roleCode = (data as any).roles?.code as UserRole;
    return { role: roleCode, accountId: data.account_id };
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(async () => {
            const { role, accountId } = await fetchUserRole(session.user.id);
            setState({
              session,
              user: session.user,
              role,
              accountId,
              loading: false,
            });
          }, 0);
        } else {
          setState({
            session: null,
            user: null,
            role: null,
            accountId: null,
            loading: false,
          });
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { role, accountId } = await fetchUserRole(session.user.id);
        setState({
          session,
          user: session.user,
          role,
          accountId,
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

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
