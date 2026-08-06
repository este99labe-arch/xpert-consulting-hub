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
      "flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0 space-y-1">
      <h1 className="truncate font-display text-[17px] font-semibold tracking-[-.01em] text-foreground">{title}</h1>
      {description && <p className="text-[11.5px] leading-[1.6] text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
