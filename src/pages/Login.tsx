import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogIn, Loader2, AlertCircle, Eye, EyeOff,
  FileText, Calculator, Users, ShieldCheck,
} from "lucide-react";
import logoWhite from "@/assets/brand/logo-horizontal-white.png";

const FEATURES = [
  { icon: FileText, title: "Facturación y VERI*FACTU", desc: "Emite, cobra y registra ante la AEAT." },
  { icon: Calculator, title: "Contabilidad y tesorería", desc: "Asientos automáticos y previsión de caja." },
  { icon: Users, title: "Equipo y clientes", desc: "RRHH, control horario y cartera, en un sitio." },
];

/**
 * Acceso en Midnight.
 *
 * El degradado azul a blanco de antes chocaba de frente con el tema: la app
 * entera es oscura y el login era lo único claro. Ahora la marca se sostiene
 * con el logotipo en negativo y un único acento azul, igual que el resto.
 */
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, role, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl px-6 lg:grid-cols-[1fr_400px] lg:gap-16">
        {/* ── Lado de marca ──────────────────────────────────────── */}
        <div className="hidden flex-col justify-between py-14 lg:flex">
          <img src={logoWhite} alt="XpertConsulting" className="h-8 w-auto self-start" />

          <div className="space-y-9">
            <div className="space-y-3">
              <h1 className="font-display text-[34px] font-semibold leading-[1.12] tracking-[-.02em] text-foreground">
                Tu negocio,
                <br />
                bajo control.
              </h1>
              <p className="max-w-sm text-[12.5px] leading-[1.6] text-muted-foreground">
                La plataforma de gestión que reúne facturación, contabilidad y equipo en un
                único panel inteligente.
              </p>
            </div>

            <ul className="space-y-px">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3 rounded-control px-3 py-3">
                  <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border-strong bg-secondary">
                    <f.icon className="h-3.5 w-3.5 stroke-[1.8] text-accent-foreground" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{f.title}</p>
                    <p className="text-[11.5px] leading-[1.6] text-muted-foreground">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2 text-[11.5px] text-subtle">
            <ShieldCheck className="h-3.5 w-3.5 stroke-[1.8] text-faint" />
            Datos cifrados y conformes con el RGPD
          </div>
        </div>

        {/* ── Formulario ─────────────────────────────────────────── */}
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-[400px] rounded-lg border border-border bg-card px-7 py-8">
            <img src={logoWhite} alt="XpertConsulting" className="mb-8 h-7 w-auto lg:hidden" />

            <div className="mb-7 space-y-1.5">
              <h2 className="font-display text-[21px] font-semibold tracking-[-.01em] text-foreground">
                Bienvenido de nuevo
              </h2>
              <p className="text-[12.5px] leading-[1.6] text-muted-foreground">
                Introduce tus credenciales para acceder al sistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-control border border-destructive-border bg-destructive-surface px-3 py-2.5 text-[11.5px] leading-[1.5] text-destructive-text"
                >
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 stroke-[1.8]" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-medium text-muted-foreground">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-muted-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-[11.5px] text-muted-foreground transition-colors hover:text-accent-foreground"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </form>

            <p className="mt-7 text-center text-[11px] text-faint">
              © {new Date().getFullYear()} XpertConsulting · Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
