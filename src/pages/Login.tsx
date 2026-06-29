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
import logoWhite from "@/assets/brand/logo-horizontal-white.png";
import isoWhite from "@/assets/brand/iso-white.png";
import isoBlue from "@/assets/brand/iso-blue.png";

const FEATURES = [
  { icon: FileText, title: "Facturación y VERI*FACTU", desc: "Emite, cobra y registra ante la AEAT." },
  { icon: Calculator, title: "Contabilidad y tesorería", desc: "Asientos automáticos y previsión de caja." },
  { icon: Users, title: "Equipo y clientes", desc: "RRHH, control horario y cartera, en un sitio." },
];

// Degradado horizontal: azul a la izquierda (texto legible) -> blanco a la derecha (bajo el formulario).
const PAGE_GRADIENT =
  "linear-gradient(to right, hsl(var(--brand-deep)) 0%, hsl(var(--brand-dark)) 30%, hsl(var(--brand)) 56%, hsl(var(--brand-light)) 82%, hsl(210 30% 97%) 100%)";

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
    <div className="relative min-h-screen overflow-hidden" style={{ background: PAGE_GRADIENT }}>
      {/* ───── Decoración global sobre el azul ───── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Isotipo gigante de marca de agua */}
        <img
          src={isoWhite}
          alt=""
          aria-hidden
          className="absolute -left-24 top-1/3 w-[36rem] opacity-[0.05] select-none"
        />
        {/* Orbes difuminados */}
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
          className="absolute top-1/4 right-0 h-[30rem] w-[30rem] translate-x-1/3 rounded-full bg-[hsl(var(--chart-2))]/15 blur-3xl"
        />
        {/* Rejilla sutil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to right, black 0%, transparent 70%)",
            WebkitMaskImage: "linear-gradient(to right, black 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ───── Contenido ───── */}
      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Lado de marca */}
        <div className="hidden flex-col justify-between p-12 text-white xl:p-16 lg:flex">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <img src={logoWhite} alt="XpertConsulting" className="h-11 w-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-10"
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

            {/* Tarjeta informativa de la empresa */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 shadow-xl backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <img src={isoWhite} alt="" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold">XpertConsulting</p>
                  <p className="text-xs text-white/60">Consultoría &amp; software de gestión</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/75">
                Solución integral para autónomos, pymes y despachos profesionales:
                gestiona toda tu operativa diaria desde una única plataforma.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Multiempresa", "RGPD", "VERI*FACTU"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 ring-1 ring-white/15"
                  >
                    {t}
                  </span>
                ))}
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

          <div className="flex items-center gap-2 text-xs text-white/45">
            <ShieldCheck className="h-3.5 w-3.5" />
            Datos cifrados y conformes con el RGPD
          </div>
        </div>

        {/* Lado del formulario: tarjeta flotante */}
        <div className="flex min-h-screen items-center justify-center px-4 py-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-lg rounded-3xl border border-white/50 bg-background/95 p-8 shadow-2xl backdrop-blur-xl sm:p-12"
          >
            {/* Logo (solo móvil) */}
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <img src={isoBlue} alt="XpertConsulting" className="h-16 w-16 object-contain" />
              <span className="text-xl font-bold tracking-tight">XpertConsulting</span>
            </div>

            <div className="mb-8 space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Bienvenido de nuevo</h2>
              <p className="text-[15px] text-muted-foreground">
                Introduce tus credenciales para acceder al sistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="h-12 text-base"
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
                    className="h-12 pr-10 text-base"
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
                className="mt-1 h-12 w-full text-base font-medium shadow-md shadow-primary/20"
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
    </div>
  );
};

export default Login;
