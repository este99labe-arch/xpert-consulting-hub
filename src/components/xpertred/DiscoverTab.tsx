import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { X, Heart, Building2, MapPin, Users, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EmptyState from "@/components/shared/EmptyState";

interface XredProfile {
  account_id: string;
  description: string;
  services_offered: string[];
  services_needed: string[];
  cnae_code: string;
  province: string;
  employee_count: number;
  reputation_score: number;
  accounts: { name: string };
}

function computeScore(myProfile: any, other: XredProfile): number {
  if (!myProfile) return 50;
  let score = 0;

  // CNAE match (30%)
  if (myProfile.cnae_code && other.cnae_code) {
    const prefix = myProfile.cnae_code.substring(0, 2);
    if (other.cnae_code.startsWith(prefix)) score += 20;
    if (other.cnae_code === myProfile.cnae_code) score += 10;
  }

  // Services match (25%) — my needs vs their offers
  const myNeeds = new Set(myProfile.services_needed || []);
  const theirOffers = new Set(other.services_offered || []);
  const overlap = [...myNeeds].filter((s) => theirOffers.has(s)).length;
  if (myNeeds.size > 0) score += Math.min(25, (overlap / myNeeds.size) * 25);

  // Province (15%)
  if (myProfile.province && other.province && myProfile.province === other.province) score += 15;

  // Reputation (15%)
  score += Math.min(15, (Number(other.reputation_score) / 5) * 15);

  // Size (10%)
  score += Math.min(10, other.employee_count > 0 ? 10 : 5);

  // Base (5%)
  score += 5;

  return Math.round(Math.min(100, score));
}

const DiscoverTab = () => {
  const { accountId, role } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const isManager = role === "MANAGER" || role === "MASTER_ADMIN";

  // My profile
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

  // Already interacted
  const { data: interacted = [] } = useQuery({
    queryKey: ["xred-interacted", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_interactions")
        .select("account_id_to")
        .eq("account_id_from", accountId!);
      return (data || []).map((d: any) => d.account_id_to);
    },
    enabled: !!accountId,
  });

  // Discover profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["xred-discover", accountId, interacted],
    queryFn: async () => {
      let q = supabase
        .from("xred_profiles")
        .select("*, accounts!inner(name)")
        .eq("is_visible", true)
        .neq("account_id", accountId!);

      if (interacted.length > 0) {
        q = q.not("account_id", "in", `(${interacted.join(",")})`);
      }

      const { data } = await q.limit(20);
      return (data || []) as XredProfile[];
    },
    enabled: !!accountId,
  });

  const interactMutation = useMutation({
    mutationFn: async ({ targetId, type }: { targetId: string; type: string }) => {
      const { error } = await supabase.from("xred_interactions").insert({
        account_id_from: accountId!,
        account_id_to: targetId,
        type,
      });
      if (error) throw error;

      // Check if it's a match
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
    onSuccess: (isMatch, { type }) => {
      if (isMatch) {
        toast.success("🎉 ¡Match! Ya puedes chatear con esta empresa");
      }
      queryClient.invalidateQueries({ queryKey: ["xred-interacted"] });
      queryClient.invalidateQueries({ queryKey: ["xred-discover"] });
      queryClient.invalidateQueries({ queryKey: ["xred-matches"] });
    },
  });

  const handleAction = useCallback(
    (type: "like" | "skip") => {
      const current = profiles[currentIndex];
      if (!current) return;
      setDirection(type === "like" ? "right" : "left");
      setTimeout(() => {
        interactMutation.mutate({ targetId: current.account_id, type });
        setCurrentIndex((i) => i + 1);
        setDirection(null);
      }, 300);
    },
    [profiles, currentIndex, interactMutation]
  );

  const current = profiles[currentIndex];
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

  if (!current) {
    return (
      <EmptyState
        icon={Compass}
        title="No hay más empresas por descubrir"
        description="Has visto todas las empresas disponibles. Vuelve más tarde para nuevas sugerencias."
      />
    );
  }

  return (
    <div className="flex justify-center py-6">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.account_id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: direction === "left" ? -300 : direction === "right" ? 300 : 0,
              rotate: direction === "left" ? -10 : direction === "right" ? 10 : 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                    {(current.accounts as any)?.name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate">
                      {(current.accounts as any)?.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      {current.province && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {current.province}
                        </span>
                      )}
                      {current.cnae_code && <span>CNAE {current.cnae_code}</span>}
                      {current.employee_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {current.employee_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 space-y-4">
                {current.services_offered.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {current.services_offered.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Compatibilidad</span>
                    <span className="font-bold text-primary">{score}%</span>
                  </div>
                  <Progress value={score} className="h-2" />
                </div>

                {current.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {current.description}
                  </p>
                )}

                {current.reputation_score > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-500">
                      {"★".repeat(Math.round(Number(current.reputation_score)))}
                      {"☆".repeat(5 - Math.round(Number(current.reputation_score)))}
                    </span>
                    <span className="text-muted-foreground">
                      {Number(current.reputation_score).toFixed(1)}
                    </span>
                  </div>
                )}

                {isManager && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1"
                      onClick={() => handleAction("skip")}
                      disabled={interactMutation.isPending}
                    >
                      <X className="h-5 w-5 mr-1.5" />
                      Pasar
                    </Button>
                    <Button
                      size="lg"
                      className="flex-[2] bg-gradient-to-r from-primary to-primary/80"
                      onClick={() => handleAction("like")}
                      disabled={interactMutation.isPending}
                    >
                      <Heart className="h-5 w-5 mr-1.5" />
                      Conectar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {currentIndex + 1} de {profiles.length} sugerencias
        </p>
      </div>
    </div>
  );
};

export default DiscoverTab;
