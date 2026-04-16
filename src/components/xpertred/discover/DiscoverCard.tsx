import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, Heart, MapPin, Users } from "lucide-react";
import { motion } from "framer-motion";
import { type XredProfile } from "./utils";

interface DiscoverCardProps {
  profile: XredProfile;
  score: number;
  direction: "left" | "right" | null;
  isManager: boolean;
  isSelf: boolean;
  isPending: boolean;
  onAction: (type: "like" | "skip") => void;
}

const DiscoverCard = ({ profile, score, direction, isManager, isSelf, isPending, onAction }: DiscoverCardProps) => {
  const name = (profile.accounts as any)?.name || "?";

  return (
    <motion.div
      key={profile.account_id}
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
              {name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold truncate">{name}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {profile.province && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.province}
                  </span>
                )}
                {profile.cnae_code && <span>CNAE {profile.cnae_code}</span>}
                {profile.employee_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {profile.employee_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          {profile.services_offered?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.services_offered.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
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

          {profile.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>
          )}

          {profile.reputation_score > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-500">
                {"★".repeat(Math.round(Number(profile.reputation_score)))}
                {"☆".repeat(5 - Math.round(Number(profile.reputation_score)))}
              </span>
              <span className="text-muted-foreground">
                {Number(profile.reputation_score).toFixed(1)}
              </span>
            </div>
          )}

          {isManager && !isSelf && (
            <div className="flex gap-3 pt-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => onAction("skip")} disabled={isPending}>
                <X className="h-5 w-5 mr-1.5" />
                Pasar
              </Button>
              <Button size="lg" className="flex-[2] bg-gradient-to-r from-primary to-primary/80" onClick={() => onAction("like")} disabled={isPending}>
                <Heart className="h-5 w-5 mr-1.5" />
                Conectar
              </Button>
            </div>
          )}
          {isSelf && (
            <p className="text-center text-xs text-muted-foreground pt-2">Tu empresa</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DiscoverCard;
