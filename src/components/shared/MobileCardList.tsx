import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MobileCardField {
  label: string;
  value: ReactNode;
  className?: string;
}

interface MobileCardProps {
  fields: MobileCardField[];
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export const MobileCard = ({ fields, actions, onClick, className }: MobileCardProps) => (
  <Card
    className={cn(
      "p-4 space-y-2",
      onClick && "cursor-pointer active:bg-accent/50",
      className
    )}
    onClick={onClick}
  >
    {fields.map((field, i) => (
      <div key={i} className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground shrink-0">{field.label}</span>
        <span className={cn("text-sm text-right", field.className)}>{field.value}</span>
      </div>
    ))}
    {actions && (
      <div className="flex items-center justify-end gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    )}
  </Card>
);

interface MobileCardListProps {
  children: ReactNode;
  className?: string;
}

export const MobileCardList = ({ children, className }: MobileCardListProps) => (
  <div className={cn("space-y-3 md:hidden", className)}>
    {children}
  </div>
);

export default MobileCard;
