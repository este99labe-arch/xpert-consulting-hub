import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import AuthLayout from "@/layouts/AuthLayout";
import {
  AuthField, AuthAlert, AuthSubmit, AuthSecondary, AuthLegal,
} from "@/components/auth/AuthControls";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      console.error("Recuperación falló:", err);
      setError(
        err?.status === 429
          ? "Demasiados intentos. Espera un minuto antes de volver a intentarlo."
          : "No se ha podido enviar el enlace. Inténtalo de nuevo en unos segundos.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-[7px]">
        <h1 className="font-display text-[22px] font-semibold tracking-[-.012em] text-figure">
          Recuperar contraseña
        </h1>
        <p className="text-[12.5px] text-muted-foreground">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      {sent ? (
        <div className="mt-7 flex flex-col gap-4">
          {/* El icono va dentro de la alerta, a 14 px: el CheckCircle2 de 48 px
              que había antes competía con el título por la atención. */}
          <AuthAlert tone="success">
            Si existe una cuenta con{" "}
            <span className="text-[12.5px] font-semibold text-foreground">{email}</span>, recibirás un
            correo con instrucciones para restablecer tu contraseña.
          </AuthAlert>
          <AuthSecondary onClick={() => navigate("/login")}>
            <ArrowLeft className="h-3 w-3 stroke-[1.8]" />
            Volver al acceso
          </AuthSecondary>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          {error && <AuthAlert>{error}</AuthAlert>}

          <AuthField
            label="Email"
            icon={Mail}
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />

          <AuthSubmit disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar enlace"
            )}
          </AuthSubmit>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mx-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground transition-colors hover:text-accent-foreground"
          >
            <ArrowLeft className="h-3 w-3 stroke-[1.8]" />
            Volver al acceso
          </button>
        </form>
      )}

      <AuthLegal />
    </AuthLayout>
  );
};

export default ForgotPassword;
