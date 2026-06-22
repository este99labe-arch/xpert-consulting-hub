import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  accountId: string;
  isManager: boolean;
}

const VerifactuSettingsTab = ({ accountId, isManager }: Props) => {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [env, setEnv] = useState<"sandbox" | "prod">("sandbox");
  const [nif, setNif] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["account-settings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_settings").select("*").eq("account_id", accountId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("name, tax_id").eq("id", accountId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (settings) {
      setEnabled((settings as any).verifactu_enabled ?? false);
      setEnv(((settings as any).verifactu_env as "sandbox" | "prod") || "sandbox");
      setNif((settings as any).verifactu_nif || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        verifactu_enabled: enabled,
        verifactu_env: env,
        verifactu_nif: nif.trim().toUpperCase() || null,
        updated_at: new Date().toISOString(),
      } as any;
      if (settings) {
        const { error } = await supabase.from("account_settings").update(payload).eq("account_id", accountId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_settings").insert({ account_id: accountId, ...payload });
        if (error) throw error;
      }
      toast({ title: "Configuración VERI*FACTU guardada" });
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const effectiveNif = nif.trim() || (account as any)?.tax_id || "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> VERI*FACTU
          </CardTitle>
          <CardDescription>
            Registro de facturas en la AEAT mediante el sistema Veri*Factu (remisión en tiempo real).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Activar VERI*FACTU</Label>
              <p className="text-xs text-muted-foreground">
                Habilita la acción "Registrar en AEAT" en las facturas.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!isManager} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Entorno</Label>
              <Select value={env} onValueChange={(v) => setEnv(v as "sandbox" | "prod")} disabled={!isManager}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Pruebas (pre-producción)</SelectItem>
                  <SelectItem value="prod">Producción</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Mantén <strong>Pruebas</strong> hasta validar la integración con la AEAT.
              </p>
            </div>
            <div className="space-y-2">
              <Label>NIF del emisor</Label>
              <Input
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder={(account as any)?.tax_id || "NIF/CIF"}
                disabled={!isManager}
              />
              <p className="text-xs text-muted-foreground">
                Si se deja vacío se usará el NIF/CIF de la empresa.
              </p>
            </div>
          </div>

          {env === "prod" && (
            <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-[hsl(var(--warning))] shrink-0" />
              <span>
                Entorno de <strong>producción</strong>: los registros se enviarán de forma real e irreversible a la AEAT.
              </span>
            </div>
          )}

          {isManager && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar configuración
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Requisitos / estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" /> Requisitos para enviar a la AEAT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>NIF del emisor configurado</span>
            <Badge variant={effectiveNif ? "default" : "secondary"}>{effectiveNif || "Pendiente"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Certificado de cliente (mTLS)</span>
            <Badge variant="secondary">Se configura en Supabase</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t">
            El envío real requiere un <strong>certificado digital</strong> de empresa/representante válido
            para el entorno seleccionado, cargado como secrets de la edge function
            (<code className="text-[11px]">VERIFACTU_CERT</code> y <code className="text-[11px]">VERIFACTU_KEY</code> en formato PEM).
            Mientras no esté configurado, al registrar una factura su huella se calcula y encadena, y queda
            en estado <strong>Preparada</strong> lista para enviarse cuando el certificado esté disponible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifactuSettingsTab;
