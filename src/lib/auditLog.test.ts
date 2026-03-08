import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ insert: mockInsert })),
  },
}));

import { logAudit } from "./auditLog";
import { supabase } from "@/integrations/supabase/client";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an audit log entry", async () => {
    await logAudit({
      accountId: "acc-1",
      userId: "user-1",
      action: "CREATE",
      entityType: "invoice",
      entityId: "inv-1",
      details: { amount: 100 },
    });

    expect(supabase.from).toHaveBeenCalledWith("audit_logs");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "acc-1",
        user_id: "user-1",
        action: "CREATE",
        entity_type: "invoice",
        entity_id: "inv-1",
      })
    );
  });

  it("does not throw on error", async () => {
    mockInsert.mockRejectedValueOnce(new Error("DB error"));
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
