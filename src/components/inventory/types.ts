export interface Product {
  id: string; account_id: string; name: string; sku: string; description: string | null;
  category: string; unit: string; min_stock: number; current_stock: number;
  cost_price: number; sale_price: number; is_active: boolean; created_at: string; updated_at: string;
}

export interface StockMovement {
  id: string; account_id: string; product_id: string; type: string; quantity: number;
  reason: string; notes: string | null; created_by: string; created_at: string;
  products?: { name: string; sku: string };
}

export interface PurchaseOrder {
  id: string; account_id: string; product_id: string; quantity: number; status: string;
  estimated_date: string | null; notes: string | null; created_by: string;
  created_at: string; updated_at: string;
  products?: { name: string; sku: string };
}

export const statusLabels: Record<string, string> = { DRAFT: "Borrador", PENDING: "Pendiente", ORDERED: "Pedido", RECEIVED: "Recibido" };
export const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ORDERED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};
export const movementTypeLabels: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste" };

import { ArrowUpCircle, ArrowDownCircle, RotateCcw } from "lucide-react";
export const movementTypeIcons: Record<string, any> = { IN: ArrowUpCircle, OUT: ArrowDownCircle, ADJUSTMENT: RotateCcw };
