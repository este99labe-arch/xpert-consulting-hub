import { LucideIcon } from "lucide-react";

interface FormSectionProps {
  icon: LucideIcon;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  highlight?: boolean;
  children: React.ReactNode;
}

/**
 * Tarjeta de sección reutilizable para formularios de creación.
 * Cabecera con icono + título/descripción y cuerpo con espaciado consistente.
 */
const FormSection = ({ icon: Icon, title, desc, action, highlight, children }: FormSectionProps) => (
  <section className={`rounded-xl border bg-card shadow-2xs ${highlight ? "border-primary/30" : "border-border"}`}>
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      {action}
    </div>
    <div className="space-y-4 p-4">{children}</div>
  </section>
);

export default FormSection;
