import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  onSuccess: () => void;
}

const CreateBusinessClientDialog = ({ open, onOpenChange, accountId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Client info
  const [form, setForm] = useState({
    name: "",
    tax_id: "",
    email: "",
    phone: "",
    website: "",
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

  // Primary contact
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
  });

  const updateForm = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateContact = (field: string, value: string) =>
    setContact((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm({
      name: "", tax_id: "", email: "", phone: "", website: "",
      address: "", city: "", postal_code: "", country: "España",
      billing_address: "", billing_city: "", billing_postal_code: "", billing_country: "",
      notes: "",
    });
    setContact({ name: "", email: "", phone: "", position: "" });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!contact.name.trim()) {
      setError("El nombre del contacto principal es obligatorio");
      return;
    }

    setLoading(true);
    try {
      // 1. Create business client
      const { data: newClient, error: insertError } = await supabase
        .from("business_clients")
        .insert({
          account_id: accountId,
          name: form.name,
          tax_id: form.tax_id,
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          address: form.address || null,
          city: form.city || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          billing_address: form.billing_address || null,
          billing_city: form.billing_city || null,
          billing_postal_code: form.billing_postal_code || null,
          billing_country: form.billing_country || null,
          notes: form.notes || null,
          status: "ACTIVE",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 2. Create primary contact
      const { error: contactError } = await supabase
        .from("client_contacts")
        .insert({
          client_id: newClient.id,
          account_id: accountId,
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          position: contact.position || null,
          is_primary: true,
        });

      if (contactError) throw contactError;

      toast({ title: "Cliente creado correctamente" });
      resetForm();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
          <DialogDescription>Completa los datos del cliente y su contacto principal</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* General Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos Generales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre / Razón Social *</Label>
                <Input value={form.name} onChange={(e) => updateForm("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>NIF / CIF *</Label>
                <Input value={form.tax_id} onChange={(e) => updateForm("tax_id", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sitio Web</Label>
                <Input value={form.website} onChange={(e) => updateForm("website", e.target.value)} placeholder="https://" />
              </div>
            </CardContent>
          </Card>

          {/* Fiscal Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dirección Fiscal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => updateForm("address", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <Input value={form.city} onChange={(e) => updateForm("city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Código Postal</Label>
                <Input value={form.postal_code} onChange={(e) => updateForm("postal_code", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>País</Label>
                <Input value={form.country} onChange={(e) => updateForm("country", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dirección de Facturación</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Dirección</Label>
                <Input value={form.billing_address} onChange={(e) => updateForm("billing_address", e.target.value)} placeholder="Si difiere de la dirección fiscal" />
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <Input value={form.billing_city} onChange={(e) => updateForm("billing_city", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Código Postal</Label>
                <Input value={form.billing_postal_code} onChange={(e) => updateForm("billing_postal_code", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>País</Label>
                <Input value={form.billing_country} onChange={(e) => updateForm("billing_country", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Observaciones sobre este cliente..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Primary Contact - MANDATORY */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contacto Principal *</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input value={contact.name} onChange={(e) => updateContact("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={contact.position} onChange={(e) => updateContact("position", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={contact.email} onChange={(e) => updateContact("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={contact.phone} onChange={(e) => updateContact("phone", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear Cliente
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBusinessClientDialog;
