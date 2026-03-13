import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ClientInfoTab from "@/components/clients/ClientInfoTab";
import ClientContactsTab from "@/components/clients/ClientContactsTab";
import ClientBillingConfigTab from "@/components/clients/ClientBillingConfigTab";
import ClientPlanTab from "@/components/clients/ClientPlanTab";

const AppClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "MASTER_ADMIN" || role === "MANAGER";

  const { data: client, isLoading } = useQuery({
    queryKey: ["business-client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_clients")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateClient = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("business_clients")
        .update(updates)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-client", id] });
      queryClient.invalidateQueries({ queryKey: ["business-clients"] });
      toast({ title: "Cliente actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/app/clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          Cliente no encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/clients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.tax_id}</p>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="billing">Facturación</TabsTrigger>
          {isAdmin && <TabsTrigger value="plan">Plan</TabsTrigger>}
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <ClientInfoTab
            client={client}
            onSave={(updates) => updateClient.mutate(updates)}
            saving={updateClient.isPending}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="contacts" className="mt-6">
          <ClientContactsTab clientId={id!} accountId={accountId!} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <ClientBillingConfigTab
            client={client}
            onSave={(updates) => updateClient.mutate(updates)}
            saving={updateClient.isPending}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="plan" className="mt-6">
            <ClientPlanTab
              client={client}
              accountId={accountId!}
              onSave={(updates) => updateClient.mutate(updates)}
              saving={updateClient.isPending}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AppClientDetail;
