import { describe, it, expect } from "vitest";
import {
  calculatePnlStatement,
  calculateProductPnl,
  exportExpensesToCsv,
  exportProductPnlToCsv,
  EXPENSE_CATEGORIES,
  getExpenseCategoryMeta,
} from "../lib/pnl";
import { parseProductsCsv, exportProductsToCsv, CSV_HEADERS } from "../lib/retailCsv";
import type { Expense } from "../lib/types";

describe("P&L Engine & Multi-Branch Operating Expenses Ledger", () => {
  const mockProducts = [
    {
      id: "prod-vanjaram",
      name: "Vanjaram / King Seer Fish",
      price: 1000,
      cost_price: 650, // 35% margin
      unit: "kg",
      stock: 45,
      category: "Sea Fish",
      is_available: true,
      branch_id: "branch-adyar",
    },
    {
      id: "prod-prawns",
      name: "Tiger Prawns (Jumbo)",
      price: 800,
      cost_price: 520, // 35% margin
      unit: "kg",
      stock: 30,
      category: "Prawns & Shrimp",
      is_available: true,
      branch_id: "branch-adyar",
    },
    {
      id: "prod-pomfret",
      name: "White Pomfret / Vaval",
      price: 1200,
      cost_price: null, // Test benchmark fallback (68% COGS -> 816)
      unit: "kg",
      stock: 20,
      category: "Sea Fish",
      is_available: true,
      branch_id: "branch-anna-nagar",
    },
  ];

  const mockOrdersBranch1 = [
    {
      id: "ord-1",
      branch_id: "branch-adyar",
      status: "delivered",
      subtotal: 3000,
      discount: 200,
      total: 2800,
      items: [
        { product_id: "prod-vanjaram", name: "Vanjaram / King Seer Fish", qty: 2, price: 1000 },
        { product_id: "prod-prawns", name: "Tiger Prawns (Jumbo)", qty: 1, price: 800 },
      ],
    },
    {
      id: "ord-2",
      branch_id: "branch-adyar",
      status: "delivered",
      subtotal: 1000,
      discount: 0,
      total: 1000,
      items: [
        { product_id: "prod-vanjaram", name: "Vanjaram / King Seer Fish", qty: 1, price: 1000 },
      ],
    },
  ];

  const mockOrdersBranch2 = [
    {
      id: "ord-3",
      branch_id: "branch-anna-nagar",
      status: "delivered",
      subtotal: 2400,
      discount: 0,
      total: 2400,
      items: [
        { product_id: "prod-pomfret", name: "White Pomfret / Vaval", qty: 2, price: 1200 },
      ],
    },
  ];

  const mockExpensesBranch1: Expense[] = [
    {
      id: "exp-1",
      branch_id: "branch-adyar",
      category: "rent_lease",
      title: "Adyar Hub Store Rent",
      amount: 1200,
      expense_date: "2026-09-01",
      payment_method: "bank_transfer",
      vendor_name: "Adyar Commercial Real Estate",
      created_at: "2026-09-01T10:00:00Z",
    },
    {
      id: "exp-2",
      branch_id: "branch-adyar",
      category: "cold_storage_ice",
      title: "Flake Ice Slabs 200kg",
      amount: 400,
      expense_date: "2026-09-02",
      payment_method: "cash",
      vendor_name: "Madras Ice Works",
      created_at: "2026-09-02T10:00:00Z",
    },
  ];

  const mockExpensesBranch2: Expense[] = [
    {
      id: "exp-3",
      branch_id: "branch-anna-nagar",
      category: "electricity_utilities",
      title: "Chiller Electricity Bill",
      amount: 600,
      expense_date: "2026-09-02",
      payment_method: "upi",
      vendor_name: "TNEB",
      created_at: "2026-09-02T10:00:00Z",
    },
  ];

  const mockWasteBranch1 = [
    {
      id: "w-1",
      branch_id: "branch-adyar",
      product_id: "prod-vanjaram",
      cost_loss: 150,
      quantity: 0.23,
    },
  ];

  describe("Branch Isolation & Zero Cross-Branch Leakage", () => {
    it("strictly isolates branch 1 financial statement from branch 2 data", () => {
      const pnlBranch1 = calculatePnlStatement(
        mockOrdersBranch1,
        mockProducts,
        mockExpensesBranch1,
        mockWasteBranch1
      );

      // Branch 1 Net Sales: (3000 - 200) + 1000 = 3800
      expect(pnlBranch1.netSales).toBe(3800);
      expect(pnlBranch1.discounts).toBe(200);

      // COGS: 3 Vanjaram @ 650 = 1950, 1 Prawns @ 520 = 520 => 2470
      expect(pnlBranch1.totalCogs).toBe(2470);
      expect(pnlBranch1.totalWasteCost).toBe(150);
      expect(pnlBranch1.totalProductionCost).toBe(2620); // 2470 + 150

      // Gross Profit: 3800 - 2620 = 1180
      expect(pnlBranch1.grossProfit).toBe(1180);
      expect(pnlBranch1.grossMarginPct).toBe(Math.round((1180 / 3800) * 100)); // 31%

      // Operating Expenses: 1200 + 400 = 1600 (zero branch 2 expenses leaked!)
      expect(pnlBranch1.totalExpenses).toBe(1600);
      expect(pnlBranch1.expensesByCategory['rent_lease']).toBe(1200);
      expect(pnlBranch1.expensesByCategory['cold_storage_ice']).toBe(400);
      expect(pnlBranch1.expensesByCategory['electricity_utilities'] || 0).toBe(0); // Branch 2's power bill must NOT leak!

      // Net Profit (EBITDA): 1180 - 1600 = -420
      expect(pnlBranch1.netProfit).toBe(-420);
    });

    it("aggregates full multi-branch consolidated rollup correctly", () => {
      const consolidatedOrders = [...mockOrdersBranch1, ...mockOrdersBranch2];
      const consolidatedExpenses = [...mockExpensesBranch1, ...mockExpensesBranch2];
      const consolidatedWaste = [...mockWasteBranch1];

      const pnlConsolidated = calculatePnlStatement(
        consolidatedOrders,
        mockProducts,
        consolidatedExpenses,
        consolidatedWaste
      );

      // Net sales: 3800 + 2400 = 6200
      expect(pnlConsolidated.netSales).toBe(6200);

      // Branch 2 Pomfret COGS with 68% fallback: 2 * (1200 * 0.68 = 816) = 1632
      // Total COGS: 2470 + 1632 = 4102
      expect(pnlConsolidated.totalCogs).toBe(4102);

      // Consolidated Expenses: 1600 + 600 = 2200
      expect(pnlConsolidated.totalExpenses).toBe(2200);
      expect(pnlConsolidated.expensesByCategory['electricity_utilities']).toBe(600);
    });
  });

  describe("Product-by-Product Economics & Profitability Tiers", () => {
    it("calculates individual SKU margins and profit contributions", () => {
      const pnlItems = calculateProductPnl(mockOrdersBranch1, mockProducts, mockWasteBranch1);

      const vanjaram = pnlItems.find((p) => p.id === "prod-vanjaram");
      expect(vanjaram).toBeDefined();
      expect(vanjaram!.unitsSold).toBe(3);
      expect(vanjaram!.costPrice).toBe(650);
      expect(vanjaram!.sellingPrice).toBe(1000);
      expect(vanjaram!.revenue).toBe(3000);
      expect(vanjaram!.cogs).toBe(1950);
      expect(vanjaram!.wasteCost).toBe(150);
      expect(vanjaram!.grossProfit).toBe(3000 - 1950 - 150); // 900
      expect(vanjaram!.marginPct).toBe(30); // 900 / 3000 = 30%
      expect(vanjaram!.tier).toBe("healthy"); // 20-40% margin

      const prawns = pnlItems.find((p) => p.id === "prod-prawns");
      expect(prawns).toBeDefined();
      expect(prawns!.unitsSold).toBe(1);
      expect(prawns!.grossProfit).toBe(800 - 520); // 280
      expect(prawns!.marginPct).toBe(35);
      expect(prawns!.tier).toBe("high_profit");
    });

    it("falls back to industry standard 68% COGS if cost_price is null or zero", () => {
      const pnlItems = calculateProductPnl(mockOrdersBranch2, mockProducts, []);
      const pomfret = pnlItems.find((p) => p.id === "prod-pomfret");

      expect(pomfret).toBeDefined();
      expect(pomfret!.costPrice).toBe(Math.round(1200 * 0.68)); // 816
      expect(pomfret!.revenue).toBe(2400);
      expect(pomfret!.cogs).toBe(1632);
      expect(pomfret!.grossProfit).toBe(2400 - 1632); // 768
      expect(pomfret!.marginPct).toBe(32);
    });
  });

  describe("Operating Expense Categories & CSV Formatting", () => {
    it("contains all 10 required expense categories with metadata", () => {
      expect(EXPENSE_CATEGORIES).toHaveLength(10);
      const ids = EXPENSE_CATEGORIES.map((c) => c.id);
      expect(ids).toContain("rent_lease");
      expect(ids).toContain("salaries_wages");
      expect(ids).toContain("electricity_utilities");
      expect(ids).toContain("packaging_bags");
      expect(ids).toContain("cold_storage_ice");
      expect(ids).toContain("fuel_logistics");
      expect(ids).toContain("marketing_ads");
      expect(ids).toContain("maintenance_repairs");
      expect(ids).toContain("licenses_taxes");
      expect(ids).toContain("other");

      const rent = getExpenseCategoryMeta("rent_lease");
      expect(rent.label).toContain("Rent");
      expect(rent.emoji).toBe("🏢");
    });

    it("exports expenses to CSV format with correct escaping", () => {
      const csv = exportExpensesToCsv(mockExpensesBranch1, "Adyar Branch");
      expect(csv).toContain("Date,Category,Title,Amount (INR),Payment Method,Vendor,Branch,Notes");
      expect(csv).toContain('"Adyar Hub Store Rent"');
      expect(csv).toContain("1200");
      expect(csv).toContain("BANK_TRANSFER");
      expect(csv).toContain('"Madras Ice Works"');
    });

    it("exports product P&L to CSV format", () => {
      const items = calculateProductPnl(mockOrdersBranch1, mockProducts, mockWasteBranch1);
      const csv = exportProductPnlToCsv(items, "Adyar Branch");

      expect(csv).toContain("Product Name,Brand,Category,Unit,Selling Price (INR),Buying Cost (INR)");
      expect(csv).toContain('"Vanjaram / King Seer Fish"');
      expect(csv).toContain("650");
      expect(csv).toContain("30%");
    });
  });

  describe("Retail CSV Import/Export with cost_price", () => {
    it("includes cost_price in CSV_HEADERS", () => {
      expect(CSV_HEADERS).toContain("cost_price");
    });

    it("parses cost_price from CSV input text", () => {
      const sampleCsv = [
        "name,category,cost_price,price,old_price,unit,stock",
        'Sony Bravia 55-inch 4K,Smart TVs,42000,54990,65000,pc,10',
        'Cotton Formal Shirt,Apparel,450,899,,pc,25',
      ].join("\n");

      const result = parseProductsCsv(sampleCsv);
      expect(result.errors).toHaveLength(0);
      expect(result.validProducts).toHaveLength(2);

      const tv = result.validProducts[0];
      expect(tv!.name).toBe("Sony Bravia 55-inch 4K");
      expect(tv!.price).toBe(54990);
      expect(tv!.cost_price).toBe(42000);

      const shirt = result.validProducts[1];
      expect(shirt!.name).toBe("Cotton Formal Shirt");
      expect(shirt!.price).toBe(899);
      expect(shirt!.cost_price).toBe(450);
    });

    it("exports products including cost_price column", () => {
      const csv = exportProductsToCsv(mockProducts);
      const lines = csv.split("\n");

      expect(lines[0]).toContain("cost_price");
      expect(lines[1]).toContain("650"); // Vanjaram cost price
      expect(lines[2]).toContain("520"); // Tiger Prawns cost price
    });
  });
});
