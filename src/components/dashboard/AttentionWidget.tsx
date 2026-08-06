import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { fmtEUR0 as EUR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AttentionWidgetProps {
  overdueCount: number;
  overdueAmount: number;
  lowStockCount: number;
  pendingApprovals: number;
}

/**
 * Tarjeta de atención del dashboard.
 *
 * Antes listaba tres avisos con el mismo peso visual y había que leerlos todos
 * para saber cuál corría prisa. Ahora manda el importe vencido —lo único que
 * cuesta dinero cada día que pasa— y el resto queda como contexto debajo.
 */
const AttentionWidget = ({
  overdueCount, overdueAmount, lowStockCount, pendingApprovals,
}: AttentionWidgetProps) => {
  const navigate = useNavigate();

  const secondary = [
    pendingApprovals > 0 &&
      `${pendingApprovals} ${pendingApprovals === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`,
    lowStockCount > 0 &&
      `${lowStockCount} ${lowStockCount === 1 ? "producto bajo mínimos" : "productos bajo mínimos"}`,
  ].filter(Boolean) as string[];

  if (overdueCount === 0 && secondary.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 px-[18px] py-8 text-center">
        <CheckCircle2 className="h-5 w-5 stroke-[1.8] text-success" />
        <p className="text-xs font-semibold text-foreground">Todo en orden</p>
        <p className="text-[11.5px] text-muted-foreground">No hay nada urgente ahora mismo.</p>
      </Card>
    );
  }

  const urgent = overdueCount > 0;

  return (
    <Card tone={urgent ? "alert" : "warning"} className="flex flex-col px-[18px] py-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${urgent ? "bg-destructive" : "bg-warning"}`}
          aria-hidden
        />
        <span className="text-[11px] font-medium text-muted-foreground">
          {urgent ? "Vencido pendiente de cobro" : "Requiere tu atención"}
        </span>
      </div>

      <div className="mt-2 tnum text-[26px] font-semibold leading-none tracking-[-.02em] text-figure">
        {urgent ? EUR(overdueAmount) : secondary.length}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-[1.6] text-muted-foreground">
        {urgent
          ? `${overdueCount} ${overdueCount === 1 ? "factura vencida" : "facturas vencidas"}.`
          : "Asuntos abiertos."}
        {secondary.length > 0 && ` ${secondary.join(" · ")}.`}
      </p>

      <div className="mt-auto flex gap-2 pt-4">
        <Button
          variant={urgent ? "destructive" : "secondary"}
          onClick={() => navigate(urgent ? "/app/invoices?status=OVERDUE" : "/app/settings")}
        >
          {urgent ? "Reclamar cobros" : "Revisar solicitudes"}
        </Button>
        <Button variant="outline" onClick={() => navigate("/app/invoices")}>
          Ver todas
        </Button>
      </div>
    </Card>
  );
};

export default AttentionWidget;
