import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface ClientData {
  name: string;
  total: number;
}

interface TopClientsProps {
  clients: ClientData[];
}

const EUR = (n: number) =>
  n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const TopClients = ({ clients }: TopClientsProps) => {
  const max = clients.length > 0 ? clients[0].total : 1;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Top Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
        ) : (
          <div className="space-y-3">
            {clients.map((c, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate max-w-[60%]">{c.name}</span>
                  <span className="text-xs font-semibold text-primary">{EUR(c.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(c.total / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopClients;
