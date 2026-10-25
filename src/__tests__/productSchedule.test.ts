import { describe, it, expect } from "vitest";
import { isProductSellableNow } from "@/lib/productSchedule";

// 2026-10-25 is a Sunday
const at = (h: number, m = 0) => new Date(2026, 9, 25, h, m);

describe("product schedule", () => {
  it("hides product after its expiry date", () => {
    expect(isProductSellableNow({ expiry_date: "2026-10-24" }, at(10))).toBe(false);
    expect(isProductSellableNow({ expiry_date: "2026-10-25" }, at(10))).toBe(true);
  });
  it("only sells on chosen weekdays", () => {
    expect(isProductSellableNow({ available_days: [5, 6] }, at(10))).toBe(false);
    expect(isProductSellableNow({ available_days: [0] }, at(10))).toBe(true);
  });
  it("only sells within daily time window", () => {
    const p = { available_from: "06:00", available_to: "11:00" };
    expect(isProductSellableNow(p, at(7))).toBe(true);
    expect(isProductSellableNow(p, at(12))).toBe(false);
  });
});
