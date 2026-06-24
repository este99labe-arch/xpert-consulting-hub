import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogIn, Loader2, AlertCircle, Eye, EyeOff,
  FileText, Calculator, Users, ShieldCheck, TrendingUp, ArrowUpRight,
} from "lucide-react";
import logoWhite from "@/assets/brand/logo-horizontal-white.png";
import isoWhite from "@/assets/brand/iso-white.png";
import isoBlue from "@/assets/brand/iso-blue.png";

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
    <div className="relative min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr] bg-[hsl(var(--brand-deep))]">
      {/* ─────────────────────────  BRAND PANEL  ───────────────────────── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16 text-white">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-deep))]" />

        {/* Oversized isotype watermark */}
        <img
          src={isoWhite}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 w-[34rem] opacity-[0.06] select-none"
        />

        {/* Animated decorative orbs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            className="absolute -top-28 -left-20 h-96 w-96 rounded-full bg-[hsl(var(--brand-light))]/25 blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.2 }}
            className="absolute bottom-10 right-0 h-[28rem] w-[28rem] translate-x-1/4 rounded-full bg-[hsl(var(--chart-2))]/15 blur-3xl"
          />
          {/* subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <img src={logoWhite} alt="XpertConsulting" className="h-11 w-auto" />
        </motion.div>

        {/* Headline + features */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative space-y-10"
        >
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
              Tu negocio,<br />bajo control.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/70">
              La plataforma de gestión que reúne facturación, contabilidad y
              equipo en un único panel inteligente.
            </p>
          </div>

          {/* Floating product metric card (hero visual) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-white/60">
                Facturación · este mes
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--success))]/20 px-2 py-0.5 text-[11px] font-semibold text-[hsl(152_69%_75%)]">
                <ArrowUpRight className="h-3 w-3" /> +18,2%
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">48.250 €</span>
            </div>
            {/* mini bars */}
            <div className="mt-4 flex h-12 items-end gap-1.5">
              {[40, 55, 35, 70, 50, 85, 65, 95].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.05 }}
                  className="flex-1 rounded-sm bg-white/40"
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-white/60">
              <TrendingUp className="h-3.5 w-3.5" />
              Datos en tiempo real
            </div>
          </motion.div>

          <ul className="space-y-4">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-white/55">{f.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Trust footer */}
        <div className="relative flex items-center gap-2 text-xs text-white/45">
          <ShieldCheck className="h-3.5 w-3.5" />
          Datos cifrados y conformes con el RGPD
        </div>
      </div>

      {/* ─────────────────────────  FORM PANEL  ───────────────────────── */}
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 lg:min-h-0 lg:rounded-l-[2rem] lg:shadow-2xl">
        {/* subtle brand tint so the panel doesn't feel like an isolated white block */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[hsl(var(--brand))]/[0.04] via-transparent to-[hsl(var(--brand))]/[0.06] lg:rounded-l-[2rem]" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-sm"
        >
          {/* Logo (mobile only) */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <img src={isoBlue} alt="XpertConsulting" className="h-16 w-16 object-contain" />
            <span className="text-xl font-bold tracking-tight">XpertConsulting</span>
          </div>

          <div className="mb-7 space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">Bienvenido de nuevo</h2>
            <p className="text-sm text-muted-foreground">
              Introduce tus credenciales para acceder al sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
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
