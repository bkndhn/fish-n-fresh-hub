import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDefaultProductLayoutConfig,
  getProductLayoutConfig,
  saveProductLayoutConfig,
  type ProductLayoutConfig,
} from "../lib/productLayout";
import { buildPosReceiptHtml, generatePosWhatsAppText, type PosReceiptData } from "../lib/thermalPrinter";

describe("Product Page Layout & Granular Customization Engine", () => {
  const memoryStore: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, val: string) => {
        memoryStore[key] = String(val);
      },
      removeItem: (key: string) => {
        delete memoryStore[key];
      },
      clear: () => {
        Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
      },
    });
  });

  it("provides food-specific defaults with nutrition, portion chips, and culinary specs enabled", () => {
    const config = getDefaultProductLayoutConfig("seafood", "Fish N Fresh");
    expect(config.showNutrition).toBe(true);
    expect(config.showCulinarySpecs).toBe(true);
    expect(config.showPortionChips).toBe(true);
    expect(config.showSubscriptions).toBe(true);
    expect(config.specsTitle).toContain("Culinary & Sourcing");
    expect(config.nutritionTitle).toContain("Nutritional Highlights");
    expect(config.subscriptionTitle).toBe("Subscribe & Save 5%");
  });

  it("disables food nutrition facts and portion chips for apparel and footwear verticals", () => {
    const config = getDefaultProductLayoutConfig("clothing_fashion", "Urban Footwear & Apparel");
    expect(config.showNutrition).toBe(false);
    expect(config.showPortionChips).toBe(false);
    expect(config.showSubscriptions).toBe(false);
    expect(config.specsTitle).toContain("Materials, Fit & Care");
    expect(config.subscriptionTitle).toContain("VIP Club");
  });

  it("disables food nutrition facts and adapts titles for electronics & hardware verticals", () => {
    const config = getDefaultProductLayoutConfig("electronics_appliances", "Tech Hub Electronics");
    expect(config.showNutrition).toBe(false);
    expect(config.showPortionChips).toBe(false);
    expect(config.specsTitle).toContain("Technical Specifications & Box Contents");
    expect(config.subscriptionTitle).toContain("Extended Care");
  });

  it("persists custom layout overrides and restores them per tenant", () => {
    const customConfig: ProductLayoutConfig = {
      showNutrition: false,
      showCulinarySpecs: true,
      showPortionChips: false,
      showSubscriptions: true,
      showAiBenefits: true,
      showReviews: true,
      showRelatedProducts: false,
      specsTitle: "Custom Specifications Title",
      specsSubtitle: "Custom Subtitle",
      nutritionTitle: "Nutrition Specs",
      subscriptionTitle: "Monthly Delivery Plan",
      subscriptionSubtitle: "Priority dispatch",
      reviewsTitle: "Buyer Feedback",
      relatedTitle: "Customers Also Bought",
    };

    saveProductLayoutConfig(customConfig, "tenant-test-123");
    const loaded = getProductLayoutConfig("tenant-test-123", "Any Store", "seafood");

    expect(loaded.showNutrition).toBe(false);
    expect(loaded.specsTitle).toBe("Custom Specifications Title");
    expect(loaded.showRelatedProducts).toBe(false);
    expect(loaded.subscriptionTitle).toBe("Monthly Delivery Plan");
  });
});

describe("POS Counter Dual-Mode Discount (Amount & Percentage)", () => {
  const baseReceiptData: PosReceiptData = {
    receiptNo: "POS-20260916-0001",
    date: "16 Sep 2026, 03:30 PM",
    cashierName: "Ramesh Cashier",
    customerName: "Walk-in Customer",
    items: [
      {
        name: "Fresh Vanjaram Fish",
        qty: 2,
        unit: "kg",
        unitPrice: 500,
        totalPrice: 1000,
      },
    ],
    subtotal: 1000,
    discount: 100,
    discountPercent: 10,
    gstAmount: 50,
    total: 950,
    paymentMethod: "Cash",
  };

  it("formats ESC/POS and HTML receipt with discount percentage when present", () => {
    const html = buildPosReceiptHtml(baseReceiptData);
    expect(html).toContain("Discount (10%):");
    expect(html).toContain("-₹100");
  });

  it("formats WhatsApp receipt text with discount percentage when present", () => {
    const text = generatePosWhatsAppText(baseReceiptData);
    expect(text).toContain("Discount (10%): -₹100");
  });

  it("formats flat rupee discount when discountPercent is omitted", () => {
    const flatData: PosReceiptData = {
      ...baseReceiptData,
      discount: 50,
      discountPercent: undefined,
      total: 1000,
    };
    const html = buildPosReceiptHtml(flatData);
    expect(html).toContain("Discount:");
    expect(html).toContain("-₹50");
    expect(html).not.toContain("Discount (");

    const text = generatePosWhatsAppText(flatData);
    expect(text).toContain("Discount: -₹50");
  });
});
