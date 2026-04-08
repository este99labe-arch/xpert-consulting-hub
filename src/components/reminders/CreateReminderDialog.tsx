import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2, X, Search, FileText, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CreateReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: string;
  defaultEntityId?: string;
  defaultEntityLabel?: string;
}

const entityTypeLabels: Record<string, string> = {
  INVOICE: "Factura",
  EXPENSE: "Gasto",
  JOURNAL_ENTRY: "Asiento contable",
};

const entityTypeIcons: Record<string, React.ReactNode> = {
  INVOICE: <FileText className="h-3.5 w-3.5 text-blue-500" />,
  EXPENSE: <FileText className="h-3.5 w-3.5 text-red-500" />,
  JOURNAL_ENTRY: <BookOpen className="h-3.5 w-3.5 text-purple-500" />,
};

interface LinkedResource {
  type: string;
  id: string;
  label: string;
}

const CreateReminderDialog = ({
  open,
  onOpenChange,
  defaultEntityType,
  defaultEntityId,
  defaultEntityLabel,
}: CreateReminderDialogProps) => {
  const { user, accountId } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [linkedResource, setLinkedResource] = useState<LinkedResource | null>(
    defaultEntityType && defaultEntityId && defaultEntityLabel
      ? { type: defaultEntityType, id: defaultEntityId, label: defaultEntityLabel }
      : null
  );
  const [resourceSearch, setResourceSearch] = useState("");
  const [showResourcePicker, setShowResourcePicker] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRemindAt("");
    setLinkedResource(
      defaultEntityType && defaultEntityId && defaultEntityLabel
        ? { type: defaultEntityType, id: defaultEntityId, label: defaultEntityLabel }
        : null
    );
    setResourceSearch("");
    setShowResourcePicker(false);
  };

  // Search invoices/expenses
  const { data: invoiceResults = [] } = useQuery({
    queryKey: ["resource-search-invoices", accountId, resourceSearch],
    queryFn: async () => {
      if (!accountId || !resourceSearch.trim()) return [];
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, concept, type, amount_total, business_clients(name)")
        .eq("account_id", accountId)
        .or(`invoice_number.ilike.%${resourceSearch}%,concept.ilike.%${resourceSearch}%`)
        .limit(8);
      return (data || []).map((inv: any) => ({
        type: inv.type === "EXPENSE" ? "EXPENSE" : "INVOICE",
        id: inv.id,
        label: `${inv.invoice_number || "Sin nº"} — ${inv.concept} (${inv.business_clients?.name || ""}) ${Number(inv.amount_total).toFixed(2)}€`,
      }));
    },
    enabled: showResourcePicker && resourceSearch.trim().length >= 2,
  });

  // Search journal entries
  const { data: journalResults = [] } = useQuery({
    queryKey: ["resource-search-journals", accountId, resourceSearch],
    queryFn: async () => {
      if (!accountId || !resourceSearch.trim()) return [];
      const { data } = await supabase
        .from("journal_entries")
        .select("id, entry_number, description, date")
        .eq("account_id", accountId)
        .or(`entry_number.ilike.%${resourceSearch}%,description.ilike.%${resourceSearch}%`)
        .limit(5);
      return (data || []).map((je: any) => ({
        type: "JOURNAL_ENTRY",
        id: je.id,
        label: `${je.entry_number || "Sin nº"} — ${je.description} (${je.date})`,
      }));
    },
    enabled: showResourcePicker && resourceSearch.trim().length >= 2,
  });

  const allResults = [...invoiceResults, ...journalResults];

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reminders").insert({
        account_id: accountId!,
        created_by: user!.id,
        title,
        description,
        remind_at: new Date(remindAt).toISOString(),
        entity_type: linkedResource?.type || null,
        entity_id: linkedResource?.id || null,
        entity_label: linkedResource?.label || null,
        labels: [],
        status: "REMINDER",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Recordatorio creado", description: `Se te notificará el ${format(new Date(remindAt), "dd/MM/yyyy HH:mm")}` });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["reminders-all"] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el recordatorio", variant: "destructive" });
    },
  });

  const canSubmit = title.trim() && remindAt && new Date(remindAt) > new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Nuevo Recordatorio
          </DialogTitle>
          <DialogDescription>
            Configura una alerta que aparecerá en tus notificaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reminder-title">Título *</Label>
            <Input
              id="reminder-title"
              placeholder="Ej: Revisar factura pendiente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-desc">Descripción</Label>
            <Textarea
              id="reminder-desc"
              placeholder="Detalles adicionales..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-date">Fecha y hora del recordatorio *</Label>
            <Input
              id="reminder-date"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          {/* Linked resource */}
          <div className="space-y-1.5">
            <Label>Vincular a recurso (opcional)</Label>

            {linkedResource ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5 text-sm">
                {entityTypeIcons[linkedResource.type]}
                <span className="flex-1 truncate">
                  <span className="font-medium text-muted-foreground mr-1">
                    {entityTypeLabels[linkedResource.type] || linkedResource.type}:
                  </span>
                  {linkedResource.label}
                </span>
                {!defaultEntityId && (
                  <button
                    type="button"
                    onClick={() => setLinkedResource(null)}
                    className="hover:bg-foreground/10 rounded-full p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar factura, gasto o asiento..."
                    value={resourceSearch}
                    onChange={(e) => {
                      setResourceSearch(e.target.value);
                      setShowResourcePicker(true);
                    }}
                    onFocus={() => setShowResourcePicker(true)}
                    className="h-9 pl-8 text-sm"
                  />
                </div>

                {showResourcePicker && resourceSearch.trim().length >= 2 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
                    {allResults.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">Sin resultados</p>
                    ) : (
                      allResults.map((r) => (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => {
                            setLinkedResource(r);
                            setResourceSearch("");
                            setShowResourcePicker(false);
                          }}
                        >
                          {entityTypeIcons[r.type]}
                          <span className="truncate">{r.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Crear Recordatorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReminderDialog;
