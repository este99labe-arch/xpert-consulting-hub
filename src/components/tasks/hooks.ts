import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { Task, TaskColumn, TaskComment, TaskActivity } from "./types";

export const useTaskColumns = () => {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["task-columns", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_columns")
        .select("*")
        .eq("is_archived", false)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as TaskColumn[];
    },
    enabled: !!accountId,
  });
};

export const useTasks = (filter?: { clientId?: string }) => {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["tasks", accountId, filter?.clientId],
    queryFn: async () => {
      let q = supabase
        .from("reminders")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (filter?.clientId) q = q.eq("client_id", filter.clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
    enabled: !!accountId,
  });
};

export const useTeamMembers = () => {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["team-members", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data: ua } = await supabase
        .from("user_accounts")
        .select("user_id")
        .eq("account_id", accountId)
        .eq("is_active", true);
      const userIds = (ua || []).map((u: any) => u.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim(),
      }));
    },
    enabled: !!accountId,
  });
};

export const useClientsLite = () => {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["clients-lite", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
};

export const useTaskMutations = () => {
  const qc = useQueryClient();
  const { user, accountId } = useAuth();

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { error } = await supabase.from("reminders").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ["tasks", accountId] });
      const prev = qc.getQueryData<Task[]>(["tasks", accountId]);
      qc.setQueryData<Task[]>(["tasks", accountId], (old) =>
        (old || []).map((t) => (t.id === id ? { ...t, ...updates } as Task : t))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", accountId], ctx.prev);
      toast({ title: "Error al actualizar", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks", accountId] });
      qc.invalidateQueries({ queryKey: ["task-activity"] });
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminders")
        .update({ archived_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", accountId] });
      toast({ title: "Tarea archivada" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", accountId] });
      toast({ title: "Tarea eliminada" });
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Task>) => {
      if (!user || !accountId) throw new Error("No auth");
      const { data, error } = await supabase
        .from("reminders")
        .insert({
          account_id: accountId,
          created_by: user.id,
          title: payload.title || "Nueva tarea",
          description: payload.description || "",
          remind_at: payload.remind_at || new Date().toISOString(),
          priority: payload.priority || "MEDIUM",
          assigned_to: payload.assigned_to || null,
          client_id: payload.client_id || null,
          column_id: payload.column_id || null,
          entity_type: payload.entity_type || null,
          entity_id: payload.entity_id || null,
          entity_label: payload.entity_label || null,
          labels: payload.labels || [],
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", accountId] });
      toast({ title: "Tarea creada" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return { update, archive, remove, create };
};

export const useTaskComments = (taskId?: string) => {
  const qc = useQueryClient();
  const { user, accountId } = useAuth();

  const list = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as TaskComment[];
    },
    enabled: !!taskId,
  });

  const add = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !accountId || !taskId) throw new Error("No auth");
      const { error } = await supabase.from("task_comments").insert({
        account_id: accountId,
        task_id: taskId,
        author_id: user.id,
        content,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });

  return { list, add, remove };
};

export const useTaskActivity = (taskId?: string) => {
  return useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_activity")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as TaskActivity[];
    },
    enabled: !!taskId,
  });
};

export const useColumnMutations = () => {
  const qc = useQueryClient();
  const { accountId } = useAuth();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["task-columns", accountId] });
    qc.invalidateQueries({ queryKey: ["tasks", accountId] });
  };

  const create = useMutation({
    mutationFn: async ({ name, color, sort_order }: { name: string; color: string; sort_order: number }) => {
      if (!accountId) throw new Error("No account");
      const { error } = await supabase.from("task_columns").insert({
        account_id: accountId, name, color, sort_order,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskColumn> }) => {
      const { error } = await supabase.from("task_columns").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_columns")
        .update({ is_archived: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Move tasks to first remaining column
      const { data: cols } = await supabase
        .from("task_columns")
        .select("id")
        .eq("is_archived", false)
        .neq("id", id)
        .order("sort_order")
        .limit(1);
      const fallback = cols?.[0]?.id || null;
      await supabase.from("reminders").update({ column_id: fallback } as any).eq("column_id", id);
      const { error } = await supabase.from("task_columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, archive, remove };
};
