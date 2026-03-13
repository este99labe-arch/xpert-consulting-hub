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
  const [autoJournal, setAutoJournal] = useState(true);

  useEffect(() => {
    if (client) {
      setDefaultVat(client.default_vat_percentage ?? 21);
      setAutoJournal(client.auto_journal_entry ?? true);
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      default_vat_percentage: defaultVat,
      auto_journal_entry: autoJournal,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de IVA</CardTitle>
          <CardDescription>
            El IVA por defecto se aplicará automáticamente al crear facturas para este cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
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
