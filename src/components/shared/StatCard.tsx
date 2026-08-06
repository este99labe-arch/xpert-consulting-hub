import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Intención semántica del dato, NO un color suelto. */
export type StatTone = "default" | "primary" | "success" | "warning" | "destructive";

const TONE_VALUE: Record<StatTone, string> = {
  default: "text-figure",
  primary: "text-accent-foreground",
  success: "text-success",
  warning: "text-warning-text",
  destructive: "text-destructive-text",
};

/* El icono va SIEMPRE neutro: en Midnight el color es estado, no decoración.
   Quien lleva la semántica es la cifra. */
const ICON_BOX = "bg-muted text-faint";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Semántica del valor: usa esto en lugar de clases de color sueltas. */
  tone?: StatTone;
  /** Texto secundario bajo el valor (variación, contexto...). */
  hint?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Tarjeta de métrica estándar.
 *
 * Usa `tone` (semántico) en vez de clases de color: así las métricas mantienen
 * la misma paleta en toda la app y siguen funcionando en modo oscuro.
 */
const StatCard = ({
  label, value, icon: Icon, tone = "default", hint, onClick, className,
}: StatCardProps) => {
  const interactive = !!onClick;
  return (
    <Card
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "px-[18px] py-4",
        interactive &&
          "cursor-pointer transition-colors duration-150 hover:bg-popover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-control", ICON_BOX)}>
            <Icon className="h-3.5 w-3.5 stroke-[1.8]" />
          </div>
        )}
      </div>
      <p className={cn("tnum text-[22px] font-semibold tracking-[-.02em]", TONE_VALUE[tone])}>{value}</p>
      {hint && <div className="mt-1 text-[10.5px] text-muted-foreground">{hint}</div>}
    </Card>
  );
};

export default StatCard;
