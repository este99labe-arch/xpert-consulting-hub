import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

import { dispatchWebhook } from "./webhooks";
import { supabase } from "@/integrations/supabase/client";

const mockGetSession = vi.mocked(supabase.auth.getSession);

describe("dispatchWebhook", () => {
  const mockFetch = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  it("sends webhook with correct payload when session exists", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok-123" } },
    } as any);

    await dispatchWebhook("acc-1", "invoice.created", { id: "inv-1" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/dispatch_webhooks"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          account_id: "acc-1",
          event: "invoice.created",
          payload: { id: "inv-1" },
        }),
      })
    );
  });

  it("does not fetch when no session", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    } as any);

    await dispatchWebhook("acc-1", "invoice.created", {});

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
