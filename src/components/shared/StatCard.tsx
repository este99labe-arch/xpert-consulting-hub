import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Intención semántica del dato, NO un color suelto. */
export type StatTone = "default" | "primary" | "success" | "warning" | "destructive";

const TONE_VALUE: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-[hsl(var(--success))]",
  warning: "text-[hsl(var(--warning))]",
  destructive: "text-destructive",
};

const TONE_ICON: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  destructive: "bg-destructive/10 text-destructive",
};

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
        "p-4 shadow-sm",
        interactive &&
          "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE_ICON[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className={cn("text-2xl font-bold tracking-tight tabular-nums", TONE_VALUE[tone])}>{value}</p>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
};

export default StatCard;
