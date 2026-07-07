import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

import { logAudit } from "./auditLog";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it("registra el evento vía RPC log_audit_event (server-side)", async () => {
    await logAudit({
      accountId: "acc-1",
      userId: "user-1",
      action: "CREATE",
      entityType: "invoice",
      entityId: "inv-1",
      details: { amount: 100 },
    });

    expect(mockRpc).toHaveBeenCalledWith("log_audit_event", {
      _action: "CREATE",
      _entity_type: "invoice",
      _entity_id: "inv-1",
      _details: { amount: 100 },
    });
  });

  it("no lanza excepción si el registro falla (fire-and-forget)", async () => {
    mockRpc.mockRejectedValueOnce(new Error("DB error"));
    await expect(
      logAudit({
        accountId: "acc-1",
        userId: "user-1",
        action: "DELETE",
        entityType: "product",
        entityId: "p-1",
      })
    ).resolves.toBeUndefined();
  });
});
