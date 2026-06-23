import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogIn, Loader2, AlertCircle, Eye, EyeOff,
  FileText, Calculator, Users, ShieldCheck,
} from "lucide-react";
import xpertLogo from "@/assets/xpertconsulting-logo.png";

const FEATURES = [
  { icon: FileText, title: "Facturación y VERI*FACTU", desc: "Emite, cobra y registra ante la AEAT." },
  { icon: Calculator, title: "Contabilidad y tesorería", desc: "Asientos automáticos y previsión de caja." },
  { icon: Users, title: "Equipo y clientes", desc: "RRHH, control horario y cartera, en un sitio." },
];

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
      if (role === "MASTER_ADMIN") {
        navigate("/master/dashboard", { replace: true });
      } else {
        navigate("/app/dashboard", { replace: true });
      }
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ───── Brand panel (desktop) ───── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-[hsl(217_55%_22%)] to-sidebar p-12 text-sidebar-foreground">
        {/* Decorative gradients */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-[hsl(var(--chart-2))]/20 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
            <img src={xpertLogo} alt="XpertConsulting" className="h-full w-full object-contain" />
          </div>
          <span className="text-lg font-semibold tracking-tight">XpertConsulting</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative space-y-8"
        >
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Tu negocio,<br />bajo control.
            </h1>
            <p className="max-w-md text-sidebar-foreground/70">
              La plataforma de gestión que reúne facturación, contabilidad y
              equipo en un único panel.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                  <f.icon className="h-4 w-4 text-sidebar-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-sidebar-foreground/60">{f.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <div className="relative flex items-center gap-2 text-xs text-sidebar-foreground/50">
          <ShieldCheck className="h-3.5 w-3.5" />
          Datos cifrados y conformes con el RGPD
        </div>
      </div>

      {/* ───── Form panel ───── */}
      <div className="relative flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Logo (mobile only) */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center">
              <img src={xpertLogo} alt="XpertConsulting" className="h-16 w-16 object-contain" />
            </div>
            <span className="text-xl font-bold tracking-tight">XpertConsulting</span>
          </div>

          <div className="mb-6 space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Bienvenido de nuevo</h2>
            <p className="text-sm text-muted-foreground">
              Introduce tus credenciales para acceder al sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
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
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Button
              type="submit"
              className="h-11 w-full font-medium shadow-md shadow-primary/20"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} XpertConsulting · Todos los derechos reservados
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
