import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isPast } from "date-fns";

/**
 * Background component that polls for due reminders and shows
 * macOS-style toast notifications (auto-dismiss in 5s).
 */
const ReminderNotifier = () => {
  const { user } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: dueReminders = [] } = useQuery({
    queryKey: ["reminders-due", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("id, title, entity_label, remind_at")
        .eq("is_completed", false)
        .lte("remind_at", new Date().toISOString())
        .order("remind_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // check every 30s
  });

  useEffect(() => {
    dueReminders.forEach((r: any) => {
      if (!notifiedRef.current.has(r.id) && isPast(new Date(r.remind_at))) {
        notifiedRef.current.add(r.id);
        toast(`⏰ ${r.title}`, {
          description: r.entity_label || "Recordatorio vencido",
          duration: 5000,
        });
      }
    });
  }, [dueReminders]);

  return null;
};

export default ReminderNotifier;
