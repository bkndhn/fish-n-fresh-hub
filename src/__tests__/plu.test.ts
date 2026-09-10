import { describe, it, expect } from "vitest";
import { parseBarcode } from "@/lib/barcodeScanner";

describe("Barcode Scanner & PLU Decoder Engine", () => {
  it("decodes electronic supermarket scale barcodes (Prefix 20)", () => {
    // 20 [PLU: 0001] [Weight: 01500 grams = 1.500 kg] [Check: 4]
    const barcode = "200001015004";
    const parsed = parseBarcode(barcode);

    expect(parsed.type).toBe("scale_weight");
    expect(parsed.productIdOrCode).toBe("1");
    expect(parsed.embeddedWeightKg).toBe(1.5);
  });

  it("decodes scale barcodes with 350 grams (0.35 kg)", () => {
    // 20 [PLU: 0004] [Weight: 00350 grams = 0.350 kg] [Check: 0]
    const barcode = "200004003500";
    const parsed = parseBarcode(barcode);

    expect(parsed.type).toBe("scale_weight");
    expect(parsed.productIdOrCode).toBe("4");
    expect(parsed.embeddedWeightKg).toBe(0.35);
  });

  it("decodes custom FNF- prefix barcodes", () => {
    const parsed = parseBarcode("FNF-02");
    expect(parsed.type).toBe("plu_code");
    expect(parsed.productIdOrCode).toBe("02");
  });

  it("decodes pure numeric cashier PLU keystrokes", () => {
    const parsed = parseBarcode("05");
    expect(parsed.type).toBe("plu_code");
    expect(parsed.productIdOrCode).toBe("5");
  });

  it("passes standard alphanumeric SKU or EAN-13 barcodes", () => {
    const parsed = parseBarcode("8901030882192");
    expect(parsed.type).toBe("standard_sku");
    expect(parsed.productIdOrCode).toBe("8901030882192");
  });
});
