import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/** 34 × 19 px con pulgar blanco de 15 px. Activo primary, inactivo neutro. */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[19px] w-[34px] shrink-0 cursor-pointer items-center rounded-[10px] border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[15px] w-[15px] rounded-full bg-white transition-transform",
        "data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-0",
        "data-[state=unchecked]:bg-subtle",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
