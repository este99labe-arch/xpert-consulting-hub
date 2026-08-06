import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tarjeta de Midnight: fondo `card`, borde de 1 px y radio de 14 px.
 *
 * Sin sombra a propósito — la jerarquía la dan los cuatro niveles de
 * superficie (rail → lienzo → tarjeta → elevado) y el borde. Solo diálogos y
 * popovers llevan sombra.
 *
 * `tone` cubre las dos tarjetas de aviso del dossier, que sí se tiñen porque
 * comunican estado: alerta (vencido) y aviso (vence pronto).
 */
const toneClasses = {
  default: "border-border bg-card",
  alert: "border-destructive-border bg-[linear-gradient(140deg,hsl(var(--destructive-surface)),hsl(var(--muted))_70%)]",
  warning: "border-warning-border bg-[linear-gradient(140deg,hsl(var(--warning-surface)),hsl(var(--card))_70%)]",
  /** Tarjeta protagonista del dashboard y del fichaje. */
  feature: "border-border bg-[linear-gradient(160deg,hsl(var(--row-selected))_0%,hsl(var(--card))_60%)]",
} as const;

export type CardTone = keyof typeof toneClasses;

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { tone?: CardTone }>(
  ({ className, tone = "default", ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border text-card-foreground", toneClasses[tone], className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 px-[18px] pb-3 pt-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

/** Título de tarjeta: 12,5 px / 600 Inter. No confundir con el de pantalla. */
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-[12.5px] font-semibold leading-none text-foreground", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[11.5px] leading-[1.6] text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-[18px] pb-4", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center px-[18px] pb-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
