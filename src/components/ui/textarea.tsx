import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(fieldClasses, "h-auto min-h-[72px] py-2 leading-[1.6]", className)}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
