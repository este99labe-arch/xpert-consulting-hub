import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isPast } from "date-fns";

/**
 * Background component that polls for due reminders, shows
 * macOS-style toast notifications (auto-dismiss in 5s),
 * and creates persistent notification records in the database.
 */
const ReminderNotifier = () => {
  const { user, accountId } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: dueReminders = [] } = useQuery({
    queryKey: ["reminders-due", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("id, title, description, entity_label, entity_type, entity_id, remind_at, account_id, created_by")
        .eq("is_completed", false)
        .lte("remind_at", new Date().toISOString())
        .order("remind_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    dueReminders.forEach(async (r: any) => {
      if (!notifiedRef.current.has(r.id) && isPast(new Date(r.remind_at))) {
        notifiedRef.current.add(r.id);

        // Show toast notification
        toast(`⏰ ${r.title}`, {
          description: r.entity_label || "Recordatorio vencido",
          duration: 5000,
        });

        // Create persistent notification in DB if not exists
        const refId = `reminder_${r.id}`;
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("reference_id", refId)
          .eq("account_id", r.account_id)
          .limit(1);

        if (!existing || existing.length === 0) {
          const entityLabel = r.entity_label ? ` — ${r.entity_label}` : "";
          let link: string | null = null;
          if (r.entity_type === "CLIENT" && r.entity_id) link = `/app/clients/${r.entity_id}`;
          else if (["INVOICE", "QUOTE", "EXPENSE"].includes(r.entity_type)) link = "/app/invoices";

          await supabase.from("notifications").insert({
            account_id: r.account_id,
            user_id: r.created_by,
            type: "REMINDER",
            title: `⏰ ${r.title}`,
            message: `${r.description || "Recordatorio programado"}${entityLabel}`,
            reference_id: refId,
            link,
          });

          // Invalidate notifications query so the bell updates
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      }
    });
  }, [dueReminders, queryClient]);

  return null;
};

export default ReminderNotifier;
