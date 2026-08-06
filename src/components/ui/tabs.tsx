import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * Pestañas de Midnight: segmento sobre fondo `muted` con borde `input`, no la
 * barra subrayada anterior. La activa se distingue por superficie elevada.
 *
 * Los contadores que van dentro de un trigger toman el color del estado que
 * cuentan y se escriben en mono (.tnum).
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 overflow-x-auto rounded-[9px] border border-input bg-muted p-[3px] text-muted-foreground scrollbar-hide",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 py-[5px] text-[11.5px] font-medium text-subtle transition-colors duration-150",
      "hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
      "disabled:pointer-events-none disabled:text-faint",
      "data-[state=active]:bg-[hsl(var(--border-strong))] data-[state=active]:font-semibold data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
