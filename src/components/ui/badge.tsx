import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge de estado de Midnight: radio 5-6 px, 10 px / 600, con terna propia de
 * texto, superficie y borde.
 *
 * Los cinco estados del sistema son `success` (pagada, conciliado, activo),
 * `softDestructive` (vencida), `warning` (pendiente, vacaciones), `info`
 * (enviada) y `muted` (borrador). Los nombres se conservan porque ya hay
 * decenas de llamadas en la app; lo que cambia es su aspecto.
 *
 * El estado nunca se comunica solo por color: el badge siempre lleva texto.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-chip border px-2 py-[3px] text-[10px] font-semibold leading-none transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border-strong bg-secondary text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-input text-muted-foreground",

        /** Pagada · Conciliado · Activo */
        success: "border-success-border bg-success-foreground text-success",
        /** Vencida */
        softDestructive: "border-destructive-border bg-destructive-surface text-destructive-text",
        /** Pendiente · Vacaciones */
        warning: "border-warning-border bg-warning-surface text-warning-text",
        /** Enviada */
        info: "border-info-border bg-accent text-info-text",
        /** Borrador */
        muted: "border-border-strong bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
