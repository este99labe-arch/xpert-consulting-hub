import { ReactNode } from "react";
import { FileText, Calculator, Users, ShieldCheck } from "lucide-react";
import logoWhite from "@/assets/brand/logo-horizontal-white.png";
import isoWhite from "@/assets/brand/iso-white.png";

const FEATURES = [
  { icon: FileText, title: "Facturación y VERI*FACTU", desc: "Emite, cobra y registra ante la AEAT." },
  { icon: Calculator, title: "Contabilidad y tesorería", desc: "Asientos automáticos y previsión de caja." },
  { icon: Users, title: "Equipo y clientes", desc: "RRHH, control horario y cartera, en un sitio." },
];

/**
 * Panel de marca. Solo a partir de `lg`: por debajo, el formulario ocupa todo
 * el ancho y la marca se reduce al logotipo sobre él.
 */
const BrandPanel = () => (
  <aside className="relative hidden overflow-hidden bg-sidebar px-[52px] py-11 lg:flex lg:justify-center">
    {/* Halo: el único degradado que admite el sistema, y es monocromo azul
        sobre negro, no un degradado de marca. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(620px 420px at 12% 0%, hsl(var(--primary) / .13), transparent 70%)",
      }}
    />
    <img
      src={isoWhite}
      alt=""
      aria-hidden
      className="pointer-events-none absolute -bottom-[120px] -right-[140px] w-[520px] select-none opacity-[.035]"
    />

    {/* El contenido se limita a 520px y se centra en la columna: en una
        pantalla ancha, dejarlo pegado al borde izquierdo lo alejaría
        demasiado del formulario. */}
    <div className="relative flex w-full max-w-[520px] flex-col justify-between">
    <img src={logoWhite} alt="XpertConsulting" className="h-[30px] w-auto self-start" />

    <div className="flex max-w-[430px] flex-col gap-[34px]">
      <div className="flex flex-col gap-3">
        {/* Reclamo de marca, no el título de la página: el <h1> lo lleva el
            formulario, que es a lo que se viene aquí y está en todos los
            tamaños de pantalla. Ver nota de accesibilidad más abajo. */}
        <p className="font-display text-[40px] font-semibold leading-[1.1] tracking-[-.022em] text-figure">
          Tu negocio,
          <br />
          bajo control.
        </p>
        <p className="max-w-[360px] text-[13px] leading-[1.65] text-muted-foreground">
          La plataforma de gestión que reúne facturación, contabilidad y equipo en un único
          panel inteligente.
        </p>
      </div>

      <ul>
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="flex items-start gap-[13px] border-t border-border-subtle py-[11px] last:border-b"
          >
            <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border-strong bg-secondary">
              <f.icon className="h-3.5 w-3.5 stroke-[1.8] text-accent-foreground" />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">{f.title}</p>
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
  </aside>
);

/**
 * Lienzo común de las pantallas de acceso.
 *
 * Existe para que las cinco compartan panel de marca y columna de formulario
 * sin repetirlo cinco veces; lo único que cambia entre ellas es el contenido
 * de la derecha.
 */
const AuthLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <div className="grid min-h-screen w-full lg:grid-cols-[1fr_452px]">
      <BrandPanel />
      <main className="flex flex-col justify-center px-6 py-11 sm:px-10">
        <div className="mx-auto w-full max-w-[372px]">
          <img src={logoWhite} alt="XpertConsulting" className="mb-9 h-[26px] w-auto lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  </div>
);

export default AuthLayout;
