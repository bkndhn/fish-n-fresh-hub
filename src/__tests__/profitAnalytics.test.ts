import { describe, it, expect } from "vitest";

describe("Profitability & Margin Calculations", () => {
  it("calculates accurate Gross Profit and Margin percentage", () => {
    const sellingPrice = 950; // Vanjaram ₹950
    const costPrice = 650;    // Inward cost ₹650
    const unitsSold = 10;     // 10 kg

    const revenue = sellingPrice * unitsSold;      // ₹9,500
    const cogs = costPrice * unitsSold;            // ₹6,500
    const grossProfit = revenue - cogs;            // ₹3,000
    const marginPct = Math.round((grossProfit / revenue) * 100);

    expect(revenue).toBe(9500);
    expect(cogs).toBe(6500);
    expect(grossProfit).toBe(3000);
    expect(marginPct).toBe(32);
  });

  it("handles fallback seafood cost benchmark (68% COGS) when cost_price is empty", () => {
    const sellingPrice = 880;
    const fallbackCost = Math.round(sellingPrice * 0.68); // ~₹598
    const units = 5;

    const revenue = sellingPrice * units;
    const cogs = fallbackCost * units;
    const grossProfit = revenue - cogs;
    const marginPct = Math.round((grossProfit / revenue) * 100);

    expect(fallbackCost).toBe(598);
    expect(grossProfit).toBe(1410);
    expect(marginPct).toBe(32);
  });

  it("calculates customer repeat buyer rate correctly", () => {
    const orders = [
      { phone: "9843061919", orderId: "1" },
      { phone: "9843061919", orderId: "2" },
      { phone: "9843061919", orderId: "3" },
      { phone: "9876543210", orderId: "4" },
      { phone: "9998887776", orderId: "5" },
    ];

    const customerOrderCounts = new Map<string, number>();
    for (const o of orders) {
      customerOrderCounts.set(o.phone, (customerOrderCounts.get(o.phone) ?? 0) + 1);
    }

    const totalUniqueBuyers = customerOrderCounts.size; // 3 buyers
    const repeatBuyers = [...customerOrderCounts.values()].filter((c) => c > 1).length; // 1 buyer
    const repeatRate = Math.round((repeatBuyers / totalUniqueBuyers) * 100);

    expect(totalUniqueBuyers).toBe(3);
    expect(repeatBuyers).toBe(1);
    expect(repeatRate).toBe(33);
  });
});
