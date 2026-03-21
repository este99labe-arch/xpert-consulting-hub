import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, UserPlus, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreateReminderDialog from "@/components/reminders/CreateReminderDialog";

const QuickActions = () => {
  const navigate = useNavigate();
  const [showReminder, setShowReminder] = useState(false);

  const actions = [
    { label: "Nueva Factura", icon: Plus, path: "/app/invoices", color: "bg-primary text-primary-foreground hover:bg-primary/90" },
    { label: "Nuevo Gasto", icon: Receipt, path: "/app/invoices", color: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
    { label: "Nuevo Cliente", icon: UserPlus, path: "/app/clients", color: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90" },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            size="sm"
            className={`gap-1.5 text-xs ${a.color}`}
            onClick={() => navigate(a.path)}
          >
            <a.icon className="h-3.5 w-3.5" />
            {a.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setShowReminder(true)}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Recordatorio
        </Button>
      </div>
      <CreateReminderDialog open={showReminder} onOpenChange={setShowReminder} />
    </>
  );
};

export default QuickActions;
