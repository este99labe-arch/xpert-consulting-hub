import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload, Download, Trash2, Loader2, FileText, FolderOpen, Folder,
  FolderPlus, ChevronLeft, User, File, ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/shared/DeleteConfirmDialog";

/* ── Types ── */
interface FolderRow { id: string; user_id: string; name: string; is_default: boolean }
interface EmployeeInfo { user_id: string; displayName: string; email: string; initials: string }

/* ── Constants ── */
const FOLDER_ICONS: Record<string, string> = {
  "Contratos": "📄",
  "Nóminas": "💰",
  "Certificados": "🏅",
  "Identificación": "🪪",
  "Otros": "📎",
};

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */
const DocumentsTab = () => {
  const { accountId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  // Navigation state: null = employee list, string = viewing employee's folders
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteDoc, setDeleteDoc] = useState<any>(null);
  const [deleteFolder, setDeleteFolder] = useState<FolderRow | null>(null);

  /* ── Data: employee profiles ── */
  const { data: profiles = [] } = useQuery({
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

  const { data: userAccounts = [] } = useQuery({
    queryKey: ["hr-doc-user-accounts", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_accounts")
        .select("user_id, roles(code)")
        .eq("account_id", accountId!)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Get emails for users without profiles (manager only via edge function)
  const userIds = userAccounts.map((ua: any) => ua.user_id);
  const { data: emailList = [] } = useQuery({
    queryKey: ["hr-doc-emails", userIds],
    queryFn: async () => {
      try {
        const res = await supabase.functions.invoke("admin_reset_password", { body: { action: "list_users" } });
        if (res.error || res.data?.error) return [];
        return (res.data?.users || []).filter((u: any) => userIds.includes(u.user_id));
      } catch { return []; }
    },
    enabled: isManager && userIds.length > 0,
  });
  const emailMap = new Map<string, string>((emailList as any[]).map((u) => [u.user_id, u.email]));

  /* ── Build employee list ── */
  const employees: EmployeeInfo[] = useMemo(() => {
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    const allUserIds = new Set([
      ...profiles.map((p) => p.user_id),
      ...userAccounts.map((ua: any) => ua.user_id),
    ]);
    return Array.from(allUserIds).map((uid) => {
      const profile = profileMap.get(uid);
      const email = emailMap.get(uid) || user?.email || "";
      let displayName: string;
      let initials: string;
      if (profile?.first_name && profile.first_name !== "Empleado") {
        displayName = `${profile.first_name} ${profile.last_name}`;
        initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
      } else if (email) {
        displayName = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      } else {
        displayName = `Usuario ${uid.slice(0, 6)}`;
        initials = "??";
      }
      return { user_id: uid, displayName, email, initials };
    });
  }, [profiles, userAccounts, emailMap.size]);

  const visibleEmployees = isManager
    ? employees
    : employees.filter((e) => e.user_id === user?.id);

  /* ── Data: folders ── */
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

  /* ── Auto-create default folders ── */
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
    ).then(() => queryClient.invalidateQueries({ queryKey: ["document-folders"] }));
  }, [accountId, user, visibleEmployees.length, folders.length]);

  // Auto-select employee for EMPLOYEE role
  useEffect(() => {
    if (!isManager && user && visibleEmployees.length > 0 && !selectedEmployee) {
      setSelectedEmployee(user.id);
    }
  }, [isManager, user, visibleEmployees.length, selectedEmployee]);

  /* ── Data: documents in selected folder ── */
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

  // Document counts per folder
  const { data: folderCounts = {} } = useQuery({
    queryKey: ["folder-doc-counts", accountId, selectedEmployee],
    queryFn: async () => {
      const empFolders = folders.filter((f: any) => f.user_id === selectedEmployee);
      if (empFolders.length === 0) return {};
      const folderIds = empFolders.map((f: any) => f.id);
      const { data, error } = await supabase
        .from("employee_documents")
        .select("folder_id")
        .in("folder_id", folderIds);
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d: any) => { counts[d.folder_id] = (counts[d.folder_id] || 0) + 1; });
      return counts;
    },
    enabled: !!selectedEmployee && folders.length > 0,
  });

  const selectedEmployeeInfo = visibleEmployees.find((e) => e.user_id === selectedEmployee);
  const employeeFolders = folders.filter((f: any) => f.user_id === selectedEmployee);
  const selectedFolderData = folders.find((f: any) => f.id === selectedFolder);

  /* ── Mutations ── */
  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("employee-documents").remove([doc.file_path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-documents"] });
      queryClient.invalidateQueries({ queryKey: ["folder-doc-counts"] });
      toast({ title: "Documento eliminado" });
      setDeleteDoc(null);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("document_folders").insert({
        account_id: accountId!, user_id: selectedEmployee!, name, is_default: false, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-folders"] });
      toast({ title: "Carpeta creada" });
      setShowNewFolder(false);
      setNewFolderName("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folder: FolderRow) => {
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
      toast({
        title: "Error",
        description: err.message.includes("foreign key") ? "La carpeta contiene documentos. Elimínalos primero." : err.message,
        variant: "destructive",
      });
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

  /* ═══════════════════════════════════════════════
     VIEW: File list inside a folder
     ═══════════════════════════════════════════════ */
  if (selectedFolder && selectedFolderData && selectedEmployeeInfo) {
    return (
      <div className="space-y-4">
        {/* Breadcrumb nav */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { setSelectedFolder(null); }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {selectedEmployeeInfo.displayName}
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{selectedFolderData.name}</span>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{FOLDER_ICONS[selectedFolderData.name] || "📁"}</span>
            <h3 className="text-lg font-semibold">{selectedFolderData.name}</h3>
            <Badge variant="secondary" className="ml-1">{documents.length} archivo{documents.length !== 1 ? "s" : ""}</Badge>
          </div>
          <div className="flex gap-2">
            {isManager && (
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4 mr-1.5" />Subir archivo
              </Button>
            )}
            {isManager && !selectedFolderData.is_default && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteFolder(selectedFolderData)}>
                <Trash2 className="h-4 w-4 mr-1.5" />Eliminar carpeta
              </Button>
            )}
          </div>
        </div>

        {/* File grid */}
        {docsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : documents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8" />
              </div>
              <p className="font-medium">Carpeta vacía</p>
              <p className="text-sm mt-1">
                {isManager ? "Sube un archivo para empezar" : "No hay documentos disponibles"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((doc: any) => (
              <Card key={doc.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <File className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ""}
                        {new Date(doc.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                      <Download className="h-3.5 w-3.5 mr-1" />Descargar
                    </Button>
                    {isManager && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteDoc(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upload dialog */}
        {showUpload && (
          <UploadDialog
            open={showUpload}
            onOpenChange={setShowUpload}
            folderId={selectedFolder}
            employeeUserId={selectedEmployee!}
          />
        )}
        <DeleteConfirmDialog open={!!deleteDoc} onConfirm={() => deleteDoc && deleteMutation.mutate(deleteDoc)} onCancel={() => setDeleteDoc(null)} title="¿Eliminar documento?" description="El archivo se eliminará permanentemente." loading={deleteMutation.isPending} />
        <DeleteConfirmDialog open={!!deleteFolder} onConfirm={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder)} onCancel={() => setDeleteFolder(null)} title="¿Eliminar carpeta?" description="Solo se puede eliminar si está vacía." loading={deleteFolderMutation.isPending} />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     VIEW: Folder grid for selected employee
     ═══════════════════════════════════════════════ */
  if (selectedEmployee && selectedEmployeeInfo) {
    return (
      <div className="space-y-4">
        {/* Back nav (only for managers who can see multiple employees) */}
        {isManager && (
          <button
            onClick={() => { setSelectedEmployee(null); setSelectedFolder(null); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a empleados
          </button>
        )}

        {/* Employee header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
              {selectedEmployeeInfo.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{selectedEmployeeInfo.displayName}</h2>
            {selectedEmployeeInfo.email && (
              <p className="text-sm text-muted-foreground">{selectedEmployeeInfo.email}</p>
            )}
          </div>
        </div>

        {/* Folder grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {employeeFolders.map((folder: any) => {
            const count = (folderCounts as Record<string, number>)[folder.id] || 0;
            return (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className="group text-left"
              >
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-5 flex flex-col items-center text-center">
                    <div className="text-4xl mb-3">
                      {FOLDER_ICONS[folder.name] || "📁"}
                    </div>
                    <p className="font-medium text-sm truncate w-full">{folder.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {count} archivo{count !== 1 ? "s" : ""}
                    </p>
                    {!folder.is_default && (
                      <Badge variant="outline" className="mt-2 text-[10px]">Personalizada</Badge>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}

          {/* Add folder card (manager only) */}
          {isManager && (
            <button onClick={() => { setShowNewFolder(true); setNewFolderName(""); }} className="text-left">
              <Card className="hover:shadow-md border-dashed hover:border-primary/30 transition-all cursor-pointer h-full">
                <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full text-muted-foreground">
                  <FolderPlus className="h-8 w-8 mb-2" />
                  <p className="text-sm font-medium">Nueva carpeta</p>
                </CardContent>
              </Card>
            </button>
          )}
        </div>

        {/* New folder dialog */}
        <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nueva Carpeta</DialogTitle>
              <DialogDescription>Crea una carpeta personalizada para {selectedEmployeeInfo.displayName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ej: Formación" />
              </div>
              <Button className="w-full" disabled={!newFolderName.trim() || createFolderMutation.isPending}
                onClick={() => createFolderMutation.mutate(newFolderName.trim())}>
                {createFolderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Crear carpeta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     VIEW: Employee cards (manager view)
     ═══════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Expedientes de empleados</h3>
      {visibleEmployees.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <User className="h-12 w-12 mb-3" />
            <p className="font-medium">No hay empleados registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleEmployees.map((emp) => {
            const empFolderCount = folders.filter((f: any) => f.user_id === emp.user_id).length;
            return (
              <button key={emp.user_id} onClick={() => setSelectedEmployee(emp.user_id)} className="text-left">
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {emp.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{emp.displayName}</p>
                      {emp.email && <p className="text-sm text-muted-foreground truncate">{emp.email}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{empFolderCount} carpeta{empFolderCount !== 1 ? "s" : ""}</p>
                    </div>
                    <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   Upload Dialog
   ═══════════════════════════════════════════════ */
const UploadDialog = ({
  open, onOpenChange, folderId, employeeUserId,
}: { open: boolean; onOpenChange: (v: boolean) => void; folderId: string; employeeUserId: string }) => {
  const { accountId, user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<globalThis.File | null>(null);
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
        account_id: accountId!, user_id: employeeUserId, name: name || file.name,
        file_path: filePath, file_type: file.type, file_size: file.size, category: "OTHER",
        uploaded_by: user!.id, folder_id: folderId,
      });
      if (insertError) throw insertError;
      toast({ title: "Documento subido" });
      queryClient.invalidateQueries({ queryKey: ["folder-documents"] });
      queryClient.invalidateQueries({ queryKey: ["folder-doc-counts"] });
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
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Subir archivo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentsTab;
