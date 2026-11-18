import { describe, it, expect } from "vitest";
import { applyFreeDeliveryDay, isFreeDeliveryDay, nextFreeDay } from "@/lib/freeDelivery";

// 2026-11-18 is a Wednesday in IST
const wed = new Date("2026-11-18T07:00:00Z");
describe("free delivery days", () => {
  it("waives fee on a chosen day", () => expect(applyFreeDeliveryDay(40, [0, 3], wed)).toBe(0));
  it("keeps fee on other days", () => expect(applyFreeDeliveryDay(40, [0, 6], wed)).toBe(40));
  it("uses IST, not UTC (Tue 20:00 UTC = Wed IST)", () => expect(isFreeDeliveryDay([3], new Date("2026-11-17T20:00:00Z"))).toBe(true));
  it("no days selected means never free", () => expect(isFreeDeliveryDay([], wed)).toBe(false));
  it("next free day wraps the week", () => expect(nextFreeDay([0, 1], wed)).toBe(0));
});
