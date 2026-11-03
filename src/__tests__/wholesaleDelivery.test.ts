import { describe, it, expect } from "vitest";
import { wholesaleDeliveryCharge } from "@/lib/wholesaleDelivery";

describe("bulk buyer delivery charge", () => {
  it("pickup only charges nothing", () => expect(wholesaleDeliveryCharge("pickup_only", 100, 40)).toBe(0));
  it("free delivery charges nothing", () => expect(wholesaleDeliveryCharge("free", 100, 40)).toBe(0));
  it("charged uses the bulk fee when set", () => expect(wholesaleDeliveryCharge("charged", 150, 40)).toBe(150));
  it("charged with 0 falls back to normal shop fee", () => expect(wholesaleDeliveryCharge("charged", 0, 40)).toBe(40));
});
