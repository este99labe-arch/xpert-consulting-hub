import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";
import DeleteConfirmDialog from "@/components/shared/DeleteConfirmDialog";

interface Props {
  clientId: string;
  accountId: string;
  isAdmin: boolean;
}

const ClientContactsTab = ({ clientId, accountId, isAdmin }: Props) => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["client-contacts-decrypted", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_client_contacts_decrypted", {
        _client_id: clientId,
      });
      if (error) throw error;
      // La RPC devuelve "job_position"; lo mapeamos a "position" para no tocar el resto del componente
      return (data as any[] || []).map((c) => ({ ...c, position: c.job_position }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-contacts", clientId] });
      toast({ title: "Contacto eliminado" });
      setDeletingId(null);
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contactos</h3>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Añadir Contacto
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin contactos"
          description="Añade personas de contacto para este cliente"
          actionLabel={isAdmin ? "Añadir Contacto" : undefined}
          onAction={isAdmin ? () => setShowForm(true) : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name}
                      {c.is_primary && <Badge variant="outline" className="ml-2 text-xs">Principal</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.position || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setShowForm(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingId(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ContactFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        contact={editing}
        clientId={clientId}
        accountId={accountId}
        onSuccess={() => {
          setShowForm(false);
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ["client-contacts", clientId] });
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingId}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
        title="¿Eliminar este contacto?"
        description="Se eliminará permanentemente."
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

/* ---------- Contact Form Dialog ---------- */

interface ContactFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: any;
  clientId: string;
  accountId: string;
  onSuccess: () => void;
}

const ContactFormDialog = ({ open, onOpenChange, contact, clientId, accountId, onSuccess }: ContactFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!contact;

  const handleOpenChange = (v: boolean) => {
    if (v && contact) {
      setName(contact.name);
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setPosition(contact.position || "");
      setIsPrimary(contact.is_primary || false);
    } else if (v) {
      setName(""); setEmail(""); setPhone(""); setPosition(""); setIsPrimary(false);
    }
    onOpenChange(v);
  };

  if (open && contact && name === "") {
    setName(contact.name);
    setEmail(contact.email || "");
    setPhone(contact.phone || "");
    setPosition(contact.position || "");
    setIsPrimary(contact.is_primary || false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name,
        email: email || null,
        phone: phone || null,
        position: position || null,
        is_primary: isPrimary,
      };
      if (isEdit) {
        const { error } = await supabase.from("client_contacts").update(payload).eq("id", contact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_contacts").insert({
          ...payload,
          client_id: clientId,
          account_id: accountId,
        });
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
          <DialogDescription>Datos de la persona de contacto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
            <Label>Contacto principal</Label>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Guardar" : "Añadir"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClientContactsTab;
