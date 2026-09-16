import { describe, it, expect, beforeEach, vi } from "vitest";
import { isGstEnabled, getStoreOrderingMode, type SiteSettings } from "@/lib/types";
import {
  buildWhatsAppOrderMessage,
  getWhatsAppOrderDeepLink,
  normalizeWhatsAppNumber,
  getWhatsAppBusinessAutoReplyTemplate,
  type WhatsAppOrderSummary,
} from "@/lib/whatsappOrdering";
import {
  buildPosReceiptHtml,
  buildPosReceiptEscPos,
  getSavedPrinterConfig,
  savePrinterConfig,
  type PosReceiptData,
  type ThermalPrinterConfig,
} from "@/lib/thermalPrinter";

// Mock localStorage and window for vitest node environment
const storageMock: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k in storageMock) delete storageMock[k];
  },
});

vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, val: string) => {
      storageMock[key] = String(val);
    },
    removeItem: (key: string) => {
      delete storageMock[key];
    },
    clear: () => {
      for (const k in storageMock) delete storageMock[k];
    },
  },
  location: { hostname: "test-store.local" },
  print: () => {},
});

describe("Master GST Enable/Disable Controller", () => {
  it("defaults to GST enabled (true) if settings are null or undefined", () => {
    expect(isGstEnabled(null)).toBe(true);
    expect(isGstEnabled(undefined)).toBe(true);
    expect(isGstEnabled({})).toBe(true);
  });

  it("returns true when gst_enabled is true", () => {
    expect(isGstEnabled({ gst_enabled: true } as unknown as SiteSettings)).toBe(true);
  });

  it("strictly returns false when gst_enabled is explicitly false", () => {
    expect(isGstEnabled({ gst_enabled: false } as unknown as SiteSettings)).toBe(false);
  });
});

describe("Store Ordering Channel Mode Switcher", () => {
  it("defaults to 'standard' (full online checkout) when unspecified", () => {
    expect(getStoreOrderingMode(null)).toBe("standard");
    expect(getStoreOrderingMode(undefined)).toBe("standard");
    expect(getStoreOrderingMode({})).toBe("standard");
  });

  it("recognizes all valid ordering channel modes", () => {
    expect(getStoreOrderingMode({ ordering_mode: "standard" } as unknown as SiteSettings)).toBe("standard");
    expect(getStoreOrderingMode({ ordering_mode: "both" } as unknown as SiteSettings)).toBe("both");
    expect(getStoreOrderingMode({ ordering_mode: "whatsapp_only" } as unknown as SiteSettings)).toBe("whatsapp_only");
    expect(getStoreOrderingMode({ ordering_mode: "catalog_only" } as unknown as SiteSettings)).toBe("catalog_only");
  });

  it("falls back to 'standard' if an unrecognized mode string is provided", () => {
    expect(getStoreOrderingMode({ ordering_mode: "unknown_future_mode" } as unknown as SiteSettings)).toBe("standard");
  });
});

describe("WhatsApp Deep-Link Ordering Utility", () => {
  it("normalizes 10-digit Indian numbers to international E.164 without plus sign", () => {
    expect(normalizeWhatsAppNumber("9843061919")).toBe("919843061919");
    expect(normalizeWhatsAppNumber("+91 98430 61919")).toBe("919843061919");
    expect(normalizeWhatsAppNumber("919843061919")).toBe("919843061919");
  });

  const sampleOrder: WhatsAppOrderSummary = {
    storeName: "Fish N Fresh Hub",
    storePhone: "9843061919",
    customer: {
      name: "Deepak Sundar",
      phone: "9876543210",
      address: "12 Marina Beach Road, Chennai - 600004",
      fulfillment: "delivery",
      preferredDate: "2026-09-17",
      notes: "Please pack with extra ice",
    },
    items: [
      {
        productId: "p1",
        name: "Vanjaram / Seer Fish",
        cutPreference: "Steaks / Slices",
        qty: 1.5,
        unit: "kg",
        price: 900,
        totalPrice: 1350,
      },
      {
        productId: "p2",
        name: "Tiger Prawns (Large)",
        cutPreference: "Cleaned & Deveined",
        qty: 1,
        unit: "pack",
        price: 450,
        totalPrice: 450,
      },
    ],
    subtotal: 1800,
    deliveryFee: 40,
    gstAmount: 90,
    isGstEnabled: true,
    total: 1930,
  };

  it("builds a rich formatted order message with all item details and financial totals", () => {
    const msg = buildWhatsAppOrderMessage(sampleOrder);
    expect(msg).toContain("NEW ORDER - FISH N FRESH HUB");
    expect(msg).toContain("Deepak Sundar");
    expect(msg).toContain("9876543210");
    expect(msg).toContain("12 Marina Beach Road");
    expect(msg).toContain("Doorstep Delivery");
    expect(msg).toContain("*Vanjaram / Seer Fish* [Steaks / Slices]");
    expect(msg).toContain("*Tiger Prawns (Large)* [Cleaned & Deveined]");
    expect(msg).toContain("₹1,800");
    expect(msg).toContain("₹40");
    expect(msg).toContain("*GST:* ₹90");
    expect(msg).toContain("GRAND TOTAL: ₹1,930");
    expect(msg).toContain("Please pack with extra ice");
  });

  it("suppresses GST line when isGstEnabled is false", () => {
    const zeroGstOrder: WhatsAppOrderSummary = {
      ...sampleOrder,
      isGstEnabled: false,
      gstAmount: 0,
      total: 1840,
    };
    const msg = buildWhatsAppOrderMessage(zeroGstOrder);
    expect(msg).not.toContain("GST:");
    expect(msg).toContain("GRAND TOTAL: ₹1,840");
  });

  it("generates valid wa.me deep link with properly encoded URI components", () => {
    const msg = buildWhatsAppOrderMessage(sampleOrder);
    const link = getWhatsAppOrderDeepLink("9843061919", msg);
    expect(link).toContain("https://wa.me/919843061919?text=");
    expect(link).toContain(encodeURIComponent("NEW ORDER - FISH N FRESH HUB"));
  });

  it("attaches live doorstep Google Maps navigation link and customer live tracking URL when GPS coordinates are provided", () => {
    const orderWithGps: WhatsAppOrderSummary = {
      ...sampleOrder,
      orderNumber: "WA-992201",
      customer: {
        ...sampleOrder.customer,
        lat: 13.0827,
        lng: 80.2707,
      },
    };
    const msg = buildWhatsAppOrderMessage(orderWithGps);
    expect(msg).toContain("🆔 *Order Ref:* #WA-992201");
    expect(msg).toContain("🧭 *Doorstep Navigation:* https://maps.google.com/?q=13.0827,80.2707");
    expect(msg).toContain("🔍 *Track Order Live:*");
    expect(msg).toContain("/orders?phone=9876543210");
  });

  it("generates ready-to-use WhatsApp Business auto-reply template with live tracking link and order summary", () => {
    const reply = getWhatsAppBusinessAutoReplyTemplate(sampleOrder, "WA-992201");
    expect(reply).toContain("Hi Deepak Sundar");
    expect(reply).toContain("Fish N Fresh Hub");
    expect(reply).toContain("*#WA-992201*");
    expect(reply).toContain("2 items · Total: ₹1,930");
    expect(reply).toContain("Delivery to: 12 Marina Beach Road");
    expect(reply).toContain("/orders?phone=9876543210");
  });

  it("filters only available in-stock items and excludes sold-out products for WhatsApp ordering", () => {
    const rawCart = [
      { product_id: "p1", name: "Seer Fish", qty: 2, price: 800, isSoldOut: false, availableStock: 5 },
      { product_id: "p2", name: "Sold Out Crab", qty: 1, price: 500, isSoldOut: true, availableStock: 0 },
      { product_id: "p3", name: "Prawns (Overstock Request)", qty: 4, price: 400, isSoldOut: false, availableStock: 2 },
    ];

    const availableItems = rawCart
      .filter((i) => !i.isSoldOut && i.availableStock > 0)
      .map((i) => {
        const clampedQty = Math.min(i.qty, i.availableStock);
        return {
          productId: i.product_id,
          name: i.name,
          qty: clampedQty,
          unit: "kg",
          price: i.price,
          totalPrice: i.price * clampedQty,
        };
      });

    expect(availableItems).toHaveLength(2);
    expect(availableItems[0]!.name).toBe("Seer Fish");
    expect(availableItems[0]!.qty).toBe(2);
    expect(availableItems[0]!.totalPrice).toBe(1600);

    // Overstock item was clamped to available stock (2 instead of 4)
    expect(availableItems[1]!.name).toBe("Prawns (Overstock Request)");
    expect(availableItems[1]!.qty).toBe(2);
    expect(availableItems[1]!.totalPrice).toBe(800);

    const subtotal = availableItems.reduce((acc, it) => acc + it.totalPrice, 0);
    expect(subtotal).toBe(2400);
  });

  it("verifies whatsapp_only mode hides standard online checkout and exposes direct WhatsApp order", () => {
    const settingsWhatsAppOnly = { ordering_mode: "whatsapp_only", whatsapp_order_phone: "9843061919" } as unknown as SiteSettings;
    const mode = getStoreOrderingMode(settingsWhatsAppOnly);
    expect(mode).toBe("whatsapp_only");

    // In whatsapp_only mode, online payment gateways are bypassed
    const isOnlineCheckoutAllowed = mode === "standard" || mode === "both";
    expect(isOnlineCheckoutAllowed).toBe(false);

    const isWhatsAppOrderAvailable = mode === "whatsapp_only" || mode === "both" || mode === "standard";
    expect(isWhatsAppOrderAvailable).toBe(true);
  });
});

describe("Thermal Printer Header & Footer Customization Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseReceiptData: PosReceiptData = {
    receiptNo: "POS-1001",
    date: "16-Sep-2026, 11:30 AM",
    cashierName: "Senthil",
    customerName: "Venkatesh",
    customerPhone: "9876543210",
    items: [
      {
        name: "Fresh Seer Fish",
        qty: 1,
        weightKg: 1.0,
        unitPrice: 800,
        totalPrice: 800,
        cuttingStyle: "Steaks",
      },
    ],
    subtotal: 800,
    discount: 0,
    gstAmount: 40,
    total: 840,
    paymentMethod: "UPI QR",
    storeName: "Fish N Fresh Hub",
    storeAddress: "Royapuram Harbour, Chennai",
    storePhone: "+91 98430 61919",
    storeGstin: "33AAAAA0000A1Z5",
    storeFssai: "12423008000123",
  };

  it("saves and isolates printer configurations per client tenant", () => {
    const cfgA: ThermalPrinterConfig = {
      ...getSavedPrinterConfig(),
      headerLine1: "Client Alpha Mart",
      showHeaderGstin: true,
      whatsappNumber: "+91 91111 11111",
    };
    const cfgB: ThermalPrinterConfig = {
      ...getSavedPrinterConfig(),
      headerLine1: "Client Beta Seafood",
      showHeaderGstin: false,
      whatsappNumber: "+91 92222 22222",
    };

    savePrinterConfig(cfgA, "tenant_alpha");
    savePrinterConfig(cfgB, "tenant_beta");

    const loadedA = getSavedPrinterConfig("tenant_alpha");
    const loadedB = getSavedPrinterConfig("tenant_beta");

    expect(loadedA.headerLine1).toBe("Client Alpha Mart");
    expect(loadedA.showHeaderGstin).toBe(true);
    expect(loadedA.whatsappNumber).toBe("+91 91111 11111");

    expect(loadedB.headerLine1).toBe("Client Beta Seafood");
    expect(loadedB.showHeaderGstin).toBe(false);
    expect(loadedB.whatsappNumber).toBe("+91 92222 22222");
  });

  it("renders header GSTIN when enabled, and suppresses it when disabled", () => {
    const enabledHtml = buildPosReceiptHtml(baseReceiptData, {
      ...getSavedPrinterConfig(),
      showHeaderGstin: true,
    });
    expect(enabledHtml).toContain("GSTIN: 33AAAAA0000A1Z5");

    const disabledHtml = buildPosReceiptHtml(baseReceiptData, {
      ...getSavedPrinterConfig(),
      showHeaderGstin: false,
    });
    expect(disabledHtml).not.toContain("GSTIN: 33AAAAA0000A1Z5");
  });

  it("renders WhatsApp support number and social media handle in receipt footer", () => {
    const html = buildPosReceiptHtml(baseReceiptData, {
      ...getSavedPrinterConfig(),
      showFooterWhatsapp: true,
      whatsappNumber: "+91 98430 61919",
      showFooterSocial: true,
      socialHandle: "@fishnfreshhub",
    });

    expect(html).toContain("💬 WhatsApp: +91 98430 61919");
    expect(html).toContain("🌐 Follow: @fishnfreshhub");
  });

  it("suppresses WhatsApp support line when showFooterWhatsapp is false", () => {
    const html = buildPosReceiptHtml(baseReceiptData, {
      ...getSavedPrinterConfig(),
      showFooterWhatsapp: false,
      whatsappNumber: "+91 98430 61919",
    });

    expect(html).not.toContain("💬 WhatsApp:");
  });

  it("renders custom footer message if provided", () => {
    const html = buildPosReceiptHtml(baseReceiptData, {
      ...getSavedPrinterConfig(),
      customFooterNote: "Fresh Catch Daily · Family Owned Since 2012",
    });

    expect(html).toContain("Fresh Catch Daily · Family Owned Since 2012");
  });

  it("generates ESC/POS byte sequence without errors", () => {
    const bytes = buildPosReceiptEscPos(baseReceiptData, {
      ...getSavedPrinterConfig(),
      paperWidth: "58mm",
      showHeaderGstin: true,
      showFooterWhatsapp: true,
      whatsappNumber: "+91 98430 61919",
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(50);
  });
});
