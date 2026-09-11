import type { Product, Expense, ExpenseCategory, PnlSummary, ProductPnlItem } from "./types";

export interface ExpenseCategoryMeta {
  id: ExpenseCategory;
  label: string;
  emoji: string;
  description: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  {
    id: "rent_lease",
    label: "Rent & Store Lease",
    emoji: "🏢",
    description: "Hub rental, store lease, harbor wharfage & yard charges",
  },
  {
    id: "salaries_wages",
    label: "Salaries & Daily Wages",
    emoji: "👥",
    description: "Cutting staff, delivery crew, store managers & helper pay",
  },
  {
    id: "electricity_utilities",
    label: "Electricity & Utilities",
    emoji: "⚡",
    description: "Deep chillers, cold-chain power, water supply & municipal bills",
  },
  {
    id: "packaging_bags",
    label: "Packaging & Bags",
    emoji: "📦",
    description: "Vacuum sealed pouches, thermal insulation boxes & branded bags",
  },
  {
    id: "cold_storage_ice",
    label: "Ice & Cold Storage",
    emoji: "❄️",
    description: "Crushed flake ice, dry ice pellets & external cold room storage",
  },
  {
    id: "fuel_logistics",
    label: "Logistics, Fuel & Transport",
    emoji: "🚚",
    description: "Delivery bike fuel, dock transport tempo & vehicle maintenance",
  },
  {
    id: "marketing_ads",
    label: "Marketing, Ads & SMS",
    emoji: "📢",
    description: "Meta/Google ads, WhatsApp business API, flyers & local banners",
  },
  {
    id: "maintenance_repairs",
    label: "Equipment & Maintenance",
    emoji: "🔧",
    description: "Weighing scale calibration, cutter blade sharpening, repairs",
  },
  {
    id: "licenses_taxes",
    label: "Licenses, FSSAI & Taxes",
    emoji: "📋",
    description: "Trade licenses, FSSAI renewal, GST filing fees & accounting",
  },
  {
    id: "other",
    label: "Miscellaneous & General",
    emoji: "🏷️",
    description: "Stationery, POS receipt rolls, store refreshments & petty cash",
  },
];

export function getExpenseCategoryMeta(cat: string): ExpenseCategoryMeta {
  const found = EXPENSE_CATEGORIES.find((c) => c.id === cat);
  if (found) return found;
  return {
    id: "other",
    label: cat ? cat.replace(/_/g, " ").replace(/\\b\\w/g, (l) => l.toUpperCase()) : "Miscellaneous",
    emoji: "🏷️",
    description: "General store operating expense",
  };
}

/**
 * Calculates high-precision Profit & Loss statement for any branch or consolidated scope
 */
export function calculatePnlStatement(
  orders: any[],
  products: Product[],
  expenses: Expense[],
  wasteEntries: any[] = []
): PnlSummary {
  // 1. Build product cost map for fast lookup
  const productCostMap = new Map<string, number>();
  const productNameCostMap = new Map<string, number>();

  for (const p of products) {
    const cost = typeof p.cost_price === "number" && !isNaN(p.cost_price) && p.cost_price > 0
      ? p.cost_price
      : Math.round(Number(p.price || 0) * 0.68); // fallback benchmark: 68% COGS
    if (p.id) productCostMap.set(p.id.toLowerCase().trim(), cost);
    if (p.name) productNameCostMap.set(p.name.toLowerCase().trim(), cost);
  }

  // 2. Tally Sales & Direct COGS from orders
  let grossSales = 0;
  let discounts = 0;
  let netSales = 0;
  let gstCollected = 0;
  let totalCogs = 0;
  let unitsSold = 0;

  const validOrders = orders.filter((o) => {
    const st = (o.status || "").toLowerCase();
    return st !== "cancelled" && st !== "returned" && st !== "refunded";
  });

  for (const o of validOrders) {
    const orderTotal = Number(o.total || 0);
    const orderDisc = Number(o.discount || 0);
    const orderTax = Number(o.tax || o.gst_amount || 0);

    discounts += orderDisc;
    netSales += orderTotal;
    grossSales += orderTotal + orderDisc;
    gstCollected += orderTax;

    for (const it of o.items ?? []) {
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      unitsSold += qty;

      const prodId = (it.product_id || "").toLowerCase().trim();
      const prodName = (it.name || "").toLowerCase().trim();
      const unitCost = productCostMap.get(prodId) ?? productNameCostMap.get(prodName) ?? Math.round(price * 0.68);

      totalCogs += Math.round(unitCost * qty);
    }
  }

  // 3. Tally Waste & Spoilage Cost
  let totalWasteCost = 0;
  for (const w of wasteEntries) {
    const qty = Number(w.quantity || 0);
    const prodId = (w.product_id || "").toLowerCase().trim();
    const prodName = (w.product_name || "").toLowerCase().trim();
    const unitCost = productCostMap.get(prodId) ?? productNameCostMap.get(prodName) ?? 150;
    totalWasteCost += Math.round(qty * unitCost);
  }

  const totalProductionCost = totalCogs + totalWasteCost;
  const grossProfit = netSales - totalProductionCost;
  const grossMarginPct = netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0;

  // 4. Tally Operating Expenses (OPEX)
  const expensesByCategory: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) {
    expensesByCategory[c.id] = 0;
  }

  let totalExpenses = 0;
  for (const exp of expenses) {
    const amt = Number(exp.amount || 0);
    totalExpenses += amt;
    const cat = exp.category || "other";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
  }

  // 5. Net Operating Profit (EBITDA)
  const netProfit = grossProfit - totalExpenses;
  const netMarginPct = netSales > 0 ? Math.round((netProfit / netSales) * 100) : 0;

  return {
    grossSales: Math.round(grossSales),
    discounts: Math.round(discounts),
    netSales: Math.round(netSales),
    gstCollected: Math.round(gstCollected),
    totalCogs: Math.round(totalCogs),
    totalWasteCost: Math.round(totalWasteCost),
    totalProductionCost: Math.round(totalProductionCost),
    grossProfit: Math.round(grossProfit),
    grossMarginPct,
    totalExpenses: Math.round(totalExpenses),
    expensesByCategory,
    netProfit: Math.round(netProfit),
    netMarginPct,
    orderCount: validOrders.length,
    unitsSold: Math.round(unitsSold * 100) / 100,
  };
}

/**
 * Calculates per-product unit economics, revenue, COGS, waste absorption, and margin
 */
export function calculateProductPnl(
  orders: any[],
  products: Product[],
  wasteEntries: any[] = []
): ProductPnlItem[] {
  // Sales aggregator per product
  const salesMap = new Map<string, { qty: number; revenue: number }>();
  const validOrders = orders.filter((o) => {
    const st = (o.status || "").toLowerCase();
    return st !== "cancelled" && st !== "returned" && st !== "refunded";
  });

  for (const o of validOrders) {
    for (const it of o.items ?? []) {
      const key = (it.product_id || it.name || "").toLowerCase().trim();
      const cur = salesMap.get(key) ?? { qty: 0, revenue: 0 };
      salesMap.set(key, {
        qty: cur.qty + Number(it.qty || 0),
        revenue: cur.revenue + Number(it.qty || 0) * Number(it.price || 0),
      });
    }
  }

  // Waste aggregator per product
  const wasteMap = new Map<string, number>();
  for (const w of wasteEntries) {
    const key = (w.product_id || w.product_name || "").toLowerCase().trim();
    wasteMap.set(key, (wasteMap.get(key) ?? 0) + Number(w.quantity || 0));
  }

  // Build item breakdown
  const items: ProductPnlItem[] = products.map((p) => {
    const byId = p.id ? salesMap.get(p.id.toLowerCase().trim()) : undefined;
    const byName = p.name ? salesMap.get(p.name.toLowerCase().trim()) : undefined;
    const sales = byId || byName || { qty: 0, revenue: 0 };

    const wasteQty = (p.id ? wasteMap.get(p.id.toLowerCase().trim()) : undefined)
      ?? (p.name ? wasteMap.get(p.name.toLowerCase().trim()) : undefined)
      ?? 0;

    const sellingPrice = Number(p.price || 0);
    const costPrice = typeof p.cost_price === "number" && !isNaN(p.cost_price) && p.cost_price > 0
      ? p.cost_price
      : Math.round(sellingPrice * 0.68);

    const cogs = Math.round(costPrice * sales.qty);
    const wasteCost = Math.round(costPrice * wasteQty);
    const grossProfit = sales.revenue - cogs - wasteCost;
    const marginPct = sales.revenue > 0 ? Math.round((grossProfit / sales.revenue) * 100) : 0;

    let tier: "high_profit" | "healthy" | "slim" | "loss_making" = "slim";
    if (grossProfit < 0) {
      tier = "loss_making";
    } else if (marginPct >= 35) {
      tier = "high_profit";
    } else if (marginPct >= 20) {
      tier = "healthy";
    }

    return {
      id: p.id,
      name: p.name,
      category: p.category || "General",
      brand: p.brand || null,
      unit: p.unit || "kg",
      stock: Number(p.stock || 0),
      sellingPrice,
      costPrice,
      unitsSold: Math.round(sales.qty * 100) / 100,
      revenue: Math.round(sales.revenue),
      cogs,
      wasteQty: Math.round(wasteQty * 100) / 100,
      wasteCost,
      grossProfit: Math.round(grossProfit),
      marginPct,
      profitSharePct: 0, // will compute after total
      tier,
    };
  });

  // Calculate profit share percentage
  const totalStoreGrossProfit = items.reduce((sum, it) => sum + Math.max(0, it.grossProfit), 0);
  for (const it of items) {
    it.profitSharePct = totalStoreGrossProfit > 0 && it.grossProfit > 0
      ? Math.round((it.grossProfit / totalStoreGrossProfit) * 1000) / 10
      : 0;
  }

  // Sort: descending by gross profit, then revenue
  items.sort((a, b) => b.grossProfit - a.grossProfit || b.revenue - a.revenue);
  return items;
}

/**
 * Format Expenses ledger to standard CSV
 */
export function exportExpensesToCsv(expenses: Expense[], branchLabel: string = "All Branches"): string {
  const headers = ["Date", "Category", "Title", "Amount (INR)", "Payment Method", "Vendor", "Branch", "Notes"];
  const rows = expenses.map((e) => [
    e.expense_date,
    getExpenseCategoryMeta(e.category).label,
    `"${(e.title || "").replace(/"/g, '""')}"`,
    e.amount,
    (e.payment_method || "cash").toUpperCase(),
    `"${(e.vendor_name || "").replace(/"/g, '""')}"`,
    `"${(e.branch_name || branchLabel).replace(/"/g, '""')}"`,
    `"${(e.notes || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Format Product-by-Product P&L to CSV
 */
export function exportProductPnlToCsv(items: ProductPnlItem[], branchLabel: string = "All Branches"): string {
  const headers = [
    "Product Name",
    "Brand",
    "Category",
    "Unit",
    "Selling Price (INR)",
    "Buying Cost (INR)",
    "Units Sold",
    "Sales Revenue (INR)",
    "Direct COGS (INR)",
    "Waste Qty",
    "Waste Loss (INR)",
    "Gross Profit (INR)",
    "Gross Margin (%)",
    "Profit Share (%)",
    "Tier",
  ];

  const rows = items.map((i) => [
    `"${(i.name || "").replace(/"/g, '""')}"`,
    `"${(i.brand || "").replace(/"/g, '""')}"`,
    `"${(i.category || "").replace(/"/g, '""')}"`,
    i.unit,
    i.sellingPrice,
    i.costPrice,
    i.unitsSold,
    i.revenue,
    i.cogs,
    i.wasteQty,
    i.wasteCost,
    i.grossProfit,
    `${i.marginPct}%`,
    `${i.profitSharePct}%`,
    i.tier.replace(/_/g, " ").toUpperCase(),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
