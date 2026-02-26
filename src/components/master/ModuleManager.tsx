import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface Props {
  accountId: string;
}

const ModuleManager: React.FC<Props> = ({ accountId }) => {
  const queryClient = useQueryClient();

  const { data: allModules = [] } = useQuery({
    queryKey: ["service-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_modules").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: accountModules = [], isLoading } = useQuery({
    queryKey: ["account-modules", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_modules")
        .select("*")
        .eq("account_id", accountId);
      if (error) throw error;
      return data || [];
    },
  });

  const toggleModule = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const existing = accountModules.find((am) => am.module_id === moduleId);
      if (existing) {
        const { error } = await supabase
          .from("account_modules")
          .update({ is_enabled: enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_modules").insert({
          account_id: accountId,
          module_id: moduleId,
          is_enabled: enabled,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account-modules", accountId] }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allModules.map((mod) => {
        const am = accountModules.find((a) => a.module_id === mod.id);
        const isEnabled = am?.is_enabled ?? false;
        return (
          <div key={mod.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{mod.name}</p>
              <p className="text-xs text-muted-foreground">{mod.description}</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) =>
                toggleModule.mutate({ moduleId: mod.id, enabled: checked })
              }
            />
          </div>
        );
      })}
    </div>
  );
};

export default ModuleManager;
