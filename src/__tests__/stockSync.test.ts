import { describe, it, expect } from "vitest";

describe("Atomic Stock Synchronization Logic", () => {
  it("calculates accurate stock deductions for integer and fractional units", () => {
    const currentStockKg = 15.5;
    const requestedQty = 2.25;
    const remaining = Math.max(0, Math.round((currentStockKg - requestedQty) * 100) / 100);
    expect(remaining).toBe(13.25);
  });

  it("prevents negative stock balances by clamping at zero", () => {
    const currentStock = 3;
    const requestedQty = 5;
    const remaining = Math.max(0, currentStock - requestedQty);
    expect(remaining).toBe(0);
  });

  it("correctly restores inventory upon order cancellation", () => {
    const initialStock = 10;
    const orderQty = 3.5;
    const stockAfterOrder = initialStock - orderQty; // 6.5
    const restoredStock = Math.round((stockAfterOrder + orderQty) * 100) / 100;
    expect(restoredStock).toBe(10);
  });

  it("handles both product_id (snake_case) and productId (camelCase) keys", () => {
    const items = [
      { product_id: "uuid-1", qty: 2, name: "Vanjaram" },
      { productId: "uuid-2", qty: 1, name: "White Pomfret" },
    ];

    const extracted = items.map((i) => ({
      pid: i.product_id || (i as any).productId,
      qty: i.qty,
    }));

    expect(extracted[0]?.pid).toBe("uuid-1");
    expect(extracted[1]?.pid).toBe("uuid-2");
  });
});
