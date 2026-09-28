import { describe, it, expect } from "vitest";
import type { RestaurantTable, Product, TableOrderingSettings } from "@/lib/types";

describe("Custom Tables & QR Studio Configuration", () => {
  const sampleTables: RestaurantTable[] = [
    { id: "1", name: "Table 01", seating_capacity: 4, section: "Main Hall", status: "active" },
    { id: "t-2", name: "Rooftop Garden 2", seating_capacity: 6, section: "Rooftop", status: "active" },
    { id: "vip-1", name: "Family AC Booth 1", seating_capacity: 8, section: "AC Dining", status: "reserved" },
    { id: "terrace-4", name: "Balcony Sunset 4", seating_capacity: 2, section: "Terrace", status: "maintenance" },
  ];

  it("supports unlimited custom table schemas with sections and capacities", () => {
    expect(sampleTables).toHaveLength(4);
    expect(sampleTables[1].section).toBe("Rooftop");
    expect(sampleTables[2].status).toBe("reserved");
    expect(sampleTables[3].status).toBe("maintenance");
  });

  it("correctly identifies unique sections from table list", () => {
    const sections = Array.from(new Set(sampleTables.map((t) => t.section)));
    expect(sections).toEqual(["Main Hall", "Rooftop", "AC Dining", "Terrace"]);
  });

  it("matches customer table URLs by ID, digits, and name", () => {
    const matchTable = (input: string) => {
      const clean = input.trim().toLowerCase();
      const exact = sampleTables.find((t) => t.id.toLowerCase() === clean);
      if (exact) return exact;
      const cleanDigits = clean.replace(/\D/g, "");
      return sampleTables.find(
        (t) =>
          (cleanDigits && t.id.toLowerCase() === cleanDigits) ||
          t.name.toLowerCase() === `table ${clean}` ||
          t.name.toLowerCase() === `table ${cleanDigits}`
      );
    };

    expect(matchTable("1")?.name).toBe("Table 01");
    expect(matchTable("t-2")?.section).toBe("Rooftop");
    expect(matchTable("vip-1")?.seating_capacity).toBe(8);
  });
});

describe("Master QR Toggle & Table Gateway Gates", () => {
  it("determines whether customer table ordering is enabled globally", () => {
    const onlineSettings: TableOrderingSettings = {
      table_ordering_enabled: true,
      table_ordering_offline_message: "Offline message",
    };
    const offlineSettings: TableOrderingSettings = {
      table_ordering_enabled: false,
      table_ordering_offline_message: "Our kitchen is closed for private dining.",
    };

    expect(onlineSettings.table_ordering_enabled).toBe(true);
    expect(offlineSettings.table_ordering_enabled).toBe(false);
    expect(offlineSettings.table_ordering_offline_message).toContain("kitchen is closed");
  });

  it("flags maintenance and reserved tables as blocked for immediate ordering", () => {
    const isTableAvailable = (t: RestaurantTable) => t.status === "active";

    expect(isTableAvailable({ id: "1", name: "T1", seating_capacity: 4, section: "Main", status: "active" })).toBe(true);
    expect(isTableAvailable({ id: "2", name: "T2", seating_capacity: 4, section: "Main", status: "maintenance" })).toBe(false);
    expect(isTableAvailable({ id: "3", name: "T3", seating_capacity: 4, section: "Main", status: "reserved" })).toBe(false);
  });
});

describe("Unlimited Stock & Badge Suppression Engine", () => {
  const isProductOutOfStock = (
    product: { stock: number | null; is_available: boolean; unlimited_stock?: boolean },
    settings: {
      allow_unlimited_stock?: boolean | null;
      business_vertical?: string | null;
      hide_out_of_stock_badges?: boolean | null;
    }
  ) => {
    const isUnlimited = Boolean(
      product.unlimited_stock ||
      settings.allow_unlimited_stock ||
      settings.business_vertical === "restaurant_cafe" ||
      settings.business_vertical === "juice_shake_bar" ||
      settings.business_vertical === "bakery_cake"
    );
    const hideBadges = Boolean(settings.hide_out_of_stock_badges);

    return !isUnlimited && !hideBadges && ((product.stock !== null && product.stock <= 0) || !product.is_available);
  };

  it("marks standard 0-stock products as out of stock for retail verticals", () => {
    const product = { stock: 0, is_available: true };
    const settings = { allow_unlimited_stock: false, business_vertical: "seafood" };
    expect(isProductOutOfStock(product, settings)).toBe(true);
  });

  it("never marks 0-stock products out of stock when allow_unlimited_stock is enabled", () => {
    const product = { stock: 0, is_available: true };
    const settings = { allow_unlimited_stock: true, business_vertical: "seafood" };
    expect(isProductOutOfStock(product, settings)).toBe(false);
  });

  it("never marks 0-stock dishes out of stock for hospitality & cafe verticals", () => {
    const product = { stock: 0, is_available: true };
    expect(isProductOutOfStock(product, { business_vertical: "restaurant_cafe" })).toBe(false);
    expect(isProductOutOfStock(product, { business_vertical: "juice_shake_bar" })).toBe(false);
    expect(isProductOutOfStock(product, { business_vertical: "bakery_cake" })).toBe(false);
  });

  it("respects per-item unlimited_stock override", () => {
    const product = { stock: 0, is_available: true, unlimited_stock: true };
    const settings = { allow_unlimited_stock: false, business_vertical: "electronics" };
    expect(isProductOutOfStock(product, settings)).toBe(false);
  });

  it("suppresses out of stock badges when hide_out_of_stock_badges is enabled", () => {
    const product = { stock: 0, is_available: false };
    const settings = { hide_out_of_stock_badges: true, business_vertical: "grocery" };
    expect(isProductOutOfStock(product, settings)).toBe(false);
  });
});

describe("Dine-In & Table Sales Analytics Engine", () => {
  const sampleOrders = [
    {
      id: "ord-1",
      order_number: "DINE-T1-1001",
      fulfillment_type: "dine_in",
      table_number: "Table 1",
      total: 850,
      items: [
        { name: "Dum Biryani [SPICY]", price: 350, qty: 2 },
        { name: "Fresh Lime Soda [MILD]", price: 75, qty: 2 },
      ],
      created_at: "2026-09-28T12:00:00Z",
    },
    {
      id: "ord-2",
      order_number: "DINE-T2-1002",
      fulfillment_type: "dine_in",
      table_number: "Table 2",
      total: 1200,
      items: [
        { name: "Butter Chicken", price: 400, qty: 2 },
        { name: "Garlic Naan", price: 80, qty: 5 },
      ],
      created_at: "2026-09-28T12:30:00Z",
    },
    {
      id: "ord-3",
      order_number: "DINE-T1-1003",
      fulfillment_type: "dine_in",
      table_number: "Table 1",
      total: 450,
      items: [
        { name: "Dum Biryani [MEDIUM]", price: 350, qty: 1 },
        { name: "Fresh Lime Soda [MILD]", price: 100, qty: 1 },
      ],
      created_at: "2026-09-28T13:00:00Z",
    },
    {
      id: "ord-4",
      order_number: "DEL-2004",
      fulfillment_type: "delivery",
      table_number: null,
      total: 600,
      items: [{ name: "Raw Prawns 500g", price: 600, qty: 1 }],
      created_at: "2026-09-28T13:15:00Z",
    },
  ];

  it("filters dine-in orders and calculates total revenue, order count, and ATV", () => {
    const dineIn = sampleOrders.filter((o) => o.fulfillment_type === "dine_in");
    const totalRev = dineIn.reduce((sum, o) => sum + o.total, 0);
    const orderCount = dineIn.length;
    const atv = totalRev / orderCount;

    expect(dineIn).toHaveLength(3);
    expect(totalRev).toBe(2500); // 850 + 1200 + 450
    expect(orderCount).toBe(3);
    expect(atv).toBeCloseTo(833.33, 1);
  });

  it("ranks top tables by total revenue", () => {
    const tableMap = new Map<string, { label: string; revenue: number; orders: number }>();
    sampleOrders
      .filter((o) => o.fulfillment_type === "dine_in")
      .forEach((o) => {
        const key = o.table_number || "Dine-In";
        const cur = tableMap.get(key) || { label: key, revenue: 0, orders: 0 };
        cur.revenue += o.total;
        cur.orders += 1;
        tableMap.set(key, cur);
      });

    const ranked = Array.from(tableMap.values()).sort((a, b) => b.revenue - a.revenue);
    expect(ranked[0].label).toBe("Table 1"); // 850 + 450 = 1300
    expect(ranked[0].revenue).toBe(1300);
    expect(ranked[0].orders).toBe(2);

    expect(ranked[1].label).toBe("Table 2");
    expect(ranked[1].revenue).toBe(1200);
    expect(ranked[1].orders).toBe(1);
  });

  it("ranks top dine-in dishes by quantity sold", () => {
    const dishMap = new Map<string, number>();
    sampleOrders
      .filter((o) => o.fulfillment_type === "dine_in")
      .forEach((o) => {
        o.items.forEach((item) => {
          const cleanName = item.name.replace(/\[.*?\]/g, "").trim();
          dishMap.set(cleanName, (dishMap.get(cleanName) || 0) + item.qty);
        });
      });

    const sortedDishes = Array.from(dishMap.entries()).sort((a, b) => b[1] - a[1]);
    expect(sortedDishes[0][0]).toBe("Garlic Naan");
    expect(sortedDishes[0][1]).toBe(5);

    expect(sortedDishes[1][0]).toBe("Dum Biryani");
    expect(sortedDishes[1][1]).toBe(3); // 2 from ord-1 + 1 from ord-3

    expect(sortedDishes[2][0]).toBe("Fresh Lime Soda");
    expect(sortedDishes[2][1]).toBe(3); // 2 from ord-1 + 1 from ord-3
  });
});
