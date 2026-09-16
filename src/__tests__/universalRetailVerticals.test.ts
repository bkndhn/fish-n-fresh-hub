import { describe, it, expect } from "vitest";
import {
  BUSINESS_VERTICALS,
  getVerticalCapabilities,
  getVerticalPreset,
  getVerticalFormFields,
  getVerticalSearchPlaceholder,
  type BusinessVertical,
} from "@/lib/verticals";
import {
  generateSampleCsv,
  parseProductsCsv,
  exportProductsToCsv,
  CSV_HEADERS,
} from "@/lib/retailCsv";
import {
  buildPosReceiptHtml,
  generatePosWhatsAppText,
  type PosReceiptData,
} from "@/lib/thermalPrinter";
import type { Product, CartItem } from "@/lib/types";

describe("Universal Business Verticals & Capabilities", () => {
  it("includes all 10 supported retail models and excludes restaurant/hotel models", () => {
    const verticalIds = BUSINESS_VERTICALS.map((v) => v.id);

    // Expected retail verticals
    expect(verticalIds).toContain("electronics_appliances");
    expect(verticalIds).toContain("clothing_fashion");
    expect(verticalIds).toContain("footwear");
    expect(verticalIds).toContain("grocery_supermarket");
    expect(verticalIds).toContain("snacks_sweets");
    expect(verticalIds).toContain("departmental_store");
    expect(verticalIds).toContain("universal");
    expect(verticalIds).toContain("seafood");
    expect(verticalIds).toContain("chicken_meat");
    expect(verticalIds).toContain("all_meat");

    // Strictly verify exclusion of restaurant, hotel, cloud kitchen
    expect(verticalIds).not.toContain("restaurant");
    expect(verticalIds).not.toContain("hotel");
    expect(verticalIds).not.toContain("cloud_kitchen");
    expect(verticalIds).not.toContain("bar");
    expect(verticalIds.length).toBe(10);
  });

  it("assigns electronics-specific capabilities correctly", () => {
    const caps = getVerticalCapabilities("electronics_appliances");
    expect(caps.hasImeiSerialTracking).toBe(true);
    expect(caps.hasWarrantyManagement).toBe(true);
    expect(caps.hasTechnicalSpecs).toBe(true);
    expect(caps.hasWeighingScale).toBe(false);
    expect(caps.hasCutPreferences).toBe(false);
    expect(caps.hasSizeChart).toBe(false);
  });

  it("assigns fashion and clothing capabilities correctly", () => {
    const caps = getVerticalCapabilities("clothing_fashion");
    expect(caps.hasSizeColorVariants).toBe(true);
    expect(caps.hasSizeChart).toBe(true);
    expect(caps.hasImeiSerialTracking).toBe(false);
    expect(caps.hasWeighingScale).toBe(false);
    expect(caps.hasCutPreferences).toBe(false);
  });

  it("assigns footwear capabilities correctly", () => {
    const caps = getVerticalCapabilities("footwear");
    expect(caps.hasSizeColorVariants).toBe(true);
    expect(caps.hasSizeChart).toBe(true);
    expect(caps.hasImeiSerialTracking).toBe(false);
    expect(caps.hasWeighingScale).toBe(false);
    expect(caps.hasCutPreferences).toBe(false);
  });

  it("assigns snacks and sweets capabilities correctly", () => {
    const caps = getVerticalCapabilities("snacks_sweets");
    expect(caps.hasAisleRackLocation).toBe(true);
    expect(caps.hasWeighingScale).toBe(true);
    expect(caps.hasCutPreferences).toBe(false);
    expect(caps.hasImeiSerialTracking).toBe(false);
  });

  it("assigns grocery and supermarket capabilities correctly", () => {
    const caps = getVerticalCapabilities("grocery_supermarket");
    expect(caps.hasAisleRackLocation).toBe(true);
    expect(caps.hasWeighingScale).toBe(true);
    expect(caps.hasSizeChart).toBe(false);
    expect(caps.hasImeiSerialTracking).toBe(false);
  });

  it("assigns seafood and meat capabilities correctly", () => {
    const caps = getVerticalCapabilities("seafood");
    expect(caps.hasCutPreferences).toBe(true);
    expect(caps.hasWeighingScale).toBe(true);
    expect(caps.hasImeiSerialTracking).toBe(false);
    expect(caps.hasTechnicalSpecs).toBe(false);
  });

  it("provides rich vertical presets with default categories and mottos", () => {
    const electPreset = getVerticalPreset("electronics_appliances");
    expect(electPreset.defaultCategories).toContain("Smartphones & Tablets");
    expect(electPreset.defaultCategories).toContain("Smart TVs & Home Theatre");

    const fashionPreset = getVerticalPreset("clothing_fashion");
    expect(fashionPreset.defaultCategories).toContain("Men's Casual & Formal");
    expect(fashionPreset.defaultCategories).toContain("Women's Ethnic & Western");

    const groceryPreset = getVerticalPreset("grocery_supermarket");
    expect(groceryPreset.defaultCategories).toContain("Atta, Rice & Whole Grains");
    expect(groceryPreset.defaultCategories).toContain("Dals, Pulses & Dry Fruits");

    const snacksPreset = getVerticalPreset("snacks_sweets");
    expect(snacksPreset.defaultCategories).toContain("₹10 & ₹20 Snack Packs");
    expect(snacksPreset.defaultCategories).toContain("Chips & Crisps");

    const footwearPreset = getVerticalPreset("footwear");
    expect(footwearPreset.defaultCategories).toContain("Sports Shoes & Sneakers");
    expect(footwearPreset.defaultCategories).toContain("Sandals & Floaters");
  });
});

describe("Bulk Retail CSV Import and Export Engine", () => {
  it("generates valid industry templates with complete CSV headers", () => {
    const electCsv = generateSampleCsv("electronics_appliances");
    const fashionCsv = generateSampleCsv("clothing_fashion");
    const groceryCsv = generateSampleCsv("grocery_supermarket");

    expect(electCsv).toContain("name,category,cost_price,price");
    expect(electCsv).toContain("Apple iPhone 15");
    expect(electCsv).toContain("Smartphones & Tablets");

    expect(fashionCsv).toContain("Oxford Shirt");
    expect(fashionCsv).toContain("Allen Solly");

    expect(groceryCsv).toContain("Aashirvaad Shudh Chakki Atta");
    expect(groceryCsv).toContain("Aisle 1, Pallet 3");
  });

  it("parses electronics CSV rows with IMEI serial tracking, specs, and warranty", () => {
    const sampleCsv = generateSampleCsv("electronics_appliances");
    const result = parseProductsCsv(sampleCsv);

    expect(result.errors).toHaveLength(0);
    expect(result.validProducts.length).toBeGreaterThanOrEqual(4);

    const iphone = result.validProducts.find((p) => p.name?.includes("iPhone"));
    expect(iphone).toBeDefined();
    expect(iphone?.brand).toBe("Apple");
    expect(iphone?.model_number).toBe("A3090");
    expect(iphone?.warranty_period_months).toBe(12);
    expect(iphone?.requires_serial).toBe(true);
    expect(iphone?.price).toBe(79900);
    expect(iphone?.specifications).toBeDefined();
    expect(iphone?.specifications?.["Storage"]).toBe("128GB");
  });

  it("parses grocery CSV rows with aisle picking location and pack units", () => {
    const sampleCsv = generateSampleCsv("grocery_supermarket");
    const result = parseProductsCsv(sampleCsv);

    expect(result.errors).toHaveLength(0);
    const atta = result.validProducts.find((p) => p.name?.includes("Atta"));
    expect(atta).toBeDefined();
    expect(atta?.brand).toBe("Aashirvaad");
    expect(atta?.unit).toBe("pack");
    expect(atta?.aisle_location).toContain("Aisle 1");
    expect(atta?.requires_serial).toBe(false);
  });

  it("handles malformed CSV rows and generates clear descriptive error messages", () => {
    const invalidCsv = [
      "name,price,category",
      "Valid Item,150,General",
      ",200,General", // missing name
      "Bad Price,invalid_price,General", // invalid price
      "Zero Price,0,General", // 0 price
    ].join("\n");

    const result = parseProductsCsv(invalidCsv);
    expect(result.validProducts).toHaveLength(1);
    expect(result.validProducts[0]!.name).toBe("Valid Item");
    expect(result.errors.length).toBe(3);
    expect(result.errors[0]).toContain("Missing product name");
    expect(result.errors[1]).toContain("Invalid price 'invalid_price'");
    expect(result.errors[2]).toContain("Invalid price '0'");
  });

  it("exports catalog products to CSV preserving retail attributes", () => {
    const mockProducts: any[] = [
      {
        id: "prod-1",
        name: "Samsung Galaxy S24",
        category: "Smartphones",
        price: 74999,
        old_price: 79999,
        unit: "pc",
        stock: 20,
        brand: "Samsung",
        model_number: "SM-S921B",
        warranty_period_months: 24,
        requires_serial: true,
        aisle_location: "Aisle 1, Rack S-1",
        specifications: { RAM: "8GB", ROM: "256GB" },
        pos_code: 105,
        description: "Flagship Galaxy AI phone",
      },
    ];

    const csvOutput = exportProductsToCsv(mockProducts);
    expect(csvOutput).toContain("Samsung Galaxy S24");
    expect(csvOutput).toContain("Samsung");
    expect(csvOutput).toContain("SM-S921B");
    expect(csvOutput).toContain("24");
    expect(csvOutput).toContain("true");
    expect(csvOutput).toContain("Aisle 1, Rack S-1");
  });
});

describe("Thermal Receipt & WhatsApp Engine for Retail", () => {
  const mockReceiptData: PosReceiptData = {
    storeName: "Super Retail & Electronics",
    receiptNo: "INV-2026-0099",
    date: "11/09/2026",
    cashierName: "Dhanush (Manager)",
    customerName: "Ramesh Kumar",
    customerPhone: "+91 98888 11111",
    items: [
      {
        name: "Apple iPhone 15 128GB",
        qty: 1,
        unit: "pc",
        unitPrice: 79900,
        totalPrice: 79900,
        brand: "Apple",
        serialNumbers: ["IMEI354890123456789"],
        warrantyMonths: 12,
        aisleLocation: "Aisle 1, Shelf A-1",
      },
      {
        name: "Men Slim Fit Cotton Shirt",
        qty: 2,
        unit: "pc",
        unitPrice: 1299,
        totalPrice: 2598,
        brand: "Allen Solly",
        variant: "L / Navy Blue",
      },
    ],
    subtotal: 82498,
    discount: 0,
    gstAmount: 0,
    total: 82498,
    paymentMethod: "UPI / QR",
  };

  it("renders serial numbers, warranty, and variant details in thermal receipt HTML", () => {
    const html = buildPosReceiptHtml(mockReceiptData);

    expect(html).toContain("Super Retail & Electronics");
    expect(html).toContain("INV-2026-0099");
    expect(html).toContain("Apple iPhone 15 128GB");
    expect(html).toContain("IMEI354890123456789");
    expect(html).toContain("12M Official");
    expect(html).toContain("Variant: L / Navy Blue");
  });

  it("includes serial numbers and warranty in POS WhatsApp text", () => {
    const waText = generatePosWhatsAppText(mockReceiptData);

    expect(waText).toContain("INV-2026-0099");
    expect(waText).toContain("Apple iPhone 15 128GB");
    expect(waText).toContain("IMEI354890123456789");
    expect(waText).toContain("12M Brand Cover");
    expect(waText).toContain("L / Navy Blue");
  });
});

describe("Universal Retail Form Fields Engine (getVerticalFormFields)", () => {
  it("adapts form fields and placeholders for snacks and sweets vertical", () => {
    const fields = getVerticalFormFields("snacks_sweets", "Murukku & Chips Haven");
    expect(fields.namePlaceholder).toContain("Potato Chips (₹20)");
    expect(fields.namePlaceholder).toContain("Ribbon Murukku (₹30)");
    expect(fields.units).toContain("pkt");
    expect(fields.units).toContain("box");
    expect(fields.wasteReasonPlaceholder).toContain("Crushed packet");
    expect(fields.reviewPlaceholder).toContain("crunchiness");
    expect(fields.customRequestPlaceholder).toContain("₹20 Ribbon Murukku");
  });

  it("adapts form fields and placeholders for footwear vertical", () => {
    const fields = getVerticalFormFields("footwear", "WalkWell Footwear Hub");
    expect(fields.namePlaceholder).toContain("Running Shoes");
    expect(fields.units).toContain("pair");
    expect(fields.units).toContain("box");
    expect(fields.skuPlaceholder).toContain("FTW");
    expect(fields.specsPlaceholder).toContain("UK");
    expect(fields.wasteReasonPlaceholder).toContain("Damaged sole box");
    expect(fields.reviewPlaceholder).toContain("fit");
    expect(fields.customRequestPlaceholder).toContain("UK 10");
  });

  it("adapts form fields and placeholders for electronics vertical", () => {
    const fields = getVerticalFormFields("electronics_appliances", "Apex Electronics");
    expect(fields.namePlaceholder).toContain("Apple iPhone 15");
    expect(fields.units).toContain("unit");
    expect(fields.units).toContain("piece");
    expect(fields.skuPlaceholder).toContain("A3090");
    expect(fields.specsPlaceholder).toContain("RAM");
    expect(fields.wasteReasonPlaceholder).toContain("dead on arrival");
    expect(fields.customRequestPlaceholder).toContain("OLED TV");
  });

  it("adapts form fields and placeholders for clothing and fashion vertical", () => {
    const fields = getVerticalFormFields("clothing_fashion", "Urban Trends Fashion");
    expect(fields.namePlaceholder).toContain("Oxford Shirt");
    expect(fields.units).toContain("piece");
    expect(fields.units).toContain("set");
    expect(fields.skuPlaceholder).toContain("SHT");
    expect(fields.specsPlaceholder).toContain("Fabric");
    expect(fields.wasteReasonPlaceholder).toContain("loose stitching");
  });

  it("adapts form fields and placeholders for grocery vertical", () => {
    const fields = getVerticalFormFields("grocery_supermarket", "FreshMart Grocery");
    expect(fields.namePlaceholder).toContain("Raw Rice");
    expect(fields.units).toContain("kg");
    expect(fields.units).toContain("liter");
    expect(fields.wasteReasonPlaceholder).toContain("broken packaging");
  });

  it("adapts form fields and placeholders for poultry & meat vertical", () => {
    const fields = getVerticalFormFields("chicken_meat", "Al-Barakah Halal Farm Fresh");
    expect(fields.namePlaceholder).toContain("Chicken Curry Cut");
    expect(fields.specsPlaceholder).toContain("Halal");
    expect(fields.wasteReasonPlaceholder).toContain("Trimming wastage");
    expect(fields.reviewPlaceholder).toContain("tenderness");
  });

  it("adapts form fields and placeholders for seafood vertical", () => {
    const fields = getVerticalFormFields("seafood", "Fish N Fresh Seafoods");
    expect(fields.namePlaceholder).toContain("Vanjaram");
    expect(fields.specsPlaceholder).toContain("Wild Sea Catch");
    expect(fields.wasteReasonPlaceholder).toContain("Head & gutting");
    expect(fields.reviewPlaceholder).toContain("ocean freshness");
  });

  it("generates vertical-aware search placeholders with fallback and custom store name", () => {
    const snackSearch = getVerticalSearchPlaceholder("snacks_sweets", "Hot Chips Express");
    expect(snackSearch).toContain("potato chips");
    expect(snackSearch).toContain("₹20/₹30");

    const footwearSearch = getVerticalSearchPlaceholder("footwear", "StepUp Studio");
    expect(footwearSearch).toContain("sports sneakers");
    expect(footwearSearch).toContain("Size 6-11");

    const electSearch = getVerticalSearchPlaceholder("electronics_appliances", "TechWorld");
    expect(electSearch).toContain("smartphones");

    const seafoodSearch = getVerticalSearchPlaceholder("seafood", "Fish N Fresh");
    expect(seafoodSearch).toContain("fresh fish");
  });
});
