import { describe, it, expect } from "vitest";

function evaluateBatchShelfLife(catchDateIso: string, shelfLifeHours: number, now = new Date()) {
  const catchTime = new Date(catchDateIso).getTime();
  const expiryTime = catchTime + shelfLifeHours * 3600 * 1000;
  const hoursLeft = (expiryTime - now.getTime()) / (3600 * 1000);

  return {
    expiryDate: new Date(expiryTime).toISOString(),
    hoursRemaining: Math.round(hoursLeft * 10) / 10,
    isExpired: hoursLeft <= 0,
    isExpiringSoon: hoursLeft > 0 && hoursLeft <= 24,
    status: hoursLeft <= 0 ? "expired" : hoursLeft <= 24 ? "expiring_soon" : "fresh",
  };
}

describe("Inventory Batch & Food Safety Traceability", () => {
  it("calculates fresh status for catch landed 12 hours ago with 72h shelf life", () => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();

    const evaluation = evaluateBatchShelfLife(twelveHoursAgo, 72, now);
    expect(evaluation.isExpired).toBe(false);
    expect(evaluation.isExpiringSoon).toBe(false);
    expect(evaluation.status).toBe("fresh");
    expect(evaluation.hoursRemaining).toBe(60);
  });

  it("identifies catch expiring soon (<24 hours left)", () => {
    const now = new Date();
    const fiftyHoursAgo = new Date(now.getTime() - 50 * 3600 * 1000).toISOString();

    const evaluation = evaluateBatchShelfLife(fiftyHoursAgo, 72, now);
    expect(evaluation.isExpired).toBe(false);
    expect(evaluation.isExpiringSoon).toBe(true);
    expect(evaluation.status).toBe("expiring_soon");
    expect(evaluation.hoursRemaining).toBe(22);
  });

  it("detects expired perishable catch", () => {
    const now = new Date();
    const eightyHoursAgo = new Date(now.getTime() - 80 * 3600 * 1000).toISOString();

    const evaluation = evaluateBatchShelfLife(eightyHoursAgo, 72, now);
    expect(evaluation.isExpired).toBe(true);
    expect(evaluation.status).toBe("expired");
    expect(evaluation.hoursRemaining).toBeLessThanOrEqual(0);
  });
});
