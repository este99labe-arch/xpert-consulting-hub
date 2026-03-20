import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Lock, Unlock, ShieldAlert } from "lucide-react";

const SENSITIVE_FIELDS = ["tax_id", "email", "phone", "website"];

interface Props {
  client: any;
  onSave: (updates: Record<string, any>) => void;
  saving: boolean;
  isAdmin: boolean;
}

const ClientInfoTab = ({ client, onSave, saving, isAdmin }: Props) => {
  const [form, setForm] = useState({
    name: "",
    tax_id: "",
    email: "",
    phone: "",
    website: "",
    status: "ACTIVE",
    address: "",
    city: "",
    postal_code: "",
    country: "España",
    billing_address: "",
    billing_city: "",
    billing_postal_code: "",
    billing_country: "",
    notes: "",
  });
  const [unlockedFields, setUnlockedFields] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || "",
        tax_id: client.tax_id || "",
        email: client.email || "",
        phone: client.phone || "",
        website: client.website || "",
        status: client.status || "ACTIVE",
        address: client.address || "",
        city: client.city || "",
        postal_code: client.postal_code || "",
        country: client.country || "España",
        billing_address: client.billing_address || "",
        billing_city: client.billing_city || "",
        billing_postal_code: client.billing_postal_code || "",
        billing_country: client.billing_country || "",
        notes: client.notes || "",
      });
      setUnlockedFields(new Set());
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasSensitiveChanges = SENSITIVE_FIELDS.some(
      (f) => form[f as keyof typeof form] !== (client[f] || "")
    );
    if (hasSensitiveChanges) {
      setShowConfirm(true);
    } else {
      doSave();
    }
  };

  const doSave = () => {
    setShowConfirm(false);
    onSave({
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postal_code || null,
      billing_address: form.billing_address || null,
      billing_city: form.billing_city || null,
      billing_postal_code: form.billing_postal_code || null,
      billing_country: form.billing_country || null,
      notes: form.notes || null,
    });
    setUnlockedFields(new Set());
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleLock = (field: string) => {
    setUnlockedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        // Reset to original value
        setForm((f) => ({ ...f, [field]: client[field] || "" }));
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const isSensitiveLocked = (field: string) =>
    SENSITIVE_FIELDS.includes(field) && !unlockedFields.has(field);

  const SensitiveInput = ({ field, label, type = "text", placeholder }: { field: string; label: string; type?: string; placeholder?: string }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        {label}
        {SENSITIVE_FIELDS.includes(field) && (
          <ShieldAlert className="h-3 w-3 text-amber-500" />
        )}
      </Label>
      <div className="relative flex gap-1.5">
        <Input
          type={type}
          value={form[field as keyof typeof form]}
          onChange={(e) => update(field, e.target.value)}
          disabled={isSensitiveLocked(field)}
          placeholder={placeholder}
          className={isSensitiveLocked(field) ? "bg-muted/50 text-muted-foreground" : ""}
        />
        {SENSITIVE_FIELDS.includes(field) && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 h-10 w-10"
            onClick={() => toggleLock(field)}
            title={isSensitiveLocked(field) ? "Desbloquear campo" : "Bloquear campo"}
          >
            {isSensitiveLocked(field) ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Unlock className="h-4 w-4 text-amber-500" />
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Datos Generales
              <Badge variant={form.status === "ACTIVE" ? "default" : "secondary"}>
                {form.status === "ACTIVE" ? "Activo" : "Inactivo"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre / Razón Social</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <SensitiveInput field="tax_id" label="NIF / CIF" />
            <SensitiveInput field="email" label="Email" type="email" />
            <SensitiveInput field="phone" label="Teléfono" />
            <SensitiveInput field="website" label="Sitio Web" placeholder="https://" />
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="INACTIVE">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Fiscal Address */}
        <Card>
          <CardHeader><CardTitle>Dirección Fiscal</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card>
          <CardHeader><CardTitle>Dirección de Facturación</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={form.billing_address} onChange={(e) => update("billing_address", e.target.value)} placeholder="Si difiere de la dirección fiscal" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={form.billing_city} onChange={(e) => update("billing_city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input value={form.billing_postal_code} onChange={(e) => update("billing_postal_code", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={form.billing_country} onChange={(e) => update("billing_country", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle>Notas Internas</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Observaciones sobre este cliente..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar Cambios
          </Button>
        </div>
      </form>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirmar cambios sensibles
            </AlertDialogTitle>
            <AlertDialogDescription>
              Has modificado datos sensibles del cliente (CIF, email, teléfono o web). ¿Estás seguro de que deseas guardar estos cambios?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSave}>
              Confirmar y Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClientInfoTab;
