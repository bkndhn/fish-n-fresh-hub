import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert }) } }));
import { registerPushNotification } from "@/lib/fcm";

describe("push subscription persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", { Notification: { permission: "granted" } });
    vi.stubGlobal("Notification", { permission: "granted" });
    upsert.mockReset();
  });
  function browserSubscription(subscription: unknown) {
    vi.stubGlobal("navigator", { userAgent: "Android", serviceWorker: {
      ready: Promise.resolve(), register: vi.fn().mockResolvedValue({ pushManager: {
        getSubscription: vi.fn().mockResolvedValue(subscription), subscribe: vi.fn().mockRejectedValue(new Error("Unavailable")),
      } }),
    } });
  }
  it("does not report enrollment when saving fails", async () => {
    browserSubscription({ toJSON: () => ({ endpoint: "https://push.example.test/sub" }) });
    upsert.mockResolvedValue({ error: { message: "Permission denied" } });
    expect(await registerPushNotification("staff-id", "staff")).toBeNull();
    expect(upsert).toHaveBeenCalledOnce();
  });
  it("does not save fake tokens when no subscription exists", async () => {
    browserSubscription(null);
    expect(await registerPushNotification("staff-id", "staff")).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });
  it("reports success only after saving a real subscription", async () => {
    const subscription = { endpoint: "https://push.example.test/sub" };
    browserSubscription({ toJSON: () => subscription });
    upsert.mockResolvedValue({ error: null });
    expect(await registerPushNotification("staff-id", "staff")).toBe(JSON.stringify(subscription));
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({ user_id: "staff-id", role: "staff" });
  });
});