import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Heart, MessageCircle, Star, Flag, Loader2, Eye, EyeOff } from "lucide-react";

const AdminTab = () => {
  const queryClient = useQueryClient();

  // KPIs
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["xred-admin-kpis"],
    queryFn: async () => {
      const [profiles, interactions, messages, reviews] = await Promise.all([
        supabase.from("xred_profiles").select("account_id, is_visible, reputation_score"),
        supabase.from("xred_interactions").select("id, type, is_match"),
        supabase.from("xred_messages").select("id", { count: "exact", head: true }),
        supabase.from("xred_reviews").select("id, is_flagged"),
      ]);

      const profileData = profiles.data || [];
      const interactionData = interactions.data || [];
      const reviewData = reviews.data || [];

      const totalProfiles = profileData.length;
      const activeProfiles = profileData.filter((p: any) => p.is_visible).length;
      const totalMatches = interactionData.filter((i: any) => i.is_match).length / 2; // each match has 2 rows
      const totalLikes = interactionData.filter((i: any) => i.type === "like").length;
      const matchRate = totalLikes > 0 ? (totalMatches / totalLikes) * 100 : 0;
      const avgReputation =
        profileData.length > 0
          ? profileData.reduce((s: number, p: any) => s + Number(p.reputation_score || 0), 0) / profileData.length
          : 0;
      const flaggedReviews = reviewData.filter((r: any) => r.is_flagged).length;

      return {
        totalProfiles,
        activeProfiles,
        totalMatches: Math.round(totalMatches),
        matchRate: matchRate.toFixed(1),
        totalMessages: messages.count || 0,
        avgReputation: avgReputation.toFixed(1),
        flaggedReviews,
        totalReviews: reviewData.length,
      };
    },
  });

  // Flagged reviews
  const { data: flaggedReviews = [] } = useQuery({
    queryKey: ["xred-flagged-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("xred_reviews")
        .select("*, accounts!xred_reviews_reviewer_account_id_fkey(name)")
        .eq("is_flagged", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: async ({ id, flagged }: { id: string; flagged: boolean }) => {
      const { error } = await supabase
        .from("xred_reviews")
        .update({ is_flagged: flagged })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valoración actualizada");
      queryClient.invalidateQueries({ queryKey: ["xred-flagged-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["xred-admin-kpis"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Perfiles activos", value: `${kpis?.activeProfiles}/${kpis?.totalProfiles}`, color: "text-primary" },
          { icon: Heart, label: "Matches", value: kpis?.totalMatches, color: "text-destructive" },
          { icon: MessageCircle, label: "Mensajes", value: kpis?.totalMessages, color: "text-blue-500" },
          { icon: Star, label: "Reputación media", value: kpis?.avgReputation, color: "text-yellow-500" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 text-center">
              <kpi.icon className={`h-6 w-6 mx-auto mb-2 ${kpi.color}`} />
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{kpis?.matchRate}%</div>
            <div className="text-xs text-muted-foreground">Tasa de match</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{kpis?.flaggedReviews}</div>
            <div className="text-xs text-muted-foreground">Valoraciones denunciadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Flagged reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Moderación de valoraciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flaggedReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay valoraciones pendientes de moderación.</p>
          ) : (
            <div className="space-y-3">
              {flaggedReviews.map((r: any) => (
                <div key={r.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Flag className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{r.comment || "Sin comentario"}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        P:{r.punctuality} C:{r.quality} Com:{r.communication} Precio:{r.fair_price}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFlagMutation.mutate({ id: r.id, flagged: false })}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Aprobar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTab;
