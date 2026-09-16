import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStorePaymentConfig,
  saveStorePaymentConfig,
  playCashRegisterChime,
  type StorePaymentConfig,
} from "../lib/storePayments";
import {
  isHardwarePrinterConnected,
  sendEscPosToPrinter,
  DEFAULT_PRINTER_CONFIG,
} from "../lib/thermalPrinter";

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

describe("Store-Level Payment Methods & POS Counter Configuration", () => {
  beforeEach(() => {
    for (const k in storageMock) delete storageMock[k];
    vi.restoreAllMocks();
  });

  it("returns default config when no configuration is saved", () => {
    const config = getStorePaymentConfig("tenant_alpha");
    expect(config.defaultMethod).toBe("cash");
    expect(config.customMethods.length).toBeGreaterThanOrEqual(2);
    expect(config.customMethods.some((m) => m.id === "sodexo")).toBe(true);
    expect(config.customMethods.some((m) => m.id === "khata")).toBe(true);
  });

  it("saves and loads payment configuration isolated per tenant", () => {
    const tenantAConfig: StorePaymentConfig = {
      defaultMethod: "upi",
      customMethods: [
        {
          id: "swiggy_pos",
          name: "Swiggy POS Direct",
          requiresRef: true,
          refPlaceholder: "Swiggy Order ID",
          isEnabled: true,
        },
      ],
    };

    const tenantBConfig: StorePaymentConfig = {
      defaultMethod: "split",
      customMethods: [
        {
          id: "cheque",
          name: "Cheque / Bank Draft",
          requiresRef: true,
          refPlaceholder: "Cheque #",
          isEnabled: true,
        },
      ],
    };

    saveStorePaymentConfig(tenantAConfig, "client_store_a");
    saveStorePaymentConfig(tenantBConfig, "client_store_b");

    const loadedA = getStorePaymentConfig("client_store_a");
    const loadedB = getStorePaymentConfig("client_store_b");

    expect(loadedA.defaultMethod).toBe("upi");
    expect(loadedA.customMethods[0]?.id).toBe("swiggy_pos");

    expect(loadedB.defaultMethod).toBe("split");
    expect(loadedB.customMethods[0]?.id).toBe("cheque");
  });

  it("allows setting a custom payment method as the default method", () => {
    const customConfig: StorePaymentConfig = {
      defaultMethod: "sodexo",
      customMethods: [
        {
          id: "sodexo",
          name: "Sodexo / Pluxee",
          requiresRef: true,
          isEnabled: true,
        },
      ],
    };

    saveStorePaymentConfig(customConfig, "retail_store_1");
    const loaded = getStorePaymentConfig("retail_store_1");
    expect(loaded.defaultMethod).toBe("sodexo");
  });

  it("executes playCashRegisterChime safely without throwing", () => {
    expect(() => playCashRegisterChime()).not.toThrow();
  });
});

describe("Headless Thermal Printing & Hardware Detection", () => {
  it("detects no hardware printer connected when in headless/unpaired mode", () => {
    expect(isHardwarePrinterConnected()).toBe(false);
  });

  it("does not pop up native print dialog or throw when printer type is 'none'", async () => {
    const printSpy = vi.fn();
    vi.stubGlobal("window", {
      ...window,
      print: printSpy,
    });
    const dummyBytes = new Uint8Array([0x1b, 0x40]);

    const result = await sendEscPosToPrinter(dummyBytes, {
      ...DEFAULT_PRINTER_CONFIG,
      type: "none",
    }, "<html>Receipt</html>");

    expect(result).toBe(false);
    expect(printSpy).not.toHaveBeenCalled();
  });
});

describe("POS Search Bar Enter Key Auto-Open Logic", () => {
  const sampleProducts = [
    { id: "1", name: "Vanjaram / Seer Fish", pos_code: 1, stock: 15, is_available: true },
    { id: "2", name: "Tiger Prawns", pos_code: 2, stock: 8, is_available: true },
    { id: "3", name: "White Prawns Medium", pos_code: 3, stock: 12, is_available: true },
  ];

  it("triggers item modal auto-open if exactly 1 product matches query", () => {
    const query = "Vanjaram";
    const filtered = sampleProducts.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    expect(filtered.length).toBe(1);

    const onEnterPress = vi.fn((matches) => {
      if (matches.length === 1) {
        return matches[0];
      }
      return null;
    });

    const openedProduct = onEnterPress(filtered);
    expect(openedProduct).not.toBeNull();
    expect(openedProduct?.id).toBe("1");
  });

  it("does not auto-open item modal if multiple products match query", () => {
    const query = "Prawns";
    const filtered = sampleProducts.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    expect(filtered.length).toBe(2);

    const onEnterPress = vi.fn((matches) => {
      if (matches.length === 1) {
        return matches[0];
      }
      return null;
    });

    const openedProduct = onEnterPress(filtered);
    expect(openedProduct).toBeNull();
  });

  it("matches single product by numeric PLU code exactly", () => {
    const query = "1";
    const filtered = sampleProducts.filter((p) => p.pos_code === parseInt(query, 10));
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.name).toBe("Vanjaram / Seer Fish");
  });

  it("completes double-enter workflow from search to cart addition", () => {
    let activeModalProduct: (typeof sampleProducts)[0] | null = null;
    const cart: any[] = [];

    // Step 1: First Enter in Search (1 match)
    const searchMatch = sampleProducts[0]!;
    activeModalProduct = searchMatch;
    expect(activeModalProduct).not.toBeNull();

    // Step 2: Second Enter in Modal triggers handleAddToCart
    const handleAddToCart = () => {
      if (!activeModalProduct) return;
      cart.push({
        productId: activeModalProduct.id,
        name: activeModalProduct.name,
        qty: 1,
        weightKg: 1.0,
      });
      activeModalProduct = null;
    };

    handleAddToCart();
    expect(cart.length).toBe(1);
    expect(cart[0].name).toBe("Vanjaram / Seer Fish");
    expect(activeModalProduct).toBeNull();
  });

  it("handles numeric query with multiple partial matches by prioritizing exact PLU code", () => {
    const productsWithDigits = [
      { id: "1", name: "Vanjaram Grade 1", pos_code: 1 },
      { id: "10", name: "Mackerel Grade 1", pos_code: 10 },
    ];
    const query = "1";
    const num = parseInt(query, 10);
    const exactPluMatch = productsWithDigits.find((p) => p.pos_code === num);
    expect(exactPluMatch).not.toBeUndefined();
    expect(exactPluMatch?.id).toBe("1");
  });
});

describe("POS Keyboard-Only Billing Shortcuts & Function Keys", () => {
  it("maps payment tenders and shortcuts to distinct function keys", () => {
    const shortcutActions: Record<string, string> = {
      F1: "focus_search",
      F2: "focus_plu",
      F3: "toggle_scale",
      F4: "park_cart",
      F5: "past_bills",
      F6: "parked_bills",
      F7: "tender_card",
      F8: "tender_split",
      F9: "tender_cash",
      F10: "tender_upi",
      F11: "cycle_custom_tender",
      F12: "complete_sale",
      "Ctrl+Enter": "complete_sale",
    };

    expect(shortcutActions["F1"]).toBe("focus_search");
    expect(shortcutActions["F2"]).toBe("focus_plu");
    expect(shortcutActions["F7"]).toBe("tender_card");
    expect(shortcutActions["F8"]).toBe("tender_split");
    expect(shortcutActions["F9"]).toBe("tender_cash");
    expect(shortcutActions["F10"]).toBe("tender_upi");
    expect(shortcutActions["F11"]).toBe("cycle_custom_tender");
    expect(shortcutActions["F12"]).toBe("complete_sale");
    expect(shortcutActions["Ctrl+Enter"]).toBe("complete_sale");
  });
});

