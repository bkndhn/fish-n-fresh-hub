import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { COUNTER_ONLY_PAGES, isCounterOnly, BUSINESS_HIDDEN_PAGES } from "@/lib/pageVisibility";

describe("counter only", () => {
  it("covers catalog, wishlist, tracking and delivery", () => {
    for (const p of ["/catalog", "/wishlist", "/track", "/admin/delivery"]) expect(COUNTER_ONLY_PAGES).toContain(p);
  });
  it("is on only when all online pages are hidden", () => {
    expect(isCounterOnly([...COUNTER_ONLY_PAGES])).toBe(true);
    expect(isCounterOnly(["/catalog"])).toBe(false);
  });
  it("snacks hides table QR, wholesale and delivery", () => {
    for (const p of ["/table", "/admin/tables", "/wholesale", "/admin/wholesale", "/admin/delivery"])
      expect(BUSINESS_HIDDEN_PAGES.snacks_sweets).toContain(p);
  });
});
