import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarClock, Plus, Bell, Clock, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import CreateReminderDialog from "@/components/reminders/CreateReminderDialog";

const entityTypeIcons: Record<string, string> = {
  CLIENT: "👤",
  INVOICE: "📄",
  QUOTE: "📋",
  EXPENSE: "💰",
  JOURNAL_ENTRY: "📒",
  ATTENDANCE: "⏱️",
  OTHER: "📌",
};

const RemindersWidget = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("is_completed", false)
        .order("remind_at", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminders")
        .update({ is_completed: true, completed_at: new Date().toISOString(), status: "DONE" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast({ title: "Recordatorio completado" });
    },
  });

  const overdueCount = reminders.filter((r: any) => isPast(new Date(r.remind_at))).length;
  const todayCount = reminders.filter((r: any) => isToday(new Date(r.remind_at))).length;

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Recordatorios
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{overdueCount}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate("/app/tasks")}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </Button>
            </div>
          </div>
          {(todayCount > 0 || overdueCount > 0) && (
            <div className="flex gap-2 mt-1">
              {todayCount > 0 && (
                <span className="text-xs flex items-center gap-1 text-primary">
                  <Clock className="h-3 w-3" /> {todayCount} hoy
                </span>
              )}
              {overdueCount > 0 && (
                <span className="text-xs flex items-center gap-1 text-destructive">
                  <Bell className="h-3 w-3" /> {overdueCount} vencidos
                </span>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <CalendarClock className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sin recordatorios pendientes</p>
              <Button size="sm" variant="link" className="text-xs mt-1" onClick={() => setShowCreate(true)}>
                Crear uno nuevo
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[220px] pr-2">
              <div className="space-y-2">
                {reminders.map((r: any) => {
                  const isOverdue = isPast(new Date(r.remind_at));
                  const isNow = isToday(new Date(r.remind_at));
                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-sm transition-colors ${
                        isOverdue
                          ? "border-destructive/30 bg-destructive/5"
                          : isNow
                          ? "border-primary/30 bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={false}
                        onCheckedChange={() => completeMutation.mutate(r.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {r.entity_type && (
                            <span className="text-xs shrink-0">{entityTypeIcons[r.entity_type] || "📌"}</span>
                          )}
                          <span className="font-medium break-words line-clamp-2">{r.title}</span>
                        </div>
                        {r.entity_label && (
                          <p className="text-xs text-muted-foreground break-words line-clamp-1 mt-0.5">{r.entity_label}</p>
                        )}
                        {r.labels && (r.labels as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(r.labels as string[]).map((label: string) => (
                              <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{label}</Badge>
                            ))}
                          </div>
                        )}
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {isOverdue
                            ? `Venció ${formatDistanceToNow(new Date(r.remind_at), { addSuffix: true, locale: es })}`
                            : format(new Date(r.remind_at), "dd MMM, HH:mm", { locale: es })
                          }
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <CreateReminderDialog open={showCreate} onOpenChange={setShowCreate} />
    </>
  );
};

export default RemindersWidget;
