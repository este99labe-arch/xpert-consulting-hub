import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botón de Midnight: 30 px de alto, radio 8 px, texto de 12 px / 600.
 *
 * El foco nunca se anula — borde primary más anillo de 3 px al 16 %— y el
 * deshabilitado no baja la opacidad, sino que cambia a superficie secundaria
 * con texto `faint`: sobre fondo oscuro, un 50 % de opacidad deja el texto
 * ilegible en vez de apagado.
 *
 * Regla del sistema: nunca dos botones `default` en la misma barra.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16] focus-visible:border-primary disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-[14px] [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        secondary:
          "border border-border-strong bg-secondary text-secondary-foreground hover:bg-popover",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-accent-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[30px] px-[13px]",
        sm: "h-7 px-2.5",
        /** 32 px: la altura de los controles dentro de un formulario. */
        lg: "h-8 px-4",
        icon: "h-[30px] w-[30px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          "disabled:border disabled:border-border-strong disabled:bg-secondary disabled:text-faint",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
