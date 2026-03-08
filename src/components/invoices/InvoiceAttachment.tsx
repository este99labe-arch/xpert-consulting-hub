import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  accountId: string;
  invoiceId?: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  onUploaded: (path: string, name: string) => void;
  onRemoved?: () => void;
  readOnly?: boolean;
}

const InvoiceAttachment = ({
  accountId, invoiceId, attachmentPath, attachmentName, onUploaded, onRemoved, readOnly,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "El archivo no puede superar 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `${accountId}/${invoiceId || crypto.randomUUID()}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("invoice-attachments").upload(filePath, file, { upsert: true });
      if (error) throw error;
      onUploaded(filePath, file.name);
      toast({ title: "Archivo adjuntado" });
    } catch (err: any) {
      toast({ title: "Error al subir archivo", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!attachmentPath) return;
    try {
      const { data, error } = await supabase.storage
        .from("invoice-attachments")
        .createSignedUrl(attachmentPath, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (attachmentPath && attachmentName) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm truncate flex-1">{attachmentName}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        {!readOnly && onRemoved && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemoved}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  if (readOnly) return null;

  return (
    <div>
      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Paperclip className="h-4 w-4 mr-1" />}
        {uploading ? "Subiendo..." : "Adjuntar archivo"}
      </Button>
    </div>
  );
};

export default InvoiceAttachment;
