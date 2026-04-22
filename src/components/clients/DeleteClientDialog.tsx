import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  clientId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = "ONLY" | "CASCADE";

const DeleteClientDialog = ({ open, clientId, onClose, onSuccess }: Props) => {
  const [mode, setMode] = useState<Mode>("ONLY");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      if (mode === "CASCADE") {
        // Get all invoice IDs for this client
        const { data: invoices, error: invErr } = await supabase
          .from("invoices")
          .select("id")
          .eq("client_id", clientId);
        if (invErr) throw invErr;

        const invoiceIds = (invoices || []).map((i) => i.id);

        if (invoiceIds.length > 0) {
          // Get journal entries linked to these invoices
          const { data: entries, error: entErr } = await supabase
            .from("journal_entries")
            .select("id")
            .in("invoice_id", invoiceIds);
          if (entErr) throw entErr;
          const entryIds = (entries || []).map((e) => e.id);

          // Delete journal entry lines + entries
          if (entryIds.length > 0) {
            const { error: e1 } = await supabase
              .from("journal_entry_lines")
              .delete()
              .in("entry_id", entryIds);
            if (e1) throw e1;
            const { error: e2 } = await supabase
              .from("journal_entries")
              .delete()
              .in("id", entryIds);
            if (e2) throw e2;
          }

          // Delete invoice payments
          const { error: payErr } = await supabase
            .from("invoice_payments")
            .delete()
            .in("invoice_id", invoiceIds);
          if (payErr) throw payErr;

          // Delete invoice lines
          const { error: lineErr } = await supabase
            .from("invoice_lines")
            .delete()
            .in("invoice_id", invoiceIds);
          if (lineErr) throw lineErr;

          // Delete reconciliation matches
          await supabase
            .from("reconciliation_matches")
            .delete()
            .in("invoice_id", invoiceIds);

          // Delete email logs
          await supabase
            .from("email_log")
            .delete()
            .in("invoice_id", invoiceIds);

          // Delete invoice delete requests
          await supabase
            .from("invoice_delete_requests")
            .delete()
            .in("invoice_id", invoiceIds);

          // Finally delete invoices
          const { error: invDelErr } = await supabase
            .from("invoices")
            .delete()
            .in("id", invoiceIds);
          if (invDelErr) throw invDelErr;
        }

        // Related records that reference client_id directly
        await supabase.from("client_contacts").delete().eq("client_id", clientId);
        await supabase.from("recurring_invoices").delete().eq("client_id", clientId);
        await supabase.from("reminders").delete().eq("client_id", clientId);
      }

      // Finally, delete the client
      const { error } = await supabase
        .from("business_clients")
        .delete()
        .eq("id", clientId);
      if (error) throw error;

      toast({
        title: mode === "CASCADE" ? "Cliente y datos eliminados" : "Cliente eliminado",
      });
      onSuccess();
      onClose();
      setMode("ONLY");
    } catch (err: any) {
      toast({
        title: "Error al eliminar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
          <AlertDialogDescription>
            Elige cómo quieres eliminar este cliente. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-3 my-2">
          <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="ONLY" id="only" className="mt-1" />
            <Label htmlFor="only" className="flex-1 cursor-pointer font-normal">
              <div className="font-medium">Solo el cliente</div>
              <div className="text-sm text-muted-foreground">
                Elimina únicamente la ficha del cliente. Fallará si tiene facturas u otros datos asociados.
              </div>
            </Label>
          </div>
          <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/40 border-destructive/40">
            <RadioGroupItem value="CASCADE" id="cascade" className="mt-1" />
            <Label htmlFor="cascade" className="flex-1 cursor-pointer font-normal">
              <div className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Cliente y todos sus datos
              </div>
              <div className="text-sm text-muted-foreground">
                Elimina facturas, gastos, asientos contables, cobros, contactos, recordatorios y facturación recurrente asociados.
              </div>
            </Label>
          </div>
        </RadioGroup>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteClientDialog;
