import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const AuthRedirect: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === "MASTER_ADMIN") return <Navigate to="/master/dashboard" replace />;
  return <Navigate to="/app/dashboard" replace />;
};
