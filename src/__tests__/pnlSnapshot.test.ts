import { describe, it, expect } from "vitest";
import { calculatePnlStatement } from "@/lib/pnl";

describe("POS bill cost snapshot", () => {
  it("uses the cost saved on the bill, not today's product cost", () => {
    const products: any[] = [{ id: "p1", name: "Seer", price: 900, cost_price: 600 }];
    const orders = [{ status: "delivered", total: 900, items: [{ product_id: "p1", name: "Seer", qty: 1, price: 900, unit_cost: 555 }] }];
    expect(calculatePnlStatement(orders, products, [], []).totalCogs ?? (calculatePnlStatement(orders, products, [], []) as any).cogs).toBe(555);
  });
  it("falls back to current product cost for old bills without snapshot", () => {
    const products: any[] = [{ id: "p1", name: "Seer", price: 900, cost_price: 600 }];
    const orders = [{ status: "delivered", total: 900, items: [{ product_id: "p1", name: "Seer", qty: 1, price: 900 }] }];
    expect(calculatePnlStatement(orders, products, [], []).totalCogs ?? (calculatePnlStatement(orders, products, [], []) as any).cogs).toBe(600);
  });
});
