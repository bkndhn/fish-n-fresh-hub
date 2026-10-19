import { describe, it, expect } from "vitest";
import { buildYieldReport, groupByCategory } from "@/lib/yieldReport";

const products = [{ id: "s", name: "Seer", price: 500, category: "Fish" }];

describe("yield report", () => {
  it("uses the latest delivery batch and flags price below true cost", () => {
    const rows = buildYieldReport(
      [
        { product_id: "s", product_name: "Seer", purchase_cost_per_kg: 300, true_cost_per_kg: 400, cutting_loss_pct: 25, delivery_date: "2026-10-01", created_at: "2026-10-01T00:00:00Z" },
        { product_id: "s", product_name: "Seer", purchase_cost_per_kg: 400, true_cost_per_kg: 555.56, cutting_loss_pct: 28, delivery_date: "2026-10-19", created_at: "2026-10-19T00:00:00Z" },
      ],
      products,
    );
    expect(rows[0]!.trueCost).toBe(555.56);
    expect(rows[0]!.marginLossPerKg).toBe(155.56);
    expect(rows[0]!.belowCost).toBe(true);
    expect(rows[0]!.batches).toBe(2);
    expect(groupByCategory(rows)[0]!.belowCost).toBe(1);
  });
});
