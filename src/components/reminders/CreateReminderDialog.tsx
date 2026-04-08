import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarClock, Loader2, X, FileText, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CreateReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: string;
  defaultEntityId?: string;
  defaultEntityLabel?: string;
}

const RESOURCE_TYPES = [
  { value: "INVOICE", label: "Factura", icon: <FileText className="h-3.5 w-3.5 text-primary" /> },
  { value: "EXPENSE", label: "Gasto", icon: <FileText className="h-3.5 w-3.5 text-destructive" /> },
  { value: "JOURNAL_ENTRY", label: "Asiento contable", icon: <BookOpen className="h-3.5 w-3.5 text-primary" /> },
];

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
  const [resourceType, setResourceType] = useState<string>(defaultEntityType || "");
  const [resourceId, setResourceId] = useState<string>(defaultEntityId || "");
  const [resourceLabel, setResourceLabel] = useState<string>(defaultEntityLabel || "");

  const hasDefault = !!(defaultEntityType && defaultEntityId);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRemindAt("");
    setResourceType(defaultEntityType || "");
    setResourceId(defaultEntityId || "");
    setResourceLabel(defaultEntityLabel || "");
  };

  // Fetch resources based on selected type
  const { data: resources = [], isLoading: loadingResources } = useQuery({
    queryKey: ["reminder-resources", accountId, resourceType],
    queryFn: async () => {
      if (!accountId || !resourceType) return [];

      if (resourceType === "INVOICE" || resourceType === "EXPENSE") {
        const typeFilter = resourceType === "INVOICE" ? "INVOICE" : "EXPENSE";
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, concept, amount_total, business_clients(name)")
          .eq("account_id", accountId)
          .eq("type", typeFilter)
          .order("created_at", { ascending: false })
          .limit(100);
        return (data || []).map((inv: any) => ({
          id: inv.id,
          label: `${inv.invoice_number || "Sin nº"} — ${inv.concept} (${inv.business_clients?.name || "—"}) ${Number(inv.amount_total).toFixed(2)}€`,
        }));
      }

      if (resourceType === "JOURNAL_ENTRY") {
        const { data } = await supabase
          .from("journal_entries")
          .select("id, entry_number, description, date")
          .eq("account_id", accountId)
          .order("date", { ascending: false })
          .limit(100);
        return (data || []).map((je: any) => ({
          id: je.id,
          label: `${je.entry_number || "Sin nº"} — ${je.description} (${je.date})`,
        }));
      }

      return [];
    },
    enabled: !!accountId && !!resourceType && !hasDefault,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const entityType = resourceType || null;
      const entityId = resourceId || null;
      const entityLabel = resourceLabel || null;

      const { error } = await supabase.from("reminders").insert({
        account_id: accountId!,
        created_by: user!.id,
        title,
        description,
        remind_at: new Date(remindAt).toISOString(),
        entity_type: entityType,
        entity_id: entityId,
        entity_label: entityLabel,
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
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Nuevo Recordatorio
          </DialogTitle>
          <DialogDescription>
            Configura una alerta que aparecerá en tus notificaciones.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-3 pb-1">
            <div className="space-y-1">
              <Label htmlFor="reminder-title" className="text-xs">Título *</Label>
              <Input
                id="reminder-title"
                placeholder="Ej: Revisar factura pendiente"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="reminder-desc" className="text-xs">Descripción</Label>
              <Textarea
                id="reminder-desc"
                placeholder="Detalles adicionales..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="text-sm min-h-[52px]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="reminder-date" className="text-xs">Fecha y hora *</Label>
              <Input
                id="reminder-date"
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                className="h-8 text-sm"
              />
            </div>

            {/* Resource linking */}
            <div className="space-y-1.5">
              <Label className="text-xs">Vincular a recurso (opcional)</Label>

              {hasDefault ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2 text-xs">
                  {RESOURCE_TYPES.find((t) => t.value === resourceType)?.icon}
                  <span className="flex-1 min-w-0 truncate">
                    <span className="font-medium text-muted-foreground mr-1">
                      {RESOURCE_TYPES.find((t) => t.value === resourceType)?.label}:
                    </span>
                    {resourceLabel}
                  </span>
                </div>
              ) : (
                <>
                  <Select
                    value={resourceType || "__none__"}
                    onValueChange={(v) => {
                      const val = v === "__none__" ? "" : v;
                      setResourceType(val);
                      setResourceId("");
                      setResourceLabel("");
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder="Seleccionar tipo de recurso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin vincular</SelectItem>
                      {RESOURCE_TYPES.map((rt) => (
                        <SelectItem key={rt.value} value={rt.value}>
                          <span className="flex items-center gap-2">
                            {rt.icon} {rt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {resourceType && (
                    <Select
                      value={resourceId || "__none__"}
                      onValueChange={(v) => {
                        const val = v === "__none__" ? "" : v;
                        setResourceId(val);
                        const found = resources.find((r: any) => r.id === val);
                        setResourceLabel(found?.label || "");
                      }}
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder={loadingResources ? "Cargando..." : "Seleccionar recurso"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin seleccionar</SelectItem>
                        <ScrollArea className="max-h-[200px]">
                          {resources.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>
                              <span className="block max-w-[320px] truncate text-xs">{r.label}</span>
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                  )}

                  {resourceId && resourceLabel && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-1.5 text-xs">
                      {RESOURCE_TYPES.find((t) => t.value === resourceType)?.icon}
                      <span className="flex-1 min-w-0 truncate">{resourceLabel}</span>
                      <button
                        type="button"
                        onClick={() => { setResourceId(""); setResourceLabel(""); }}
                        className="hover:bg-foreground/10 rounded-full p-0.5 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            size="sm"
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
