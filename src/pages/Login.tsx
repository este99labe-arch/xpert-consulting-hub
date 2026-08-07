import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ArrowRight, Mail, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import AuthLayout from "@/layouts/AuthLayout";
import {
  AuthField, AuthPasswordField, AuthAlert, AuthSubmit, AuthLegal,
} from "@/components/auth/AuthControls";

/** Los mensajes crudos de Supabase no se enseñan nunca: filtran si el fallo
 *  está en el email o en la contraseña, que es justo lo que no interesa
 *  contarle a quien prueba credenciales ajenas. */
const messageFor = (err: any): string => {
  const status = err?.status ?? err?.originalError?.status;
  if (status === 429) return "Demasiados intentos. Espera un minuto antes de volver a intentarlo.";
  if (err?.name === "AuthRetryableFetchError" || err?.message === "Failed to fetch") {
    return "No se ha podido conectar con el servidor. Inténtalo de nuevo en unos segundos.";
  }
  return "Credenciales incorrectas. Comprueba el email y la contraseña.";
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /* Segundos que quedan de bloqueo por exceso de intentos (429). */
  const [lockedFor, setLockedFor] = useState(0);
  const { signIn, role, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  useEffect(() => {
    if (user && role) navigate("/app/dashboard", { replace: true });
  }, [user, role, navigate]);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      console.error("Login falló:", err);
      const status = err?.status ?? err?.originalError?.status;
      if (status === 429) setLockedFor(60);
      setError(messageFor(err));
      setLoading(false);
    }
  };

  const blocked = loading || lockedFor > 0;

  return (
    <AuthLayout>
      <div className="flex flex-col gap-[7px]">
        <h1 className="font-display text-[22px] font-semibold tracking-[-.012em] text-figure">
          Bienvenido de nuevo
        </h1>
        <p className="text-[12.5px] text-muted-foreground">
          Introduce tus credenciales para acceder al sistema.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
        {expired && !error && (
          <AuthAlert tone="neutral">Tu sesión ha caducado. Vuelve a iniciar sesión.</AuthAlert>
        )}
        {error && <AuthAlert>{error}</AuthAlert>}

        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={blocked}
          autoComplete="email"
        />

        <AuthPasswordField
          label="Contraseña"
          icon={Lock}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={blocked}
          autoComplete="current-password"
        />

        <div className="flex h-10 items-center justify-between">
          {/* TODO: «Mantener sesión» sin efecto todavía. El cliente de Supabase
              es un singleton creado con persistSession + localStorage, así que
              alternar a sessionStorage exige tocar src/integrations/supabase/
              client.ts —fuera del alcance de este trabajo— y afecta a toda la
              app. Se deja visible y desactivado en lugar de fingir que hace algo. */}
          <label className="flex cursor-not-allowed items-center gap-2 text-[11.5px] text-muted-foreground">
            <Checkbox
              checked
              disabled
              aria-label="Mantener sesión"
              className="h-[15px] w-[15px] rounded-[5px]"
            />
            Mantener sesión
          </label>
          <Link
            to="/forgot-password"
            className="text-[11.5px] text-muted-foreground transition-colors hover:text-accent-foreground"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <AuthSubmit disabled={blocked} loading={loading}>
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Iniciando sesión...
            </>
          ) : lockedFor > 0 ? (
            <>
              Espera <span className="tnum">{lockedFor}</span> s
            </>
          ) : (
            <>
              Iniciar sesión
              <ArrowRight className="h-3.5 w-3.5 stroke-[1.8]" />
            </>
          )}
        </AuthSubmit>
      </form>

      <AuthLegal />
    </AuthLayout>
  );
};

export default Login;
