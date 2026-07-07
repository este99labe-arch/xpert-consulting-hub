import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, KeyRound, UserPlus, AlertCircle, Users, CalendarDays,
  Clock, ShieldCheck, Save, User, Lock, Unlock, Check, X, Mail, ShieldAlert,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { roleLabel } from "@/lib/roles";

// ─── EMPRESA TAB ─────────────────────────────────────────
const CompanyTab = ({ accountId, isManager }: { accountId: string; isManager: boolean }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    legal_name: "", tax_id: "", phone: "", email: "", address: "", city: "",
    postal_code: "", province: "", country: "", website: "",
    billing_email: "", contact_name: "", contact_phone: "",
  });

  const { data: account } = useQuery({
    queryKey: ["my-account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (account) {
      setForm({
        legal_name: (account as any).legal_name || "",
        tax_id: (account as any).tax_id || "",
        phone: (account as any).phone || "",
        email: (account as any).email || "",
        address: (account as any).address || "",
        city: (account as any).city || "",
        postal_code: (account as any).postal_code || "",
        province: (account as any).province || "",
        country: (account as any).country || "ES",
        website: (account as any).website || "",
        billing_email: (account as any).billing_email || "",
        contact_name: (account as any).contact_name || "",
        contact_phone: (account as any).contact_phone || "",
      });
    }
  }, [account]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("accounts").update({
        legal_name: form.legal_name || null,
        tax_id: form.tax_id || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        province: form.province || null,
        country: form.country || "ES",
        website: form.website || null,
        billing_email: form.billing_email || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
      } as any).eq("id", accountId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["my-account"] });
      toast({ title: "Datos fiscales actualizados" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "name", label: "Nombre comercial", value: account?.name || "—", readonly: true },
    { key: "legal_name", label: "Razón social", value: form.legal_name },
    { key: "tax_id", label: "NIF/CIF", value: form.tax_id },
    { key: "phone", label: "Teléfono", value: form.phone },
    { key: "email", label: "Email", value: form.email },
    { key: "website", label: "Sitio web", value: form.website },
    { key: "address", label: "Dirección fiscal", value: form.address },
    { key: "city", label: "Ciudad", value: form.city },
    { key: "postal_code", label: "Código postal", value: form.postal_code },
    { key: "province", label: "Provincia", value: form.province },
    { key: "country", label: "País", value: form.country },
    { key: "billing_email", label: "Email de facturación", value: form.billing_email },
    { key: "contact_name", label: "Persona de contacto", value: form.contact_name },
    { key: "contact_phone", label: "Teléfono de contacto", value: form.contact_phone },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Datos de la empresa</CardTitle>
          <CardDescription>Información general y datos fiscales</CardDescription>
        </div>
        {isManager && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-muted-foreground text-xs">{f.label}</Label>
              {editing && !f.readonly ? (
                <Input
                  value={f.value}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.label}
                />
              ) : (
                <p className="text-sm font-medium">{f.value || "—"}</p>
              )}
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Estado</Label>
            <div>
              <Badge variant={account?.is_active ? "default" : "secondary"}>
                {account?.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Fecha de creación</Label>
            <p className="text-sm font-medium">
              {account?.created_at ? new Date(account.created_at).toLocaleDateString("es-ES") : "—"}
            </p>
          </div>
        </div>
        {editing && (
          <div className="flex gap-2 mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


export default CompanyTab;
