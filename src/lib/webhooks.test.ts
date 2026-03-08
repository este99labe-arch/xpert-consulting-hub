import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
const mockFetch = vi.fn().mockResolvedValue({});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mockGetSession },
  },
}));

// Mock import.meta.env
vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "test-project");

import { dispatchWebhook } from "./webhooks";

describe("dispatchWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  it("sends webhook with correct payload when session exists", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok-123" } },
    });

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
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await dispatchWebhook("acc-1", "invoice.created", {});

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
