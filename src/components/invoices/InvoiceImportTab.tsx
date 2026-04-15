import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Eye, Trash2, Import, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PROCESSING: { label: "Procesando", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Loader2 },
  READY: { label: "Listo", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  ERROR: { label: "Revisar", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: AlertCircle },
  IMPORTED: { label: "Importado", color: "bg-muted text-muted-foreground", icon: Import },
};

const InvoiceImportTab = () => {
  const { accountId, user, role } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  const [uploading, setUploading] = useState(false);
  const [reviewImport, setReviewImport] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Fetch imports
  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["invoice_imports", accountId, statusFilter],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("invoice_imports")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients for matching
  const { data: clients = [] } = useQuery({
    queryKey: ["business_clients", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_clients")
        .select("id, name, tax_id")
        .eq("account_id", accountId!)
        .eq("status", "ACTIVE");
      return data || [];
    },
  });

  // Fetch account info (for expenses auto-assignment)
  const { data: accountInfo } = useQuery({
    queryKey: ["account_info", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, name, tax_id")
        .eq("id", accountId!)
        .single();
      return data;
    },
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !accountId || !user) return;

    const maxSize = 20 * 1024 * 1024; // 20MB raw limit before compression
    const validFiles = files.filter(f => {
      if (f.size > maxSize) {
        toast({ title: "Archivo omitido", description: `${f.name} supera 20MB`, variant: "destructive" });
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;
    setUploading(true);

    try {
      for (let file of validFiles) {
        let fileName = file.name;
        let fileType = file.type || "application/octet-stream";
        const lowerName = fileName.toLowerCase();

        // Convert HEIC/HEIF to JPEG
        if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif") || fileType === "image/heic" || fileType === "image/heif") {
          try {
            const heic2any = (await import("heic2any")).default;
            const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
            const resultBlob = Array.isArray(converted) ? converted[0] : converted;
            fileName = fileName.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
            fileType = "image/jpeg";
            file = new File([resultBlob], fileName, { type: fileType });
          } catch (convErr) {
            console.error("HEIC conversion error:", convErr);
            toast({ title: "Error", description: `No se pudo convertir ${fileName} de HEIC a JPEG`, variant: "destructive" });
            continue;
          }
        }

        // Compress images (JPEG, PNG, WebP) to max 2MB / 1920px
        if (fileType.startsWith("image/") && file.size > 500 * 1024) {
          try {
            const imageCompression = (await import("browser-image-compression")).default;
            file = await imageCompression(file, {
              maxSizeMB: 2,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
              fileType: fileType as string,
            });
            fileName = file.name;
          } catch (compErr) {
            console.warn("Image compression failed, uploading original:", compErr);
          }
        }

        const ext = fileName.split(".").pop() || "bin";
        const filePath = `${accountId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("import-files")
          .upload(filePath, file, { upsert: false });
        if (uploadErr) {
          toast({ title: "Error", description: `Error subiendo ${file.name}: ${uploadErr.message}`, variant: "destructive" });
          continue;
        }

        const { data: importRecord, error: insertErr } = await supabase
          .from("invoice_imports")
          .insert({
            account_id: accountId,
            file_path: filePath,
            file_name: file.name,
            file_type: fileType,
            status: "PROCESSING",
            uploaded_by: user.id,
          })
          .select("id")
          .single();

        if (insertErr) {
          toast({ title: "Error", description: insertErr.message, variant: "destructive" });
          continue;
        }

        supabase.functions.invoke("extract_invoice_data", {
          body: { import_id: importRecord.id },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["invoice_imports"] });
        }).catch(err => {
          console.error("Extraction error:", err);
          queryClient.invalidateQueries({ queryKey: ["invoice_imports"] });
        });
      }

      toast({ title: "Archivos subidos", description: `${validFiles.length} archivo(s) en cola de procesamiento` });
      queryClient.invalidateQueries({ queryKey: ["invoice_imports"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [accountId, user, queryClient]);

  const openReview = (imp: any) => {
    const data = imp.extracted_data || {};
    // For expenses, pre-select the account's own business_client if exists
    if (data.type === "EXPENSE" && !data.selected_client_id && accountInfo) {
      // Find the business_client that matches the account (by name or tax_id)
      const ownClient = clients.find(c =>
        c.name.toLowerCase() === accountInfo.name.toLowerCase() ||
        (accountInfo.tax_id && c.tax_id?.replace(/[^A-Z0-9]/gi, "").toUpperCase() === accountInfo.tax_id.replace(/[^A-Z0-9]/gi, "").toUpperCase())
      );
      if (ownClient) {
        data.selected_client_id = ownClient.id;
      }
    }
    // For invoices with matched client from AI
    if (data.type === "INVOICE" && data.matched_client_id && !data.selected_client_id) {
      data.selected_client_id = data.matched_client_id;
    }
    setReviewImport(imp);
    setEditedData(data);
  };

  const handleConfirmImport = async () => {
    if (!reviewImport || !editedData || !accountId || !user) return;

    const type = editedData.type === "EXPENSE" ? "EXPENSE" : "INVOICE";
    let clientId = editedData.selected_client_id;

    // If no client selected, try matching
    if (!clientId) {
      const taxId = editedData.client_tax_id?.trim();
      const clientName = editedData.client_name?.trim();

      if (taxId) {
        const match = clients.find(c => c.tax_id?.replace(/[^A-Z0-9]/gi, "").toUpperCase() === taxId.replace(/[^A-Z0-9]/gi, "").toUpperCase());
        if (match) clientId = match.id;
      }
      if (!clientId && clientName) {
        const match = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
        if (match) clientId = match.id;
      }
    }

    if (!clientId) {
      toast({ title: "Cliente requerido", description: "Selecciona un cliente antes de importar", variant: "destructive" });
      return;
    }

    setImporting(true);

    try {
      const amountNet = Number(editedData.amount_net) || 0;
      const vatPct = Number(editedData.vat_percentage) || 0;
      const amountVat = Number(editedData.amount_vat) || amountNet * vatPct / 100;
      const irpfPct = Number(editedData.irpf_percentage) || 0;
      const irpfAmount = Number(editedData.irpf_amount) || amountNet * irpfPct / 100;
      const amountTotal = Number(editedData.amount_total) || (amountNet + amountVat - irpfAmount);

      // Copy file to invoice-attachments bucket first
      const { data: fileData } = await supabase.storage.from("import-files").download(reviewImport.file_path);
      let attachPath = reviewImport.file_path;
      let attachName = reviewImport.file_name;

      if (fileData) {
        attachPath = `${accountId}/${crypto.randomUUID()}.${reviewImport.file_name.split(".").pop()}`;
        await supabase.storage.from("invoice-attachments").upload(attachPath, fileData, { upsert: true });
      }

      // Create invoice with attachment
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          account_id: accountId,
          client_id: clientId,
          type,
          concept: editedData.concept || "Factura importada",
          description: editedData.invoice_number_original ? `Nº original: ${editedData.invoice_number_original}` : null,
          amount_net: amountNet,
          vat_percentage: vatPct,
          amount_vat: amountVat,
          irpf_percentage: irpfPct,
          irpf_amount: irpfAmount,
          amount_total: amountTotal,
          issue_date: editedData.issue_date || new Date().toISOString().split("T")[0],
          status: type === "EXPENSE" ? "PAID" : "DRAFT",
          paid_at: type === "EXPENSE" ? new Date().toISOString() : null,
          attachment_path: attachPath,
          attachment_name: attachName,
        })
        .select("id")
        .single();

      if (invErr) throw invErr;

      // Insert invoice lines if available
      const lines = editedData.lines;
      if (Array.isArray(lines) && lines.length > 0) {
        const lineInserts = lines.map((l: any, i: number) => ({
          invoice_id: invoice.id,
          account_id: accountId,
          description: l.description || "",
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
          amount: Number(l.amount) || 0,
          sort_order: i,
        }));
        await supabase.from("invoice_lines").insert(lineInserts);
      }

      // Mark import as done
      await supabase.from("invoice_imports").update({
        status: "IMPORTED",
        created_invoice_id: invoice.id,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", reviewImport.id);

      toast({ title: "Factura importada", description: `${type === "INVOICE" ? "Factura creada en borrador" : "Gasto importado como pagado"} con archivo adjunto` });
      setReviewImport(null);
      queryClient.invalidateQueries({ queryKey: ["invoice_imports"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error al importar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (imp: any) => {
    try {
      await supabase.storage.from("import-files").remove([imp.file_path]);
      await supabase.from("invoice_imports").delete().eq("id", imp.id);
      queryClient.invalidateQueries({ queryKey: ["invoice_imports"] });
      toast({ title: "Eliminado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRetry = async (imp: any) => {
    await supabase.from("invoice_imports").update({ status: "PROCESSING", error_message: null, extracted_data: {} }).eq("id", imp.id);
    queryClient.invalidateQueries({ queryKey: ["invoice_imports"] });
    supabase.functions.invoke("extract_invoice_data", { body: { import_id: imp.id } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["invoice_imports"] }));
    toast({ title: "Reprocesando..." });
  };

  const updateField = (field: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [field]: value }));
  };

  const pendingCount = imports.filter((i: any) => i.status === "READY" || i.status === "ERROR").length;
  const processingCount = imports.filter((i: any) => i.status === "PROCESSING").length;

  return (
    <div className="space-y-6">
      {/* Header + Upload */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Cola de importación</h2>
          <p className="text-sm text-muted-foreground">
            Sube facturas o gastos y la IA extraerá los datos automáticamente
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
            onChange={handleUpload}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? "Subiendo..." : "Subir archivos"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{imports.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Procesando</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{processingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{pendingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Importados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {imports.filter((i: any) => i.status === "IMPORTED").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="PROCESSING">Procesando</SelectItem>
            <SelectItem value="READY">Listos</SelectItem>
            <SelectItem value="ERROR">Revisar</SelectItem>
            <SelectItem value="IMPORTED">Importados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["invoice_imports"] })}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Confianza</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : imports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay importaciones. Sube archivos para comenzar.
                  </TableCell>
                </TableRow>
              ) : (
                imports.map((imp: any) => {
                  const sc = statusConfig[imp.status] || statusConfig.ERROR;
                  const Icon = sc.icon;
                  const ext = imp.extracted_data || {};
                  return (
                    <TableRow key={imp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate max-w-[200px]">{imp.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${sc.color} gap-1`}>
                          <Icon className={`h-3 w-3 ${imp.status === "PROCESSING" ? "animate-spin" : ""}`} />
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ext.type === "EXPENSE" ? "Gasto" : ext.type === "INVOICE" ? "Factura" : "—"}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]">
                        {ext.concept || imp.error_message || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {ext.amount_total ? `€${Number(ext.amount_total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell>
                        {ext.confidence != null ? (
                          <span className={`text-sm font-medium ${ext.confidence >= 80 ? "text-green-600" : ext.confidence >= 60 ? "text-amber-600" : "text-red-600"}`}>
                            {ext.confidence}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(imp.created_at), "dd/MM/yy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(imp.status === "READY" || imp.status === "ERROR") && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openReview(imp)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {imp.status === "ERROR" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRetry(imp)}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {imp.status !== "IMPORTED" && isManager && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(imp)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review/Edit Dialog */}
      <Dialog open={!!reviewImport} onOpenChange={(o) => !o && setReviewImport(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar importación</DialogTitle>
            <DialogDescription>
              Revisa y corrige los datos extraídos antes de crear la factura.
              Archivo: <span className="font-medium">{reviewImport?.file_name}</span>
            </DialogDescription>
          </DialogHeader>

          {editedData && (
            <div className="grid gap-4 py-2">
              {reviewImport?.error_message && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {reviewImport.error_message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editedData.type || "INVOICE"} onValueChange={v => updateField("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INVOICE">Factura</SelectItem>
                      <SelectItem value="EXPENSE">Gasto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha emisión</Label>
                  <Input
                    type="date"
                    value={editedData.issue_date || ""}
                    onChange={e => updateField("issue_date", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Concepto</Label>
                <Input value={editedData.concept || ""} onChange={e => updateField("concept", e.target.value)} />
              </div>

              {/* Client selection */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Cliente / Proveedor asignado *</Label>
                  <Select
                    value={editedData.selected_client_id || ""}
                    onValueChange={v => updateField("selected_client_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.tax_id ? `(${c.tax_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente detectado (IA)</Label>
                  <Input value={editedData.client_name || ""} onChange={e => updateField("client_name", e.target.value)} className="text-muted-foreground" />
                </div>
                <div>
                  <Label className="text-muted-foreground">NIF/CIF detectado</Label>
                  <Input value={editedData.client_tax_id || ""} onChange={e => updateField("client_tax_id", e.target.value)} className="text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nº factura original</Label>
                  <Input value={editedData.invoice_number_original || ""} onChange={e => updateField("invoice_number_original", e.target.value)} />
                </div>
                <div>
                  <Label>Confianza IA</Label>
                  <div className="flex items-center h-10">
                    <span className={`font-semibold ${(editedData.confidence || 0) >= 80 ? "text-green-600" : (editedData.confidence || 0) >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {editedData.confidence || 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Base imponible</Label>
                  <Input type="number" step="0.01" value={editedData.amount_net ?? ""} onChange={e => updateField("amount_net", e.target.value)} />
                </div>
                <div>
                  <Label>% IVA</Label>
                  <Input type="number" step="0.01" value={editedData.vat_percentage ?? ""} onChange={e => updateField("vat_percentage", e.target.value)} />
                </div>
                <div>
                  <Label>IVA</Label>
                  <Input type="number" step="0.01" value={editedData.amount_vat ?? ""} onChange={e => updateField("amount_vat", e.target.value)} />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input type="number" step="0.01" value={editedData.amount_total ?? ""} onChange={e => updateField("amount_total", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>% IRPF</Label>
                  <Input type="number" step="0.01" value={editedData.irpf_percentage ?? "0"} onChange={e => updateField("irpf_percentage", e.target.value)} />
                </div>
                <div>
                  <Label>IRPF</Label>
                  <Input type="number" step="0.01" value={editedData.irpf_amount ?? "0"} onChange={e => updateField("irpf_amount", e.target.value)} />
                </div>
              </div>

              {/* Lines preview */}
              {Array.isArray(editedData.lines) && editedData.lines.length > 0 && (
                <div>
                  <Label className="mb-2 block">Líneas detectadas</Label>
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">P. Unit.</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editedData.lines.map((line: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{line.description || "—"}</TableCell>
                            <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                            <TableCell className="text-right text-sm">{Number(line.unit_price).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-sm">{Number(line.amount).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewImport(null)}>Cancelar</Button>
            <Button onClick={handleConfirmImport} disabled={importing || !editedData?.selected_client_id}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Import className="h-4 w-4 mr-2" />}
              {importing ? "Importando..." : "Confirmar e importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceImportTab;
