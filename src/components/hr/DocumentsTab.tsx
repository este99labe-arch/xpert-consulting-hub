import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Download, Trash2, Loader2, FileText, File } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DOC_CATEGORIES = [
  { value: "CONTRACT", label: "Contrato" },
  { value: "ID", label: "Identificación" },
  { value: "PAYSLIP", label: "Nómina" },
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "OTHER", label: "Otro" },
];

const DocumentsTab = () => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [showUpload, setShowUpload] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["hr-doc-employees", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_accounts").select("user_id, roles(code)").eq("account_id", accountId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const empUserIds = employees.map((e: any) => e.user_id);
  const { data: empProfiles = [] } = useQuery({
    queryKey: ["hr-doc-profiles", empUserIds],
    queryFn: async () => {
      try {
        const res = await supabase.functions.invoke("admin_reset_password", { body: { action: "list_users" } });
        if (res.error || res.data?.error) return [] as { user_id: string; email: string }[];
        return ((res.data?.users || []) as { user_id: string; email: string }[]).filter((u) => empUserIds.includes(u.user_id));
      } catch { return [] as { user_id: string; email: string }[]; }
    },
    enabled: empUserIds.length > 0,
  });
  const empEmailMap = new Map<string, string>(empProfiles.map((p) => [p.user_id, p.email]));

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["employee-documents", accountId, selectedEmployee],
    queryFn: async () => {
      let q = supabase.from("employee_documents").select("*").eq("account_id", accountId!).order("created_at", { ascending: false });
      if (selectedEmployee !== "ALL") q = q.eq("user_id", selectedEmployee);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("employee-documents").remove([doc.file_path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      toast({ title: "Documento eliminado" });
    },
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("employee-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filtrar por empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los empleados</SelectItem>
            {employees.map((e: any) => (
              <SelectItem key={e.user_id} value={e.user_id}>
                {empEmailMap.get(e.user_id) || e.user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowUpload(true)}><Upload className="h-4 w-4 mr-2" />Subir Documento</Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3" />
            <p>No hay documentos</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />{doc.name}
                    </TableCell>
                    <TableCell>{empEmailMap.get(doc.user_id) || doc.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{DOC_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar documento?")) deleteMutation.mutate(doc); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <UploadDocumentDialog open={showUpload} onOpenChange={setShowUpload} employees={employees} emailMap={empEmailMap} />
    </div>
  );
};

const UploadDocumentDialog = ({
  open, onOpenChange, employees, emailMap,
}: { open: boolean; onOpenChange: (v: boolean) => void; employees: any[]; emailMap: Map<string, string>; }) => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !employeeId) return;
    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${employeeId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("employee-documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("employee_documents").insert({
        account_id: accountId!, user_id: employeeId, name: name || file.name,
        file_path: filePath, file_type: file.type, file_size: file.size, category, uploaded_by: user!.id,
      });
      if (insertError) throw insertError;
      toast({ title: "Documento subido" });
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      onOpenChange(false);
      setFile(null); setName("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir Documento</DialogTitle>
          <DialogDescription>Adjunta un archivo al expediente del empleado</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Empleado</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{emailMap.get(e.user_id) || e.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nombre del documento</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Contrato 2026" />
          </div>
          <div className="space-y-2">
            <Label>Archivo</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !file || !employeeId}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Subir
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentsTab;
