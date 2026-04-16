import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Save, Plus, X, Star, Loader2 } from "lucide-react";

const ProfileTab = () => {
  const { accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  const [newServiceOffered, setNewServiceOffered] = useState("");
  const [newServiceNeeded, setNewServiceNeeded] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["xred-my-profile", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_profiles")
        .select("*")
        .eq("account_id", accountId!)
        .maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["xred-my-reviews", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_reviews")
        .select("*")
        .eq("reviewed_account_id", accountId!);
      return data || [];
    },
    enabled: !!accountId,
  });

  const [form, setForm] = useState<any>(null);

  // Initialize form when profile loads
  const currentForm = form || profile || {
    description: "",
    services_offered: [] as string[],
    services_needed: [] as string[],
    cnae_code: "",
    province: "",
    employee_count: 0,
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from("xred_profiles").upsert({
        account_id: accountId!,
        description: values.description,
        services_offered: values.services_offered,
        services_needed: values.services_needed,
        cnae_code: values.cnae_code,
        province: values.province,
        employee_count: values.employee_count,
        is_visible: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil XpertRed actualizado");
      queryClient.invalidateQueries({ queryKey: ["xred-my-profile"] });
      setForm(null);
    },
    onError: () => toast.error("Error al guardar el perfil"),
  });

  const updateField = (key: string, value: any) => {
    setForm({ ...currentForm, [key]: value });
  };

  const addTag = (field: "services_offered" | "services_needed", value: string) => {
    if (!value.trim()) return;
    const current = [...(currentForm[field] || [])];
    if (!current.includes(value.trim())) {
      current.push(value.trim());
      updateField(field, current);
    }
    if (field === "services_offered") setNewServiceOffered("");
    else setNewServiceNeeded("");
  };

  const removeTag = (field: "services_offered" | "services_needed", tag: string) => {
    updateField(
      field,
      (currentForm[field] || []).filter((s: string) => s !== tag)
    );
  };

  // Reputation breakdown
  const avgPunctuality =
    reviews.length > 0
      ? reviews.reduce((s: number, r: any) => s + r.punctuality, 0) / reviews.length
      : 0;
  const avgQuality =
    reviews.length > 0
      ? reviews.reduce((s: number, r: any) => s + r.quality, 0) / reviews.length
      : 0;
  const avgCommunication =
    reviews.length > 0
      ? reviews.reduce((s: number, r: any) => s + r.communication, 0) / reviews.length
      : 0;
  const avgFairPrice =
    reviews.length > 0
      ? reviews.reduce((s: number, r: any) => s + r.fair_price, 0) / reviews.length
      : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mi perfil en la red</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descripción de la empresa</Label>
            <Textarea
              value={currentForm.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Describe tu empresa y qué buscas en la red..."
              rows={3}
              disabled={!isManager}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código CNAE</Label>
              <Input
                value={currentForm.cnae_code}
                onChange={(e) => updateField("cnae_code", e.target.value)}
                placeholder="Ej: 6201"
                disabled={!isManager}
              />
            </div>
            <div className="space-y-2">
              <Label>Provincia</Label>
              <Input
                value={currentForm.province}
                onChange={(e) => updateField("province", e.target.value)}
                placeholder="Ej: Valladolid"
                disabled={!isManager}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nº empleados</Label>
            <Input
              type="number"
              value={currentForm.employee_count}
              onChange={(e) => updateField("employee_count", parseInt(e.target.value) || 0)}
              disabled={!isManager}
            />
          </div>

          {/* Services offered */}
          <div className="space-y-2">
            <Label>Servicios que ofrezco</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(currentForm.services_offered || []).map((s: string) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  {s}
                  {isManager && (
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag("services_offered", s)}
                    />
                  )}
                </Badge>
              ))}
            </div>
            {isManager && (
              <div className="flex gap-2">
                <Input
                  value={newServiceOffered}
                  onChange={(e) => setNewServiceOffered(e.target.value)}
                  placeholder="Añadir servicio..."
                  onKeyDown={(e) =>
                    e.key === "Enter" && addTag("services_offered", newServiceOffered)
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addTag("services_offered", newServiceOffered)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Services needed */}
          <div className="space-y-2">
            <Label>Servicios que busco</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(currentForm.services_needed || []).map((s: string) => (
                <Badge key={s} variant="outline" className="gap-1">
                  {s}
                  {isManager && (
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag("services_needed", s)}
                    />
                  )}
                </Badge>
              ))}
            </div>
            {isManager && (
              <div className="flex gap-2">
                <Input
                  value={newServiceNeeded}
                  onChange={(e) => setNewServiceNeeded(e.target.value)}
                  placeholder="Añadir necesidad..."
                  onKeyDown={(e) =>
                    e.key === "Enter" && addTag("services_needed", newServiceNeeded)
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addTag("services_needed", newServiceNeeded)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isManager && (
            <Button
              onClick={() => upsertMutation.mutate(currentForm)}
              disabled={upsertMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {profile ? "Actualizar perfil" : "Crear perfil"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reputation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Reputación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes valoraciones. Cierra operaciones con tus matches para recibir
              feedback.
            </p>
          ) : (
            <>
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-500">
                  {profile?.reputation_score
                    ? Number(profile.reputation_score).toFixed(1)
                    : "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {reviews.length} valoraciones
                </div>
              </div>

              {[
                { label: "Puntualidad", value: avgPunctuality },
                { label: "Calidad", value: avgQuality },
                { label: "Comunicación", value: avgCommunication },
                { label: "Precio justo", value: avgFairPrice },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value.toFixed(1)}</span>
                  </div>
                  <Progress value={(item.value / 5) * 100} className="h-2" />
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileTab;
