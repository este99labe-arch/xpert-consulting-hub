import {
  ChevronsUp, ChevronUp, Minus, ChevronDown,
  FileText, Receipt, BookOpen, Building2, AlertCircle,
} from "lucide-react";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type EntityType = "CLIENT" | "INVOICE" | "EXPENSE" | "JOURNAL_ENTRY" | "QUOTE" | "ATTENDANCE" | "OTHER";

export const PRIORITIES: { value: Priority; label: string; color: string; bgClass: string; textClass: string; icon: any }[] = [
  { value: "CRITICAL", label: "Crítica", color: "text-red-600", bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-700 dark:text-red-300", icon: ChevronsUp },
  { value: "HIGH", label: "Alta", color: "text-orange-500", bgClass: "bg-orange-100 dark:bg-orange-900/30", textClass: "text-orange-700 dark:text-orange-300", icon: ChevronUp },
  { value: "MEDIUM", label: "Media", color: "text-yellow-600", bgClass: "bg-yellow-100 dark:bg-yellow-900/30", textClass: "text-yellow-700 dark:text-yellow-300", icon: Minus },
  { value: "LOW", label: "Baja", color: "text-green-600", bgClass: "bg-green-100 dark:bg-green-900/30", textClass: "text-green-700 dark:text-green-300", icon: ChevronDown },
];

export const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export const getPriorityMeta = (p?: string) =>
  PRIORITIES.find((x) => x.value === (p as Priority)) || PRIORITIES[2];

export const ENTITY_META: Record<string, { label: string; icon: any }> = {
  CLIENT: { label: "Cliente", icon: Building2 },
  INVOICE: { label: "Factura", icon: FileText },
  EXPENSE: { label: "Gasto", icon: Receipt },
  JOURNAL_ENTRY: { label: "Asiento", icon: BookOpen },
  QUOTE: { label: "Presupuesto", icon: FileText },
  ATTENDANCE: { label: "Fichaje", icon: AlertCircle },
  OTHER: { label: "Otro", icon: AlertCircle },
};

export const COLUMN_COLOR_PRESETS = [
  "#3b82f6", "#eab308", "#a855f7", "#22c55e",
  "#ef4444", "#f97316", "#06b6d4", "#ec4899",
  "#64748b", "#84cc16",
];

export interface TaskColumn {
  id: string;
  account_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
}

export interface Task {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  remind_at: string;
  status: string;
  priority: Priority;
  is_completed: boolean;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  client_id: string | null;
  column_id: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  entity_label: string | null;
  labels: string[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export const initials = (name?: string | null) => {
  if (!name) return "??";
  return name
    .split(/[ .@]/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};
