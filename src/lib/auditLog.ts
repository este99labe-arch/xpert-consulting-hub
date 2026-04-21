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
    // account_id and user_id are forced server-side by log_audit_event (SECURITY DEFINER)
    // to prevent audit log forgery. The params kept here preserve the public API.
    void accountId;
    void userId;
    await (supabase.rpc as any)("log_audit_event", {
      _action: action,
      _entity_type: entityType,
      _entity_id: entityId,
      _details: details,
    });
  } catch (err) {
    // Fire-and-forget: don't break the main flow
    console.error("Audit log error:", err);
  }
};
