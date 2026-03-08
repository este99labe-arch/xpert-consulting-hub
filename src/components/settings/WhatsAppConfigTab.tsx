import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Copy, CheckCircle2, AlertCircle, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WhatsAppConfigTabProps {
  accountId: string;
  isManager: boolean;
}

const WhatsAppConfigTab = ({ accountId, isManager }: WhatsAppConfigTabProps) => {
  const queryClient = useQueryClient();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["whatsapp-config", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setPhoneNumberId(config.phone_number_id || "");
      setVerifyToken(config.verify_token || "");
      setIsEnabled(config.is_enabled || false);
    }
  }, [config]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp_webhook`;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            phone_number_id: phoneNumberId.trim(),
            verify_token: verifyToken.trim(),
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_config").insert({
          account_id: accountId,
          phone_number_id: phoneNumberId.trim(),
          verify_token: verifyToken.trim(),
          is_enabled: isEnabled,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      toast({ title: "Configuración guardada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "URL copiada al portapapeles" });
  };

  if (!isManager) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Solo los administradores pueden configurar la integración de WhatsApp.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Integración WhatsApp</CardTitle>
            {config?.is_enabled && (
              <Badge variant="default" className="ml-2">Activo</Badge>
            )}
          </div>
          <CardDescription>
            Permite a los empleados fichar entrada y salida enviando mensajes de WhatsApp.
            Los empleados deben tener su número de teléfono registrado en su perfil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Activar fichaje por WhatsApp</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Los empleados podrán enviar "entrada" o "salida" por WhatsApp
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {/* Phone Number ID */}
          <div className="space-y-2">
            <Label htmlFor="phone-number-id">Phone Number ID</Label>
            <Input
              id="phone-number-id"
              placeholder="Ej: 123456789012345"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se obtiene desde el panel de Meta Business → WhatsApp → Configuración de API
            </p>
          </div>

          {/* Verify Token */}
          <div className="space-y-2">
            <Label htmlFor="verify-token">Token de Verificación</Label>
            <Input
              id="verify-token"
              placeholder="Un token secreto para verificar el webhook"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Token personalizado que configurarás en Meta al registrar el webhook
            </p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label>URL del Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="bg-muted font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copia esta URL en Meta Business → WhatsApp → Configuración → Webhook
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guía de configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              Crea una app en{" "}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                developers.facebook.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Activa el producto "WhatsApp" en tu app de Meta</li>
            <li>Obtén el <strong>Phone Number ID</strong> y un <strong>Access Token permanente</strong></li>
            <li>Copia la URL del webhook de arriba y configúrala en Meta → Webhooks</li>
            <li>Usa el Token de Verificación que has definido arriba al configurar el webhook</li>
            <li>Suscríbete al campo <strong>messages</strong> en el webhook</li>
            <li>Asegúrate de que cada empleado tiene su número de teléfono en su perfil</li>
          </ol>

          <div className="mt-4 p-3 bg-muted rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium">Comandos soportados por WhatsApp:</p>
                <p className="mt-1"><strong>"entrada"</strong> — Registra la hora de entrada</p>
                <p><strong>"salida"</strong> — Registra la hora de salida</p>
                <p className="mt-1">También se admiten variantes como "entrar", "salir", "inicio", "fin", "in", "out".</p>
                <p className="mt-1">Si el empleado envía su ubicación junto al mensaje, se guardará automáticamente.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConfigTab;
