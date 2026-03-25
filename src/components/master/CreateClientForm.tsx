import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess: () => void;
}

const CreateClientForm: React.FC<Props> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Account credentials
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Client info (mirrors business_clients fields)
  const [form, setForm] = useState({
    company_name: "",
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

  const { data: modules = [] } = useQuery({
    queryKey: ["service-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_modules").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const updateForm = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateContact = (field: string, value: string) =>
    setContact((prev) => ({ ...prev, [field]: value }));

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (selectedModules.length === 0) {
      setError("Selecciona al menos un módulo");
      return;
    }
    if (!contact.name.trim()) {
      setError("El nombre del contacto principal es obligatorio");
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create_client_account", {
        body: {
          company_name: form.company_name,
          manager_email: managerEmail,
          manager_password: managerPassword,
          module_ids: selectedModules,
          // Extended client info
          client_info: {
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
          },
          primary_contact: {
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            position: contact.position || null,
          },
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Cliente creado", description: `${form.company_name} ha sido creado correctamente` });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Account Credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credenciales del Manager</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nombre de empresa *</Label>
            <Input value={form.company_name} onChange={(e) => updateForm("company_name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email del manager *</Label>
            <Input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña del manager *</Label>
            <Input type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} required minLength={6} />
          </div>
        </CardContent>
      </Card>

      {/* Client Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos del Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
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
          <div className="space-y-1.5">
            <Label>Sitio Web</Label>
            <Input value={form.website} onChange={(e) => updateForm("website", e.target.value)} placeholder="https://" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
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
            <Input value={form.billing_address} onChange={(e) => updateForm("billing_address", e.target.value)} />
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
            placeholder="Observaciones..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Primary Contact */}
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

      {/* Modules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Módulos *</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {modules.map((mod) => (
              <label key={mod.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50 transition-colors">
                <Checkbox
                  checked={selectedModules.includes(mod.id)}
                  onCheckedChange={() => toggleModule(mod.id)}
                />
                <span className="text-sm">{mod.name}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Crear Cliente
      </Button>
    </form>
  );
};

export default CreateClientForm;
