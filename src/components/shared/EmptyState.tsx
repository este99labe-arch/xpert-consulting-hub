import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** bare: sin tarjeta contenedora (para celdas de tabla o dentro de otra Card) */
  bare?: boolean;
}

/**
 * Estado vacío estándar de la aplicación (icono + título + descripción + CTA).
 * Usar en toda lista/tabla sin resultados para mantener consistencia.
 */
const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction, bare }: EmptyStateProps) => {
  const inner = (
    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (bare) return inner;
  return (
    <Card>
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  );
};

export default EmptyState;
