import { describe, it, expect } from "vitest";
import { calculatePnlStatement, calculateProductPnl } from "../lib/pnl";
import type { Product } from "../lib/types";

const products = [{ id: "fish", name: "Seer", price: 800, cost_price: 555.56 }] as Product[];
const orders = [{ status: "delivered", total: 5760, items: [{ product_id: "fish", qty: 7.2, price: 800 }] }];
describe("Yield-adjusted margins", () => {
  it("uses true cleaned kg cost for COGS", () => {
    expect(calculatePnlStatement(orders, products, []).totalCogs).toBe(4000);
  });
  it("does not expense absorbed cutting loss twice", () => {
    const waste = [{ product_id: "fish", quantity: 2.8, cost_loss: 1120, notes: "[yield-cost-absorbed]" }];
    expect(calculatePnlStatement(orders, products, [], waste).grossProfit).toBe(1760);
    expect(calculateProductPnl(orders, products, waste)[0]?.wasteCost).toBe(0);
  });
  it("retains separately recorded spoilage cost", () => {
    expect(calculatePnlStatement(orders, products, [], [{ product_id: "fish", quantity: 1, cost_loss: 200 }]).totalWasteCost).toBe(200);
  });
  it("shows losses rather than hiding negative margins", () => {
    expect(calculateProductPnl([{ status: "delivered", total: 400, items: [{ product_id: "fish", qty: 1, price: 400 }] }], products)[0]?.grossProfit).toBe(-156);
  });
});