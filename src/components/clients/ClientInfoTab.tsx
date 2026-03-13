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
import { Loader2 } from "lucide-react";

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
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
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
          <div className="space-y-2">
            <Label>NIF / CIF</Label>
            <Input value={form.tax_id} onChange={(e) => update("tax_id", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sitio Web</Label>
            <Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" />
          </div>
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
  );
};

export default ClientInfoTab;
