import { fmtEUR0 as EUR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, FileWarning, PackageX, ClipboardCheck, ChevronRight, CheckCircle2,
} from "lucide-react";

interface AttentionWidgetProps {
  overdueCount: number;
  overdueAmount: number;
  lowStockCount: number;
  pendingApprovals: number;
}


interface Item {
  key: string;
  show: boolean;
  icon: any;
  tone: "danger" | "warning";
  title: string;
  desc: string;
  to: string;
}

const TONE: Record<string, { iconBg: string; icon: string; ring: string }> = {
  danger: { iconBg: "bg-destructive/10", icon: "text-destructive", ring: "hover:border-destructive/30" },
  warning: { iconBg: "bg-[hsl(var(--warning))]/10", icon: "text-[hsl(var(--warning))]", ring: "hover:border-[hsl(var(--warning))]/30" },
};

const AttentionWidget = ({ overdueCount, overdueAmount, lowStockCount, pendingApprovals }: AttentionWidgetProps) => {
  const navigate = useNavigate();

  const items = [
    {
      key: "overdue", show: overdueCount > 0, icon: FileWarning, tone: "danger" as const,
      title: `${overdueCount} ${overdueCount === 1 ? "factura vencida" : "facturas vencidas"}`,
      desc: `${EUR(overdueAmount)} pendientes de cobro`,
      to: "/app/invoices?status=OVERDUE",
    },
    {
      key: "approvals", show: pendingApprovals > 0, icon: ClipboardCheck, tone: "warning" as const,
      title: `${pendingApprovals} ${pendingApprovals === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`,
      desc: "Ausencias, perfiles y eliminaciones por aprobar",
      to: "/app/settings",
    },
    {
      key: "stock", show: lowStockCount > 0, icon: PackageX, tone: "warning" as const,
      title: `${lowStockCount} ${lowStockCount === 1 ? "producto bajo mínimos" : "productos bajo mínimos"}`,
      desc: "Revisa el stock y reabastece",
      to: "/app/inventory",
    },
  ].filter((i) => i.show);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
          Requiere tu atención
          {items.length > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
              {items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
              <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))]" />
            </div>
            <p className="text-sm font-medium">Todo en orden</p>
            <p className="text-xs text-muted-foreground">No hay nada urgente ahora mismo.</p>
          </div>
        ) : (
          items.map((item) => {
            const tone = TONE[item.tone];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.to)}
                className={`flex w-full items-center gap-3 rounded-lg border border-transparent bg-muted/40 p-2.5 text-left transition-colors hover:bg-muted/70 ${tone.ring}`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg}`}>
                  <item.icon className={`h-4 w-4 ${tone.icon}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default AttentionWidget;
