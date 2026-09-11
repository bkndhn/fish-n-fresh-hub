import { describe, it, expect } from "vitest";
import { parseGoogleMapsUrl, calculateDistanceKm, estimateBikeMinutes } from "@/lib/maps";
import { optimizeImageUrl } from "@/lib/imageOptimizer";
import {
  buildKotTokenHtml,
  buildA4InvoiceHtml,
  buildA5SlipHtml,
  buildTestPrintForFormat,
  DEFAULT_PRINTER_CONFIG,
  type PosReceiptData,
} from "@/lib/thermalPrinter";

describe("Google Maps Smart Coordinate Parsing", () => {
  it("parses plain decimal coordinates", () => {
    const res = parseGoogleMapsUrl("13.0827, 80.2707");
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(13.0827, 4);
    expect(res?.lng).toBeCloseTo(80.2707, 4);
  });

  it("parses Google Maps standard @lat,lng URLs", () => {
    const res = parseGoogleMapsUrl("https://www.google.com/maps/@13.082712,80.270745,17z");
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(13.0827, 3);
    expect(res?.lng).toBeCloseTo(80.2707, 3);
  });

  it("parses Google Maps search q= query URLs", () => {
    const res = parseGoogleMapsUrl("https://maps.google.com/?q=13.0827,80.2707");
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(13.0827, 4);
    expect(res?.lng).toBeCloseTo(80.2707, 4);
  });

  it("parses Google Maps embed !3d!4d format", () => {
    const res = parseGoogleMapsUrl("https://maps.google.com/place/foo/!3d13.082712!4d80.270734");
    expect(res).not.toBeNull();
    expect(res?.lat).toBeCloseTo(13.0827, 3);
    expect(res?.lng).toBeCloseTo(80.2707, 3);
  });

  it("returns null for invalid inputs", () => {
    expect(parseGoogleMapsUrl("")).toBeNull();
    expect(parseGoogleMapsUrl("hello world")).toBeNull();
  });

  it("calculates haversine distance and bike minutes accurately", () => {
    const dist = calculateDistanceKm(13.0827, 80.2707, 13.0927, 80.2807);
    expect(dist).toBeGreaterThan(1);
    expect(dist).toBeLessThan(3);
    const mins = estimateBikeMinutes(dist);
    expect(mins).toBeGreaterThanOrEqual(15);
  });
});

describe("Image CDN WebP & Size Optimization", () => {
  it("optimizes Unsplash URLs to lightweight WebP with width & quality bounds", () => {
    const raw = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=1200";
    const optimized = optimizeImageUrl(raw, { width: 500, quality: 75 });
    expect(optimized).toContain("fm=webp");
    expect(optimized).toContain("w=500");
    expect(optimized).toContain("q=75");
    expect(optimized).toContain("auto=format");
  });

  it("handles blank or null URLs gracefully", () => {
    expect(optimizeImageUrl("")).toBe("");
    expect(optimizeImageUrl(null)).toBe("");
    expect(optimizeImageUrl(undefined)).toBe("");
  });
});

describe("Universal Printing & Format Engines", () => {
  const mockReceipt: PosReceiptData = {
    receiptNo: "FNF-TEST-101",
    date: "11/09/2026, 11:30 AM",
    cashierName: "Murugan",
    customerName: "Ramesh Kumar",
    customerPhone: "9843061919",
    items: [
      {
        name: "Vanjaram / Seer Fish",
        qty: 1,
        weightKg: 1.25,
        unitPrice: 950,
        totalPrice: 1187.5,
        cuttingStyle: "curry_cut",
        unit: "kg",
      },
      {
        name: "Tiger Prawns",
        qty: 1,
        weightKg: 0.5,
        unitPrice: 650,
        totalPrice: 325,
        cuttingStyle: "peeled_deveined",
        unit: "kg",
      },
    ],
    subtotal: 1512.5,
    discount: 0,
    gstAmount: 0,
    total: 1512.5,
    paymentMethod: "UPI",
    storeName: "Fish N Fresh Hub",
    storeAddress: "Kasimedu Harbour Road, Chennai",
    storePhone: "9843061919",
  };

  it("renders KOT Cutting Token HTML with station details", () => {
    const html = buildKotTokenHtml(mockReceipt, DEFAULT_PRINTER_CONFIG);
    expect(html).toContain("CUTTING TOKEN");
    expect(html).toContain("Vanjaram / Seer Fish");
    expect(html).toContain("CURRY_CUT");
    expect(html).toContain("INSULATED ICE BOX");
  });

  it("renders Statutory Section 31 CGST A4 Tax Invoice HTML", () => {
    const html = buildA4InvoiceHtml(mockReceipt, DEFAULT_PRINTER_CONFIG);
    expect(html).toContain("TAX INVOICE");
    expect(html).toContain("CGST Act 2017");
    expect(html).toContain("Vanjaram / Seer Fish");
    expect(html).toContain("FNF-TEST-101");
  });

  it("renders A5 Dispatch Packing Slip HTML", () => {
    const html = buildA5SlipHtml(mockReceipt, DEFAULT_PRINTER_CONFIG);
    expect(html).toContain("DISPATCH SLIP");
    expect(html).toContain("Ramesh Kumar");
    expect(html).toContain("FNF-TEST-101");
  });

  it("builds test print for all 5 formats without errors", () => {
    const formats = ["58mm", "80mm", "kot", "a4", "a5"] as const;
    formats.forEach((fmt) => {
      const artifact = buildTestPrintForFormat(fmt, DEFAULT_PRINTER_CONFIG);
      expect(artifact).toBeDefined();
      expect(artifact.html).toBeTruthy();
      if (fmt === "58mm" || fmt === "80mm" || fmt === "kot") {
        expect(artifact.bytes).toBeDefined();
        expect(artifact.bytes?.length).toBeGreaterThan(10);
      }
    });
  });
});
