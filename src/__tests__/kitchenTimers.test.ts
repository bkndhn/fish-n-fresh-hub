import { describe, it, expect } from "vitest";
import { ticketTier, ticketAgeMinutes, BUMP_NEXT, stationOf } from "@/lib/kitchenTimers";

describe("kitchen timers", () => {
  it("under 10 minutes is fresh (green)", () => expect(ticketTier(9)).toBe("fresh"));
  it("10 to 20 minutes is active (amber)", () => {
    expect(ticketTier(10)).toBe("active");
    expect(ticketTier(20)).toBe("active");
  });
  it("over 20 minutes is urgent (red)", () => expect(ticketTier(21)).toBe("urgent"));
  it("computes age in whole minutes", () => {
    const now = Date.parse("2026-10-08T12:15:30Z");
    expect(ticketAgeMinutes("2026-10-08T12:00:00Z", now)).toBe(15);
  });
  it("bump moves pending → prep → ready → handed over", () => {
    expect(BUMP_NEXT.pending).toBe("confirmed");
    expect(BUMP_NEXT.confirmed).toBe("packed");
    expect(BUMP_NEXT.packed).toBe("delivered");
  });
  it("table orders go to the dine-in station", () => {
    expect(stationOf({ fulfillment_type: "pickup", table_number: "4" })).toBe("dine_in");
    expect(stationOf({ fulfillment_type: "delivery" })).toBe("delivery");
    expect(stationOf({ fulfillment_type: "pos" })).toBe("counter");
  });
});
