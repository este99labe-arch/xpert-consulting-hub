import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Building2, FileText, Receipt, BookOpen, Package, FileBarChart } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type LinkEntityType = "CLIENT" | "INVOICE" | "EXPENSE" | "QUOTE" | "JOURNAL_ENTRY" | "PRODUCT";

export interface TaskLink {
  id: string;
  task_id: string;
  entity_type: LinkEntityType;
  entity_id: string;
  entity_label: string | null;
}

const ENTITY_TYPES: { value: LinkEntityType; label: string; icon: any }[] = [
  { value: "CLIENT", label: "Cliente", icon: Building2 },
  { value: "INVOICE", label: "Factura", icon: FileText },
  { value: "EXPENSE", label: "Gasto", icon: Receipt },
  { value: "QUOTE", label: "Presupuesto", icon: FileBarChart },
  { value: "JOURNAL_ENTRY", label: "Asiento contable", icon: BookOpen },
  { value: "PRODUCT", label: "Producto", icon: Package },
];

const getIcon = (type: string) => ENTITY_TYPES.find((e) => e.value === type)?.icon || FileText;
const getTypeLabel = (type: string) => ENTITY_TYPES.find((e) => e.value === type)?.label || type;

// Fetch options for the selected entity type
const useEntityOptions = (entityType: LinkEntityType | null) => {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["task-link-options", entityType, accountId],
    queryFn: async () => {
      if (!entityType) return [];
      if (entityType === "CLIENT") {
        const { data } = await supabase.from("business_clients").select("id, name").order("name");
        return (data || []).map((c: any) => ({ id: c.id, label: c.name }));
      }
      if (entityType === "INVOICE" || entityType === "EXPENSE" || entityType === "QUOTE") {
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, concept")
          .eq("type", entityType)
          .order("created_at", { ascending: false })
          .limit(200);
        return (data || []).map((i: any) => ({
          id: i.id,
          label: `${i.invoice_number || "S/N"} — ${i.concept || ""}`.trim(),
        }));
      }
      if (entityType === "JOURNAL_ENTRY") {
        const { data } = await supabase
          .from("journal_entries")
          .select("id, entry_number, description, date")
          .order("date", { ascending: false })
          .limit(200);
        return (data || []).map((j: any) => ({
          id: j.id,
          label: `${j.entry_number || "S/N"} — ${j.description || ""}`.trim(),
        }));
      }
      if (entityType === "PRODUCT") {
        const { data } = await supabase
          .from("products")
          .select("id, sku, name")
          .eq("is_active", true)
          .order("name");
        return (data || []).map((p: any) => ({ id: p.id, label: `${p.sku} — ${p.name}` }));
      }
      return [];
    },
    enabled: !!entityType && !!accountId,
  });
};

export const useTaskLinks = (taskId?: string) => {
  return useQuery({
    queryKey: ["task-links", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_links")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as TaskLink[];
    },
    enabled: !!taskId,
  });
};

interface Props {
  taskId?: string; // when undefined, operates in "draft" mode (used in CreateTaskDialog)
  draftLinks?: Omit<TaskLink, "id" | "task_id">[];
  onDraftChange?: (links: Omit<TaskLink, "id" | "task_id">[]) => void;
}

const TaskLinksManager = ({ taskId, draftLinks, onDraftChange }: Props) => {
  const qc = useQueryClient();
  const { user, accountId } = useAuth();
  const isDraft = !taskId;

  const { data: persistedLinks = [] } = useTaskLinks(taskId);
  const [adding, setAdding] = useState(false);
  const [selType, setSelType] = useState<LinkEntityType | "">("");
  const [selId, setSelId] = useState("");
  const { data: options = [] } = useEntityOptions(selType || null);

  useEffect(() => {
    setSelId("");
  }, [selType]);

  const addLink = useMutation({
    mutationFn: async () => {
      if (!user || !accountId || !taskId || !selType || !selId) throw new Error("Datos incompletos");
      const label = options.find((o) => o.id === selId)?.label || null;
      const { error } = await supabase.from("task_links").insert({
        account_id: accountId,
        task_id: taskId,
        created_by: user.id,
        entity_type: selType,
        entity_id: selId,
        entity_label: label,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-links", taskId] });
      setAdding(false);
      setSelType("");
      setSelId("");
      toast({ title: "Vínculo añadido" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-links", taskId] });
    },
  });

  const handleAdd = () => {
    if (!selType || !selId) return;
    if (isDraft) {
      const label = options.find((o) => o.id === selId)?.label || null;
      const next = [
        ...(draftLinks || []),
        { entity_type: selType as LinkEntityType, entity_id: selId, entity_label: label },
      ];
      onDraftChange?.(next);
      setAdding(false);
      setSelType("");
      setSelId("");
    } else {
      addLink.mutate();
    }
  };

  const handleRemove = (idxOrId: string | number) => {
    if (isDraft) {
      const next = (draftLinks || []).filter((_, i) => i !== idxOrId);
      onDraftChange?.(next);
    } else {
      removeLink.mutate(idxOrId as string);
    }
  };

  const linksToShow = isDraft ? (draftLinks || []) : persistedLinks;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Vinculaciones ({linksToShow.length})</Label>
        {!adding && (
          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {linksToShow.map((l, idx) => {
          const Icon = getIcon(l.entity_type);
          return (
            <Badge key={isDraft ? idx : (l as TaskLink).id} variant="secondary" className="gap-1 max-w-full">
              <Icon className="h-3 w-3 shrink-0" />
              <span className="text-[10px] uppercase opacity-70">{getTypeLabel(l.entity_type)}:</span>
              <span className="truncate max-w-[200px]">{l.entity_label || l.entity_id.slice(0, 8)}</span>
              <button
                onClick={() => handleRemove(isDraft ? idx : (l as TaskLink).id)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {linksToShow.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground">Sin vinculaciones</p>
        )}
      </div>

      {adding && (
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto_auto] gap-2 p-2 rounded border bg-muted/30">
          <Select value={selType} onValueChange={(v) => setSelType(v as LinkEntityType)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((e) => {
                const I = e.icon;
                return (
                  <SelectItem key={e.value} value={e.value}>
                    <span className="flex items-center gap-2"><I className="h-3.5 w-3.5" />{e.label}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={selId} onValueChange={setSelId} disabled={!selType}>
            <SelectTrigger className="h-8"><SelectValue placeholder={selType ? "Selecciona elemento" : "Elige tipo primero"} /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
              {options.length === 0 && selType && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin elementos disponibles</div>
              )}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!selType || !selId || addLink.isPending}>
            Añadir
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setSelType(""); setSelId(""); }}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskLinksManager;
