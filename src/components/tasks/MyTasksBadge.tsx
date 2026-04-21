import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const MyTasksBadge = () => {
  const { user } = useAuth();
  const { data: count = 0 } = useQuery({
    queryKey: ["my-overdue-tasks", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .is("archived_at", null)
        .eq("is_completed", false)
        .lt("remind_at", new Date().toISOString());
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });
  if (!count) return null;
  return (
    <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
      {count}
    </Badge>
  );
};

export default MyTasksBadge;
