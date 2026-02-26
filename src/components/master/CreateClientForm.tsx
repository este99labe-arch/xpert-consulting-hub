import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess: () => void;
}

const CreateClientForm: React.FC<Props> = ({ onSuccess }) => {
  const [companyName, setCompanyName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: modules = [] } = useQuery({
    queryKey: ["service-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_modules").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (selectedModules.length === 0) {
      setError("Selecciona al menos un módulo");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create_client_account", {
        body: {
          company_name: companyName,
          manager_email: managerEmail,
          manager_password: managerPassword,
          module_ids: selectedModules,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Cliente creado", description: `${companyName} ha sido creado correctamente` });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="companyName">Nombre de empresa</Label>
        <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="managerEmail">Email del manager</Label>
        <Input id="managerEmail" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="managerPassword">Contraseña del manager</Label>
        <Input id="managerPassword" type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} required minLength={6} />
      </div>
      <div className="space-y-2">
        <Label>Módulos</Label>
        <div className="grid grid-cols-2 gap-2">
          {modules.map((mod) => (
            <label key={mod.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50 transition-colors">
              <Checkbox
                checked={selectedModules.includes(mod.id)}
                onCheckedChange={() => toggleModule(mod.id)}
              />
              <span className="text-sm">{mod.name}</span>
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Crear Cliente
      </Button>
    </form>
  );
};

export default CreateClientForm;
