import { forwardRef, useId, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Controles de las pantallas de acceso.
 *
 * Viven aparte de `components/ui` a propósito: el campo de auth mide 40 px y
 * el de la app 32 px, y el resto de la aplicación depende de esa altura. En
 * vez de añadir variantes que habría que recordar usar solo aquí, auth tiene
 * sus propios controles y `input.tsx` se queda como está.
 */

const FIELD =
  "h-10 w-full rounded-control border border-input bg-muted text-[12.5px] text-foreground transition-colors duration-120 " +
  "placeholder:text-faint focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/[.16] " +
  "disabled:cursor-not-allowed disabled:text-muted-foreground";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  /** Icono decorativo a la derecha (p. ej. el candado del email bloqueado). */
  trailingIcon?: LucideIcon;
}

export const AuthField = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, icon: Icon, trailingIcon: Trailing, className, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="flex flex-col gap-[7px]">
        <label htmlFor={fieldId} className="text-[11px] font-medium text-muted-foreground">
          {label}
        </label>
        <div className="relative">
          {Icon && (
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.8] text-faint" />
          )}
          <input
            ref={ref}
            id={fieldId}
            className={cn(FIELD, Icon ? "pl-[33px] pr-3" : "px-3", Trailing && "pr-9", className)}
            {...props}
          />
          {Trailing && (
            <Trailing className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 stroke-[1.8] text-faint" />
          )}
        </div>
      </div>
    );
  },
);
AuthField.displayName = "AuthField";

interface PasswordProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
}

/** Campo de contraseña con conmutador de visibilidad. */
export const AuthPasswordField = forwardRef<HTMLInputElement, PasswordProps>(
  ({ label, icon: Icon, className, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="flex flex-col gap-[7px]">
        <label htmlFor={fieldId} className="text-[11px] font-medium text-muted-foreground">
          {label}
        </label>
        <div className="relative">
          {Icon && (
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.8] text-faint" />
          )}
          <input
            ref={ref}
            id={fieldId}
            type={visible ? "text" : "password"}
            className={cn(
              FIELD,
              Icon ? "pl-[33px]" : "pl-3",
              "pr-9",
              // Oculta, la contraseña se lee mejor espaciada y en mono
              !visible && "font-mono text-[13px] tracking-[.12em]",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-muted-foreground"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5 stroke-[1.8]" /> : <Eye className="h-3.5 w-3.5 stroke-[1.8]" />}
          </button>
        </div>
      </div>
    );
  },
);
AuthPasswordField.displayName = "AuthPasswordField";

const ALERT_TONES = {
  error: {
    box: "border-destructive-border bg-destructive-surface text-destructive-text",
    icon: "text-destructive-text",
    Icon: AlertCircle,
  },
  success: {
    box: "border-success-border bg-success-foreground text-success",
    icon: "text-success",
    Icon: CheckCircle2,
  },
  neutral: {
    box: "border-border bg-muted text-muted-foreground",
    icon: "text-faint",
    Icon: Info,
  },
} as const;

export const AuthAlert = ({
  tone = "error", children,
}: { tone?: keyof typeof ALERT_TONES; children: ReactNode }) => {
  const t = ALERT_TONES[tone];
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn("flex items-start gap-2 rounded-control border px-3 py-2.5 text-[11.5px] leading-[1.5]", t.box)}
    >
      <t.Icon className={cn("mt-px h-3.5 w-3.5 shrink-0 stroke-[1.8]", t.icon)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** Botón principal del formulario: ancho completo y 42 px. */
export const AuthSubmit = ({
  children, loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
  <button
    type="submit"
    className={cn(
      "flex h-[42px] w-full items-center justify-center gap-2 rounded-control bg-primary text-[12.5px] font-semibold text-primary-foreground",
      "transition-colors duration-120 hover:bg-primary-hover",
      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
      "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-faint",
    )}
    {...props}
  >
    {children}
  </button>
);

/** Botón secundario de auth (volver al acceso, etc.). */
export const AuthSecondary = ({
  children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={cn(
      "flex h-10 w-full items-center justify-center gap-2 rounded-control border border-border-strong bg-secondary text-[12.5px] font-medium text-foreground",
      "transition-colors duration-120 hover:bg-[hsl(var(--row-selected))]",
      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
    )}
    {...props}
  >
    {children}
  </button>
);

/**
 * Medidor de robustez de contraseña.
 *
 * Cuenta cuatro criterios cumplidos —longitud, mayúscula, dígito y símbolo—
 * en vez de puntuar la entropía: es lo que el usuario puede corregir mirando
 * el resultado, y evita prometer seguridad que no medimos.
 */
export const PasswordStrength = ({ value }: { value: string }) => {
  if (!value) return null;

  const checks = [
    value.length >= 6,
    /[A-ZÁÉÍÓÚÑ]/.test(value),
    /\d/.test(value),
    /[^\w\s]/.test(value),
  ];
  const score = checks.filter(Boolean).length;
  const label = score <= 1 ? "DÉBIL" : score <= 3 ? "MEDIA" : "FUERTE";

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] flex-1 rounded-[5px] transition-colors duration-120",
              i < score ? "bg-primary" : "bg-chart-track",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-muted-foreground" aria-live="polite">
        {label}
      </span>
    </div>
  );
};

/** Pie legal, común a las cinco pantallas. */
export const AuthLegal = () => (
  <p className="mt-7 border-t border-border-subtle pt-5 text-center text-[11px] text-faint">
    © {new Date().getFullYear()} XpertConsulting · Todos los derechos reservados
  </p>
);
