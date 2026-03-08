export interface ChartAccount {
  id: string; account_id: string; code: string; name: string; type: string; parent_id: string | null; is_active: boolean;
}

export interface JournalEntry {
  id: string; account_id: string; entry_number: string; date: string; description: string;
  invoice_id: string | null; status: string; created_by: string; created_at: string;
}

export interface JournalEntryLine {
  id: string; entry_id: string; chart_account_id: string; debit: number; credit: number; description: string;
  chart_of_accounts?: { code: string; name: string };
  journal_entries?: { entry_number: string; date: string; description: string; status: string; invoice_id: string | null };
}

export interface DeleteRequest {
  id: string; account_id: string; entry_id: string; reason: string; requested_by: string;
  status: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
  journal_entries?: { entry_number: string; description: string; date: string };
}

export type EntryFormLine = { chart_account_id: string; debit: string; credit: string };

export const typeLabels: Record<string, string> = {
  ASSET: "Activo", LIABILITY: "Pasivo", EQUITY: "Patrimonio", INCOME: "Ingresos", EXPENSE: "Gastos",
};

export const typeColors: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  LIABILITY: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  EQUITY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  INCOME: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  EXPENSE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export const EUR = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
