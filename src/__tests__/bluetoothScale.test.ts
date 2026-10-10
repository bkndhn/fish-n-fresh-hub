import { describe, it, expect } from "vitest";
import { parseBleWeightMeasurement, weighingScaleDriver } from "@/lib/weighingScale";

function packet(flags: number, raw: number) {
  const v = new DataView(new ArrayBuffer(3));
  v.setUint8(0, flags);
  v.setUint16(1, raw, true);
  return v;
}

describe("Bluetooth scale", () => {
  it("standard Bluetooth weight packet in kg: 290 units = 1.45 kg", () => {
    expect(parseBleWeightMeasurement(packet(0, 290))).toBe(1.45);
  });
  it("pound scale converts to kg: 100 units (1 lb) = 0.454 kg", () => {
    expect(parseBleWeightMeasurement(packet(1, 100))).toBe(0.454);
  });
  it("failed reading is ignored", () => {
    expect(parseBleWeightMeasurement(packet(0, 0xffff))).toBeNull();
  });
  it("Bluetooth serial text line fills the same weight as a wired scale", () => {
    weighingScaleDriver.feedRawLine("ST,GS,+02.350kg");
    expect(weighingScaleDriver.getLastReading().weightKg).toBe(2.35);
  });
  it("weighed fish line total = weight × price per kg (1.45 kg × ₹800 = ₹1160)", () => {
    weighingScaleDriver.feedRawLine("ST,GS,+01.450kg");
    expect(Math.round(weighingScaleDriver.getLastReading().weightKg * 800)).toBe(1160);
  });
});
