import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, MapPin, Star, Search, Loader2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { useState } from "react";

const NetworkTab = () => {
  const { accountId } = useAuth();
  const [search, setSearch] = useState("");

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["xred-network", accountId],
    queryFn: async () => {
      // Get all matches
      const { data: interactions } = await supabase
        .from("xred_interactions")
        .select("account_id_from, account_id_to")
        .eq("is_match", true)
        .or(`account_id_from.eq.${accountId},account_id_to.eq.${accountId}`);

      if (!interactions || interactions.length === 0) return [];

      const otherIds = [
        ...new Set(
          interactions.map((i) =>
            i.account_id_from === accountId ? i.account_id_to : i.account_id_from
          )
        ),
      ];

      // Get profiles
      const { data: profiles } = await supabase
        .from("xred_profiles")
        .select("*")
        .in("account_id", otherIds);

      // Resolve names via RPC (RLS-safe)
      const { data: names } = await (supabase.rpc as any)("xred_resolve_names", { _ids: otherIds });
      const nameMap = Object.fromEntries(((names as any[]) || []).map((n) => [n.id, n]));

      return (profiles || []).map((p: any) => ({
        ...p,
        accounts: { name: nameMap[p.account_id]?.name || "Empresa" },
      }));
    },
    enabled: !!accountId,
  });

  const filtered = connections.filter((c: any) => {
    const name = (c.accounts as any)?.name || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      c.province?.toLowerCase().includes(search.toLowerCase()) ||
      c.services_offered?.some((s: string) =>
        s.toLowerCase().includes(search.toLowerCase())
      )
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="Tu red está vacía"
        description="Haz matches con otras empresas para construir tu red de contactos."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, zona o servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c: any) => (
          <Card key={c.account_id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {(c.accounts as any)?.name?.charAt(0) || "?"}
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {(c.accounts as any)?.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.province && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {c.province}
                      </span>
                    )}
                    {c.cnae_code && <span>CNAE {c.cnae_code}</span>}
                  </div>
                </div>
              </div>

              {c.services_offered?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.services_offered.slice(0, 4).map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                  {c.services_offered.length > 4 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{c.services_offered.length - 4}
                    </Badge>
                  )}
                </div>
              )}

              {Number(c.reputation_score) > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium">
                    {Number(c.reputation_score).toFixed(1)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NetworkTab;
