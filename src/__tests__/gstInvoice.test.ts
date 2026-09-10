import { describe, it, expect } from "vitest";

function calculateGstSplit(taxableAmount: number, gstRatePercent: number) {
  const halfRate = gstRatePercent / 2;
  const cgst = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
  const sgst = Math.round(((taxableAmount * halfRate) / 100) * 100) / 100;
  return {
    cgstRate: halfRate,
    sgstRate: halfRate,
    cgstAmount: cgst,
    sgstAmount: sgst,
    totalTax: cgst + sgst,
  };
}

describe("GST Tax Invoice Engine", () => {
  it("computes intra-state CGST (2.5%) and SGST (2.5%) for 5% seafood tax rate", () => {
    const split = calculateGstSplit(1000, 5);
    expect(split.cgstRate).toBe(2.5);
    expect(split.sgstRate).toBe(2.5);
    expect(split.cgstAmount).toBe(25);
    expect(split.sgstAmount).toBe(25);
    expect(split.totalTax).toBe(50);
  });

  it("handles decimal amounts with Indian Paisa rounding", () => {
    const split = calculateGstSplit(450.5, 5);
    expect(split.cgstAmount).toBe(11.26);
    expect(split.sgstAmount).toBe(11.26);
    expect(split.totalTax).toBe(22.52);
  });

  it("handles 0% exempted fresh chilled seafood", () => {
    const split = calculateGstSplit(850, 0);
    expect(split.cgstAmount).toBe(0);
    expect(split.sgstAmount).toBe(0);
    expect(split.totalTax).toBe(0);
  });
});
