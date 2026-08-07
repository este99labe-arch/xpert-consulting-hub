import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock } from "lucide-react";
import AuthLayout from "@/layouts/AuthLayout";
import {
  AuthPasswordField, AuthAlert, AuthSubmit, AuthLegal, PasswordStrength,
} from "@/components/auth/AuthControls";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });

    // El enlace del correo llega con el token en el hash
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err: any) {
      console.error("Cambio de contraseña falló:", err);
      setError("No se ha podido actualizar la contraseña. Vuelve a pedir el enlace del correo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-[7px]">
        <h1 className="font-display text-[22px] font-semibold tracking-[-.012em] text-figure">
          Nueva contraseña
        </h1>
        <p className="text-[12.5px] text-muted-foreground">Introduce tu nueva contraseña.</p>
      </div>

      {success ? (
        <div className="mt-7">
          <AuthAlert tone="success">
            Tu contraseña ha sido actualizada correctamente. Redirigiendo al acceso...
          </AuthAlert>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          {error && <AuthAlert>{error}</AuthAlert>}
          {!isRecovery && (
            <AuthAlert tone="neutral">
              No se detectó un enlace de recuperación válido. Asegúrate de usar el enlace del correo.
            </AuthAlert>
          )}

          <div className="flex flex-col gap-2.5">
            <AuthPasswordField
              label="Nueva contraseña"
              icon={Lock}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
            <PasswordStrength value={password} />
          </div>

          <AuthPasswordField
            label="Confirmar contraseña"
            icon={Lock}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
          />

          <AuthSubmit disabled={loading || !isRecovery}>
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Actualizando...
              </>
            ) : (
              "Actualizar contraseña"
            )}
          </AuthSubmit>
        </form>
      )}

      <AuthLegal />
    </AuthLayout>
  );
};

export default ResetPassword;
