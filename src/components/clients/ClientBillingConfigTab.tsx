import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface Props {
  client: any;
  onSave: (updates: Record<string, any>) => void;
  saving: boolean;
}

const ClientBillingConfigTab = ({ client, onSave, saving }: Props) => {
  const [defaultVat, setDefaultVat] = useState(21);
  const [defaultIrpf, setDefaultIrpf] = useState(0);
  const [autoJournal, setAutoJournal] = useState(true);

  useEffect(() => {
    if (client) {
      setDefaultVat(client.default_vat_percentage ?? 21);
      setDefaultIrpf(client.default_irpf_percentage ?? 0);
      setAutoJournal(client.auto_journal_entry ?? true);
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      default_vat_percentage: defaultVat,
      default_irpf_percentage: defaultIrpf,
      auto_journal_entry: autoJournal,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Impuestos por defecto</CardTitle>
          <CardDescription>
            Se aplican automáticamente al crear facturas para este cliente. Puedes cambiarlos en cada factura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>IVA por defecto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={defaultVat}
                onChange={(e) => setDefaultVat(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>IRPF por defecto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={defaultIrpf}
                onChange={(e) => setDefaultIrpf(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Retención para profesionales o alquileres. 0 = sin retención.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asiento Contable Automático</CardTitle>
          <CardDescription>
            Si está activo, se generará automáticamente un asiento contable cuando la factura pase a estado "Pagada"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={autoJournal} onCheckedChange={setAutoJournal} />
            <Label>{autoJournal ? "Activado" : "Desactivado"}</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar Configuración
        </Button>
      </div>
    </form>
  );
};

export default ClientBillingConfigTab;
