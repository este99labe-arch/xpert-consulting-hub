import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

// Routes always allowed (core) regardless of module assignments
const CORE_PATHS = ["/app/dashboard", "/app/attendance", "/app/tasks", "/app/settings"];
// Map route prefix → module code for module gating
const PATH_TO_MODULE: { prefix: string; code: string }[] = [
  { prefix: "/app/clients", code: "CLIENTS" },
  { prefix: "/app/invoices", code: "INVOICES" },
  { prefix: "/app/accounting", code: "ACCOUNTING" },
  { prefix: "/app/hr", code: "HR" },
  { prefix: "/app/inventory", code: "INVENTORY" },
  { prefix: "/app/reports", code: "REPORTS" },
  { prefix: "/app/xpertred", code: "XPERTRED" },
];

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Fetch employee module assignments (only when needed)
  const { data: userModules } = useQuery({
    queryKey: ["protected-user-modules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_modules")
        .select("is_enabled, service_modules(code)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && role === "EMPLOYEE",
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === "MASTER_ADMIN") return <Navigate to="/master/dashboard" replace />;
    return <Navigate to="/app/dashboard" replace />;
  }

  // Module-based guard for EMPLOYEE only
  if (role === "EMPLOYEE" && location.pathname.startsWith("/app")) {
    const isCore = CORE_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
    if (!isCore) {
      const match = PATH_TO_MODULE.find((m) => location.pathname.startsWith(m.prefix));
      if (match) {
        const allowed = (userModules || []).some(
          (um: any) => um.service_modules?.code === match.code && um.is_enabled
        );
        if (!allowed) return <Navigate to="/app/dashboard" replace />;
      }
    }
  }

  return <>{children}</>;
};
