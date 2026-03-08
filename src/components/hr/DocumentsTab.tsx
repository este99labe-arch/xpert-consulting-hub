import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Upload, Download, Trash2, Loader2, FileText, FolderOpen, Folder,
  FolderPlus, ChevronRight, ChevronDown, User,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/shared/DeleteConfirmDialog";

interface EmployeeFolder {
  id: string;
  name: string;
  is_default: boolean;
}

interface EmployeeNode {
  user_id: string;
  name: string;
  folders: EmployeeFolder[];
}

const DocumentsTab = () => {
  const { accountId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderForUser, setNewFolderForUser] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);
  const [deleteFolder, setDeleteFolder] = useState<EmployeeFolder | null>(null);

  // Fetch employee profiles for this account
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-doc-profiles", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // For employees, filter to only their own
  const visibleEmployees = isManager
    ? employees
    : employees.filter((e) => e.user_id === user?.id);

  // Ensure default folders exist for visible employees
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["document-folders", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_folders")
        .select("*")
        .eq("account_id", accountId!)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Auto-create default folders for visible employees that don't have them
  useEffect(() => {
    if (!accountId || !user || visibleEmployees.length === 0) return;
    const employeesWithFolders = new Set(folders.map((f: any) => f.user_id));
    const missing = visibleEmployees.filter((e) => !employeesWithFolders.has(e.user_id));
    if (missing.length === 0) return;

    Promise.all(
      missing.map((e) =>
        supabase.rpc("ensure_default_folders", {
          _account_id: accountId,
          _user_id: e.user_id,
          _created_by: user.id,
        })
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
    });
  }, [accountId, user, visibleEmployees.length, folders.length]);

  // Auto-select for employee role
  useEffect(() => {
    if (!isManager && user && !selectedEmployee) {
      setSelectedEmployee(user.id);
      setExpandedEmployees(new Set([user.id]));
    }
  }, [isManager, user, selectedEmployee]);

  // Fetch documents for selected folder
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["folder-documents", selectedFolder],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("folder_id", selectedFolder!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedFolder,
  });

  // Build employee nodes
  const employeeNodes: EmployeeNode[] = visibleEmployees.map((e) => ({
    user_id: e.user_id,
    name: `${e.first_name} ${e.last_name}`,
    folders: folders.filter((f: any) => f.user_id === e.user_id),
  }));

  const selectedFolderData = folders.find((f: any) => f.id === selectedFolder);
  const selectedEmployeeData = employeeNodes.find((e) => e.user_id === selectedEmployee);

  const toggleEmployee = (userId: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setSelectedEmployee(userId);
  };

  const selectFolder = (folderId: string, userId: string) => {
    setSelectedFolder(folderId);
    setSelectedEmployee(userId);
  };

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("employee-documents").remove([doc.file_path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-documents"] });
      toast({ title: "Documento eliminado" });
      setDeleteDoc(null);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      const { error } = await supabase.from("document_folders").insert({
        account_id: accountId!,
        user_id: userId,
        name,
        is_default: false,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      toast({ title: "Carpeta creada" });
      setShowNewFolder(false);
      setNewFolderName("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folder: EmployeeFolder) => {
      const { error } = await supabase.from("document_folders").delete().eq("id", folder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      if (selectedFolder === deleteFolder?.id) setSelectedFolder(null);
      toast({ title: "Carpeta eliminada" });
      setDeleteFolder(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message.includes("violates foreign key") ? "La carpeta contiene documentos. Elimínalos primero." : err.message, variant: "destructive" });
      setDeleteFolder(null);
    },
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("employee-documents").createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (foldersLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[400px]">
      {/* Left Panel — Employee & Folder Tree */}
      <Card className="w-72 shrink-0">
        <CardContent className="p-0 h-full">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Empleados</h3>
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="p-2 space-y-1">
              {employeeNodes.map((emp) => (
                <div key={emp.user_id}>
                  <Collapsible
                    open={expandedEmployees.has(emp.user_id)}
                    onOpenChange={() => toggleEmployee(emp.user_id)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left">
                      {expandedEmployees.has(emp.user_id) ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <User className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{emp.name}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-5 pl-2 border-l border-border space-y-0.5 mt-0.5">
                        {emp.folders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => selectFolder(folder.id, emp.user_id)}
                            className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-sm transition-colors text-left ${
                              selectedFolder === folder.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-accent text-foreground"
                            }`}
                          >
                            {selectedFolder === folder.id ? (
                              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate">{folder.name}</span>
                            {!folder.is_default && isManager && (
                              <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">Custom</Badge>
                            )}
                          </button>
                        ))}
                        {isManager && (
                          <button
                            onClick={() => {
                              setNewFolderForUser(emp.user_id);
                              setShowNewFolder(true);
                            }}
                            className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
                          >
                            <FolderPlus className="h-3.5 w-3.5" />
                            <span>Nueva carpeta</span>
                          </button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
              {employeeNodes.length === 0 && (
                <p className="text-sm text-muted-foreground px-2 py-4 text-center">No hay empleados</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Panel — Folder Content */}
      <Card className="flex-1">
        <CardContent className="p-0 h-full flex flex-col">
          {selectedFolder && selectedFolderData ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedFolderData.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployeeData?.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isManager && (
                    <Button size="sm" onClick={() => setShowUpload(true)}>
                      <Upload className="h-4 w-4 mr-1" />Subir
                    </Button>
                  )}
                  {isManager && !selectedFolderData.is_default && (
                    <Button size="sm" variant="outline" onClick={() => setDeleteFolder(selectedFolderData)}>
                      <Trash2 className="h-4 w-4 mr-1" />Eliminar carpeta
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1">
                {docsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2" />
                    <p className="text-sm">Carpeta vacía</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Tamaño</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc: any) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            {doc.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(doc.created_at).toLocaleDateString("es-ES")}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {isManager && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleteDoc(doc)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-3" />
              <p>Selecciona una carpeta para ver su contenido</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      {showUpload && selectedFolder && (
        <UploadDialog
          open={showUpload}
          onOpenChange={setShowUpload}
          folderId={selectedFolder}
          employeeUserId={selectedEmployee!}
        />
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Carpeta</DialogTitle>
            <DialogDescription>Crea una carpeta personalizada para el empleado</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ej: Formación" />
            </div>
            <Button
              className="w-full"
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              onClick={() => {
                if (newFolderForUser) createFolderMutation.mutate({ userId: newFolderForUser, name: newFolderName.trim() });
              }}
            >
              {createFolderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirm */}
      <DeleteConfirmDialog
        open={!!deleteDoc}
        onConfirm={() => deleteDoc && deleteMutation.mutate(deleteDoc)}
        onCancel={() => setDeleteDoc(null)}
        title="¿Eliminar documento?"
        description="El archivo se eliminará permanentemente."
        loading={deleteMutation.isPending}
      />

      {/* Delete Folder Confirm */}
      <DeleteConfirmDialog
        open={!!deleteFolder}
        onConfirm={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder)}
        onCancel={() => setDeleteFolder(null)}
        title="¿Eliminar carpeta?"
        description="Solo se puede eliminar si está vacía."
        loading={deleteFolderMutation.isPending}
      />
    </div>
  );
};

/* Upload file into a specific folder */
const UploadDialog = ({
  open, onOpenChange, folderId, employeeUserId,
}: { open: boolean; onOpenChange: (v: boolean) => void; folderId: string; employeeUserId: string }) => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${employeeUserId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("employee-documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("employee_documents").insert({
        account_id: accountId!,
        user_id: employeeUserId,
        name: name || file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        category: "OTHER",
        uploaded_by: user!.id,
        folder_id: folderId,
      });
      if (insertError) throw insertError;
      toast({ title: "Documento subido" });
      queryClient.invalidateQueries({ queryKey: ["folder-documents"] });
      onOpenChange(false);
      setFile(null);
      setName("");
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
          <DialogDescription>Sube un archivo a esta carpeta</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del documento</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Contrato 2026" />
          </div>
          <div className="space-y-2">
            <Label>Archivo</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !file}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Subir
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentsTab;
