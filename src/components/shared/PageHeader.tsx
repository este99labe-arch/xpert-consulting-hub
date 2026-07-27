import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Botones o controles alineados a la derecha del título. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabecera estándar de página (título + descripción + acciones).
 *
 * Es la ÚNICA forma correcta de titular una página: fija la escala tipográfica
 * y el ritmo vertical para que todas las pantallas se vean iguales. No escribas
 * un <h1> a mano ni cambies los tamaños aquí desde fuera.
 */
const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <div
    className={cn(
      "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0 space-y-1">
      <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
