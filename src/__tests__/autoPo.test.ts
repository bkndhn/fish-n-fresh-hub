import { describe, it, expect } from "vitest";
import { productsNeedingPo, suggestedRestockQty } from "@/lib/autoPo";

describe("auto supplier PO", () => {
  it("drafts only items at or below their low-stock level and not already ordered", () => {
    const list = [
      { id: "a", name: "A", stock: 3, low_stock_threshold: 5 },
      { id: "b", name: "B", stock: 9, low_stock_threshold: 5 },
      { id: "c", name: "C", stock: 0, low_stock_threshold: 5 },
    ];
    expect(productsNeedingPo(list, new Set(["c"])).map((p) => p.id)).toEqual(["a"]);
  });
  it("restocks to twice the threshold", () => {
    expect(suggestedRestockQty({ id: "a", name: "A", stock: 3, low_stock_threshold: 5 })).toBe(7);
  });
});
