import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { expectedDrawerCash } from "../lib/posFloat";

describe("Daily closing report", () => {
  it("expected drawer cash = opening cash + cash sales", () => {
    expect(expectedDrawerCash(1000, 2450.5)).toBe(3450.5);
  });
});
