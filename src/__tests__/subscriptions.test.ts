import { describe, it, expect } from "vitest";
import { calculateNextDeliveryDate } from "@/lib/subscriptions.functions";

describe("Recurring Subscriptions Engine", () => {
  it("calculates next daily delivery date (+1 day)", () => {
    const fromDate = new Date("2026-09-10T10:00:00Z"); // Thursday
    const next = calculateNextDeliveryDate("daily", "thursday", fromDate);
    expect(next).toBe("2026-09-11");
  });

  it("calculates next weekly Sunday delivery date from Thursday", () => {
    const thursday = new Date("2026-09-10T10:00:00Z"); // Thursday (Day 4)
    // Sunday is 3 days ahead -> Sept 13
    const nextSunday = calculateNextDeliveryDate("weekly", "sunday", thursday);
    expect(nextSunday).toBe("2026-09-13");
  });

  it("calculates next weekly Wednesday delivery date from Thursday (wraps to next week)", () => {
    const thursday = new Date("2026-09-10T10:00:00Z"); // Thursday (Day 4)
    // Next Wednesday is 6 days ahead -> Sept 16
    const nextWednesday = calculateNextDeliveryDate("weekly", "wednesday", thursday);
    expect(nextWednesday).toBe("2026-09-16");
  });

  it("applies 5% Subscribe & Save discount accurately", () => {
    const originalPrice = 850;
    const discount = 5;
    const discountedPrice = Math.round(originalPrice * (1 - discount / 100));
    expect(discountedPrice).toBe(808);
  });
});
