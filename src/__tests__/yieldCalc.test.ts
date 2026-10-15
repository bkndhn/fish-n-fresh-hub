import { describe, expect, it } from "vitest";
import { calcYield } from "@/lib/yieldCalc";

describe("yield calculator", () => {
  it("10kg seer at ₹400 → 7.2kg gives ₹555.56/kg and 28% loss", () => {
    const r = calcYield({ rawKg: 10, costPerKg: 400, cleanedKg: 7.2, sellingPrice: 600 })!;
    expect(r.trueCostPerKg).toBe(555.56);
    expect(r.lossPct).toBe(28);
    expect(r.sellingAtLoss).toBe(false);
  });
  it("flags selling at ₹540 as a loss", () => {
    expect(calcYield({ rawKg: 10, costPerKg: 400, cleanedKg: 7.2, sellingPrice: 540 })!.sellingAtLoss).toBe(true);
  });
  it("byproduct revenue lowers true cost", () => {
    expect(calcYield({ rawKg: 10, costPerKg: 400, cleanedKg: 7.2, byproductRevenue: 200 })!.trueCostPerKg).toBe(527.78);
  });
  it("rejects cleaned weight above raw weight", () => {
    expect(calcYield({ rawKg: 5, costPerKg: 400, cleanedKg: 6 })).toBeNull();
  });
});
