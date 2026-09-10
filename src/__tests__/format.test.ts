import { describe, it, expect } from "vitest";
import { formatINR, formatStockDisplay, formatStockBadge } from "@/lib/format";

describe("Format Utilities", () => {
  it("formats Indian Rupee amounts accurately", () => {
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(450)).toBe("₹450");
    expect(formatINR(1250)).toBe("₹1,250");
    expect(formatINR(100000)).toBe("₹1,00,000");
  });

  it("handles null or undefined amounts gracefully", () => {
    expect(formatINR(null as any)).toBe("₹0");
    expect(formatINR(undefined as any)).toBe("₹0");
  });

  it("formats stock display properly for kg and pcs", () => {
    expect(formatStockDisplay(10.5, "kg")).toBe("10.5 kg");
    expect(formatStockDisplay(25, "pcs")).toBe("25 pcs");
    expect(formatStockDisplay(0, "kg")).toBe("0 kg");
  });

  it("assigns appropriate stock badge abbreviations", () => {
    expect(formatStockBadge(0, "kg")).toBe("0 kg");
    expect(formatStockBadge(3, "250g")).toBe("3 pkts (250g)");
    expect(formatStockBadge(8, "pcs")).toBe("8 pcs");
    expect(formatStockBadge(25, "dozen")).toBe("25 doz");
  });
});
