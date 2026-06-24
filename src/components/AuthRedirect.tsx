import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const AuthRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Todos los roles entran al panel de aplicación; el panel Master sigue
  // accesible desde el enlace lateral para MASTER_ADMIN.
  return <Navigate to="/app/dashboard" replace />;
};
