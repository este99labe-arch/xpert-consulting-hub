import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo de Midnight: 32 px, radio 8 px, fondo `muted` y borde `input`.
 * El foco lleva borde primary y anillo de 3 px al 16 %; no se anula nunca.
 */
export const fieldClasses =
  "flex h-8 w-full rounded-control border border-input bg-muted px-2.5 text-xs text-foreground transition-colors " +
  "placeholder:text-faint file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground " +
  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/[.16] " +
  "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-faint " +
  "aria-[invalid=true]:border-destructive-border";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(fieldClasses, className)} ref={ref} {...props} />
  ),
);
Input.displayName = "Input";

export { Input };
