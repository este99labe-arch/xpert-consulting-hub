import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CheckCircle, XCircle } from "lucide-react";

const MasterDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["master-stats"],
    queryFn: async () => {
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("id, is_active, type")
        .eq("type", "CLIENT");
      if (error) throw error;
      const active = accounts?.filter((a) => a.is_active).length || 0;
      const inactive = accounts?.filter((a) => !a.is_active).length || 0;
      return { total: accounts?.length || 0, active, inactive };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Total Clientes", value: stats?.total ?? 0, icon: Building2, color: "text-primary" },
    { label: "Activos", value: stats?.active ?? 0, icon: CheckCircle, color: "text-green-600" },
    { label: "Inactivos", value: stats?.inactive ?? 0, icon: XCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Master</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MasterDashboard;
