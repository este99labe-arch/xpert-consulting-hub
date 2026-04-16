import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, Heart, Building2, MapPin, Users, Loader2, Compass, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EmptyState from "@/components/shared/EmptyState";
import DiscoverCard from "./discover/DiscoverCard";
import { computeScore, type XredProfile } from "./discover/utils";

const DiscoverTab = () => {
  const { accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ name: "", sector: "", cnae: "", province: "" });

  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  const { data: myProfile } = useQuery({
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

  // Cuentas con las que ya tengo MATCH (las solicitudes pendientes se mantienen visibles)
  const { data: matchedIds = [] } = useQuery({
    queryKey: ["xred-matched-ids", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_interactions")
        .select("account_id_from, account_id_to")
        .eq("is_match", true)
        .or(`account_id_from.eq.${accountId},account_id_to.eq.${accountId}`);
      const ids = new Set<string>();
      (data || []).forEach((r: any) => {
        ids.add(r.account_id_from === accountId ? r.account_id_to : r.account_id_from);
      });
      return Array.from(ids);
    },
    enabled: !!accountId,
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["xred-discover", accountId, matchedIds],
    queryFn: async () => {
      let q = supabase
        .from("xred_directory")
        .select("*")
        .neq("account_id", accountId!);

      if (matchedIds.length > 0) {
        q = q.not("account_id", "in", `(${matchedIds.join(",")})`);
      }

      const { data, error } = await q.limit(50);
      if (error) {
        console.error("xred_directory query error:", error);
        return [];
      }
      // Adapt to XredProfile shape (accounts.name expected)
      return (data || []).map((d: any) => ({
        ...d,
        accounts: { name: d.account_name },
      })) as XredProfile[];
    },
    enabled: !!accountId,
  });

  // Client-side filtering
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const name = ((p.accounts as any)?.name || "").toLowerCase();
      const hasActiveFilter = filters.name || filters.sector || filters.cnae || filters.province;

      if (filters.name && !name.includes(filters.name.toLowerCase())) return false;
      if (filters.cnae && !(p.cnae_code || "").toLowerCase().includes(filters.cnae.toLowerCase())) return false;
      if (filters.province && !(p.province || "").toLowerCase().includes(filters.province.toLowerCase())) return false;
      if (filters.sector) {
        const sectorLower = filters.sector.toLowerCase();
        const matchServices = (p.services_offered || []).some((s) => s.toLowerCase().includes(sectorLower));
        const matchDesc = (p.description || "").toLowerCase().includes(sectorLower);
        if (!matchServices && !matchDesc) return false;
      }

      return true;
    });
  }, [profiles, filters]);

  const interactMutation = useMutation({
    mutationFn: async ({ targetId, type }: { targetId: string; type: string }) => {
      const { error } = await supabase.from("xred_interactions").insert({
        account_id_from: accountId!,
        account_id_to: targetId,
        type,
      });
      if (error) throw error;

      if (type === "like") {
        const { data } = await supabase
          .from("xred_interactions")
          .select("is_match")
          .eq("account_id_from", accountId!)
          .eq("account_id_to", targetId)
          .single();
        return data?.is_match || false;
      }
      return false;
    },
    onSuccess: (isMatch) => {
      if (isMatch) {
        toast.success("🎉 ¡Match! Ya puedes chatear con esta empresa");
      }
      queryClient.invalidateQueries({ queryKey: ["xred-matched-ids"] });
      queryClient.invalidateQueries({ queryKey: ["xred-discover"] });
      queryClient.invalidateQueries({ queryKey: ["xred-matches"] });
      queryClient.invalidateQueries({ queryKey: ["xred-sent-requests"] });
    },
  });

  const handleAction = useCallback(
    (type: "like" | "skip") => {
      const current = filteredProfiles[currentIndex];
      if (!current) return;
      setDirection(type === "like" ? "right" : "left");
      setTimeout(() => {
        interactMutation.mutate({ targetId: current.account_id, type });
        setCurrentIndex((i) => i + 1);
        setDirection(null);
      }, 300);
    },
    [filteredProfiles, currentIndex, interactMutation]
  );

  // Reset index when filters change
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentIndex(0);
    setDirection(null);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v.trim() !== "");

  const current = filteredProfiles[currentIndex];
  const score = current ? computeScore(myProfile, current) : 0;

  if (!myProfile) {
    return (
      <EmptyState
        icon={Building2}
        title="Configura tu perfil XpertRed"
        description="Para descubrir empresas, primero completa tu perfil en la pestaña 'Mi Perfil'."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex justify-center py-6">
      <div className="w-full max-w-md space-y-4">
        {/* Search & Filters */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros de búsqueda
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs ml-1">Activos</Badge>
              )}
            </span>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {showFilters && (
            <Card>
              <CardContent className="p-4 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Empresa</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Nombre..."
                      value={filters.name}
                      onChange={(e) => handleFilterChange("name", e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Sector / Servicio</label>
                  <Input
                    placeholder="Ej: Ferretería..."
                    value={filters.sector}
                    onChange={(e) => handleFilterChange("sector", e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">CNAE</label>
                  <Input
                    placeholder="Ej: 4752..."
                    value={filters.cnae}
                    onChange={(e) => handleFilterChange("cnae", e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
                  <Input
                    placeholder="Ej: Madrid..."
                    value={filters.province}
                    onChange={(e) => handleFilterChange("province", e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                {hasActiveFilters && (
                  <div className="col-span-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs w-full"
                      onClick={() => {
                        setFilters({ name: "", sector: "", cnae: "", province: "" });
                        setCurrentIndex(0);
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Card or Empty */}
        {!current ? (
          <EmptyState
            icon={Compass}
            title={hasActiveFilters ? "Sin resultados" : "No hay más empresas por descubrir"}
            description={
              hasActiveFilters
                ? "Prueba con otros filtros de búsqueda."
                : "Has visto todas las empresas disponibles. Vuelve más tarde para nuevas sugerencias."
            }
          />
        ) : (
          <>
            <AnimatePresence mode="wait">
              <DiscoverCard
                key={current.account_id}
                profile={current}
                score={score}
                direction={direction}
                isManager={isManager}
                isSelf={current.account_id === accountId}
                isPending={interactMutation.isPending}
                onAction={handleAction}
              />
            </AnimatePresence>

            <p className="text-center text-xs text-muted-foreground">
              {currentIndex + 1} de {filteredProfiles.length} sugerencias
              {hasActiveFilters && ` (filtrado de ${profiles.length})`}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DiscoverTab;
