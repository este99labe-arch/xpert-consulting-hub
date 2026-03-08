import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export type AuditEntityType =
  | "invoice"
  | "journal_entry"
  | "product"
  | "stock_movement"
  | "purchase_order"
  | "business_client"
  | "employee"
  | "leave_request"
  | "attendance"
  | "account_settings";

interface LogAuditParams {
  accountId: string;
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: Record<string, any>;
}

export const logAudit = async ({
  accountId,
  userId,
  action,
  entityType,
  entityId,
  details = {},
}: LogAuditParams) => {
  try {
    await supabase.from("audit_logs").insert({
      account_id: accountId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    } as any);
  } catch (err) {
    // Fire-and-forget: don't break the main flow
    console.error("Audit log error:", err);
  }
};
