import { describe, expect, it } from "vitest";
import { applyAccountDiscount, resolveWholesaleUnitPrice } from "@/lib/wholesale";

describe("verified trade checkout pricing", () => {
  const product = { price: 547, wholesale_price: 505, wholesale_min_qty: 0, wholesale_tiers: [] };
  it("prices 12.5 kg at the saved wholesale rate and approved 5% discount", () => {
    const rate = applyAccountDiscount(resolveWholesaleUnitPrice(product, 12.5), 5);
    expect(rate).toBe(479.75);
    expect(rate * 12.5 + 25).toBe(6021.875);
  });
});