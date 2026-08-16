import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Building2, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  accountId: string;
  isManager: boolean;
}

interface Brand { id: string; name: string; color: string | null; is_default: boolean }

/**
 * Quién ve qué marca.
 *
 * Dos vías, y una manda sobre la otra en cuanto a comodidad: el departamento
 * concede sus marcas a todos sus miembros, y la asignación directa cubre las
 * excepciones. Un MANAGER no aparece aquí porque ve todas las marcas de su
 * cuenta por definición — si no, el administrador se quedaría fuera de sus
 * propios datos y acabarías asignándoselas todas a mano igualmente.
 */
const BrandAccessTab = ({ accountId, isManager }: Props) => {
  const qc = useQueryClient();
  const [newDept, setNewDept] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingDept, setDeletingDept] = useState<{ id: string; name: string } | null>(null);

  /* Clave propia: esta consulta trae solo las marcas activas y cuatro
     columnas, mientras que la pestaña Marcas las trae todas y enteras.
     Compartiendo clave, la que llegara primero le servía a la otra filas
     incompletas. El sufijo mantiene el prefijo ["brands", accountId], así que
     una invalidación desde la pestaña Marcas sigue refrescando esta. */
  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ["brands", accountId, "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands").select("id, name, color, is_default")
        .eq("account_id", accountId).eq("is_active", true)
        .order("is_default", { ascending: false }).order("sort_order").order("name");
      if (error) throw error;
      return data as Brand[];
    },
    enabled: !!accountId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments").select("id, name").eq("account_id", accountId).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: deptBrands = [] } = useQuery({
    queryKey: ["department-brands", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_brands").select("department_id, brand_id").eq("account_id", accountId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: userBrands = [] } = useQuery({
    queryKey: ["user-brands", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_brands").select("user_id, brand_id").eq("account_id", accountId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  /* Empleados con su departamento: es lo que permite mostrar qué marcas hereda
     cada persona sin que haya que deducirlo. */
  const { data: people = [] } = useQuery({
    queryKey: ["brand-access-people", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, corporate_email, department_id, status")
        .eq("account_id", accountId)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const deptBrandIds = (deptId: string) =>
    deptBrands.filter((d: any) => d.department_id === deptId).map((d: any) => d.brand_id);
  const directBrandIds = (userId: string) =>
    userBrands.filter((u: any) => u.user_id === userId).map((u: any) => u.brand_id);

  const toggleDeptBrand = async (deptId: string, brandId: string, on: boolean) => {
    try {
      if (on) {
        const { error } = await supabase
          .from("department_brands").insert({ account_id: accountId, department_id: deptId, brand_id: brandId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("department_brands").delete()
          .eq("department_id", deptId).eq("brand_id", brandId);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["department-brands", accountId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleUserBrand = async (userId: string, brandId: string, on: boolean) => {
    try {
      if (on) {
        const { error } = await supabase
          .from("user_brands").insert({ account_id: accountId, user_id: userId, brand_id: brandId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_brands").delete().eq("user_id", userId).eq("brand_id", brandId);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["user-brands", accountId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const createDept = async () => {
    const name = newDept.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("departments").insert({ account_id: accountId, name });
      if (error) throw error;
      setNewDept("");
      qc.invalidateQueries({ queryKey: ["departments", accountId] });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.code === "23505" ? "Ya existe un departamento con ese nombre." : err.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const removeDept = async () => {
    if (!deletingDept) return;
    try {
      const { error } = await supabase.from("departments").delete().eq("id", deletingDept.id);
      if (error) throw error;
      toast({
        title: "Departamento eliminado",
        description: "Sus miembros dejan de heredar sus marcas; las asignaciones directas se mantienen.",
      });
      qc.invalidateQueries({ queryKey: ["departments", accountId] });
      qc.invalidateQueries({ queryKey: ["brand-access-people", accountId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingDept(null);
    }
  };

  /** Chip de marca conmutable. `inherited` la marca como venida del departamento. */
  const BrandChip = ({
    brand, on, inherited, onToggle,
  }: { brand: Brand; on: boolean; inherited?: boolean; onToggle?: (v: boolean) => void }) => (
    <button
      type="button"
      disabled={!isManager || !onToggle || inherited}
      onClick={() => onToggle?.(!on)}
      title={inherited ? "Heredada del departamento" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border px-2 py-[3px] text-[10.5px] font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/[.16]",
        inherited
          ? "cursor-default border-info-border bg-accent text-info-text"
          : on
            ? "border-primary bg-row-selected text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-popover",
        (!isManager || inherited) && "cursor-default",
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: brand.color || "hsl(var(--faint))" }}
        aria-hidden
      />
      {brand.name}
      {inherited && <span className="text-faint">·dpto</span>}
    </button>
  );

  if (loadingBrands) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-faint" /></div>;
  }

  if (brands.length === 0) {
    return (
      <Card className="px-[18px] py-8 text-center">
        <p className="text-xs font-semibold text-foreground">Todavía no hay marcas</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Crea primero una marca en Configuración → Marcas.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Departamentos ──────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[12.5px] font-semibold text-foreground">Departamentos</h2>
          <p className="mt-0.5 text-[11.5px] leading-[1.6] text-muted-foreground">
            Las marcas de un departamento las heredan todos sus miembros. Es la vía cómoda cuando
            un equipo entero trabaja sobre la misma marca.
          </p>
        </div>

        {isManager && (
          <div className="flex gap-2">
            <Input
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createDept()}
              placeholder="Nombre del departamento"
              className="max-w-[280px]"
            />
            <Button onClick={createDept} disabled={creating || !newDept.trim()}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              Añadir
            </Button>
          </div>
        )}

        {departments.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground">Todavía no hay departamentos.</p>
        ) : (
          <div className="space-y-2">
            {departments.map((d: any) => {
              const assigned = deptBrandIds(d.id);
              const members = people.filter((p: any) => p.department_id === d.id).length;
              return (
                <Card key={d.id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
                  <div className="min-w-[160px]">
                    <p className="text-xs font-semibold text-foreground">{d.name}</p>
                    <p className="tnum text-[10.5px] text-muted-foreground">
                      {members} {members === 1 ? "persona" : "personas"}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {brands.map((b) => (
                      <BrandChip
                        key={b.id}
                        brand={b}
                        on={assigned.includes(b.id)}
                        onToggle={(v) => toggleDeptBrand(d.id, b.id, v)}
                      />
                    ))}
                  </div>
                  {isManager && (
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setDeletingDept({ id: d.id, name: d.name })}
                      aria-label={`Eliminar ${d.name}`}
                      className="text-destructive-text hover:bg-destructive-surface"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Personas ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[12.5px] font-semibold text-foreground">Personas</h2>
          <p className="mt-0.5 text-[11.5px] leading-[1.6] text-muted-foreground">
            Asignación directa, para las excepciones. Las marcas en azul vienen del departamento y
            se quitan desde ahí, no desde aquí.
          </p>
        </div>

        {people.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground">No hay empleados dados de alta.</p>
        ) : (
          <div className="space-y-2">
            {people.map((p: any) => {
              const inherited = p.department_id ? deptBrandIds(p.department_id) : [];
              const direct = directBrandIds(p.user_id);
              const dept = departments.find((d: any) => d.id === p.department_id);
              return (
                <Card key={p.user_id} className="flex flex-wrap items-center gap-3 px-[18px] py-3">
                  <div className="min-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground">
                        {[p.first_name, p.last_name].filter(Boolean).join(" ") || "Sin nombre"}
                      </p>
                      {p.status && p.status !== "ACTIVE" && <Badge variant="muted">Inactivo</Badge>}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">
                      {dept?.name || <span className="text-faint">Sin departamento</span>}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {brands.map((b) => {
                      const isInherited = inherited.includes(b.id);
                      return (
                        <BrandChip
                          key={b.id}
                          brand={b}
                          on={isInherited || direct.includes(b.id)}
                          inherited={isInherited}
                          onToggle={(v) => toggleUserBrand(p.user_id, b.id, v)}
                        />
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-control border border-border bg-muted px-3 py-2.5 text-[11.5px] leading-[1.6] text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 stroke-[1.8] text-faint" />
        Los administradores ven todas las marcas de la cuenta sin necesidad de asignárselas, así
        que no aparecen en esta lista.
      </div>

      <AlertDialog open={!!deletingDept} onOpenChange={(o) => !o && setDeletingDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deletingDept?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sus miembros dejarán de heredar las marcas del departamento. Las asignaciones
              directas que tengan se mantienen, y los empleados no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeDept}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BrandAccessTab;
