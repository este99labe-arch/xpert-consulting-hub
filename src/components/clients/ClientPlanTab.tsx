import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  client: any;
  accountId: string;
  onSave: (updates: Record<string, any>) => void;
  saving: boolean;
}

const ClientPlanTab = ({ client, accountId, onSave, saving }: Props) => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["client-plans", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_plans")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const assignPlan = (planId: string | null) => {
    onSave({ plan_id: planId });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Plan Comercial</h3>
          <p className="text-sm text-muted-foreground">Asigna un plan/tarifa a este cliente</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Plan
        </Button>
      </div>

      {client.plan_id && (
        <Button variant="ghost" size="sm" onClick={() => assignPlan(null)} disabled={saving}>
          Quitar plan asignado
        </Button>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan: any) => {
          const isSelected = client.plan_id === plan.id;
          return (
            <Card
              key={plan.id}
              className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => !saving && assignPlan(plan.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isSelected && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" /> Actual
                    </Badge>
                  )}
                </div>
                <CardDescription>{plan.description || "Sin descripción"}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {plan.price.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                  <span className="text-sm font-normal text-muted-foreground">/mes</span>
                </p>
                {plan.features && plan.features.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-3 w-3 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}

        {plans.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>No hay planes definidos</p>
              <p className="text-sm">Crea tu primer plan comercial</p>
            </CardContent>
          </Card>
        )}
      </div>

      <CreatePlanDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        accountId={accountId}
        onSuccess={() => {
          setShowCreate(false);
          queryClient.invalidateQueries({ queryKey: ["client-plans", accountId] });
        }}
      />
    </div>
  );
};

/* ---------- Create Plan Dialog ---------- */

const CreatePlanDialog = ({
  open, onOpenChange, accountId, onSuccess,
}: { open: boolean; onOpenChange: (v: boolean) => void; accountId: string; onSuccess: () => void }) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("client_plans").insert({
        account_id: accountId,
        name,
        price: Number(price),
        description: description || null,
        features: features ? features.split("\n").filter(Boolean) : [],
      });
      if (error) throw error;
      toast({ title: "Plan creado" });
      setName(""); setPrice(""); setDescription(""); setFeatures("");
      onSuccess();
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
          <DialogTitle>Nuevo Plan Comercial</DialogTitle>
          <DialogDescription>Define el plan con nombre, precio y características</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Profesional" />
          </div>
          <div className="space-y-2">
            <Label>Precio mensual (€)</Label>
            <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Características (una por línea)</Label>
            <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4} placeholder="Soporte prioritario&#10;Usuarios ilimitados&#10;..." />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear Plan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClientPlanTab;
