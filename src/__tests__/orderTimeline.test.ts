import { describe, it, expect } from "vitest";
import { timelineStage } from "@/components/home/ActiveOrderTimeline";
describe("timelineStage", () => {
  it("cashier", () => expect(timelineStage("pending")).toBe(0));
  it("kitchen", () => expect(timelineStage("ready")).toBe(1));
  it("driver", () => expect(timelineStage("out_for_delivery")).toBe(2));
  it("delivered", () => expect(timelineStage("delivered")).toBe(3));
});
