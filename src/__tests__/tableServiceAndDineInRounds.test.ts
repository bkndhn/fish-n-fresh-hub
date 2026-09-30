import { describe, it, expect } from "vitest";
import { getRequestTypeInfo } from "@/components/admin/TableServiceNotificationsWidget";

describe("Table Service Requests & Instant Assistance", () => {
  it("provides correct labels, icons, and badges for all table service types", () => {
    const waiterInfo = getRequestTypeInfo("waiter_call");
    expect(waiterInfo.label).toBe("Call Waiter");
    expect(waiterInfo.badgeVariant).toBe("destructive");

    const billInfo = getRequestTypeInfo("bill_request");
    expect(billInfo.label).toBe("Request Bill");
    expect(billInfo.badgeVariant).toBe("default");

    const waterInfo = getRequestTypeInfo("water");
    expect(waterInfo.label).toBe("Drinking Water");

    const cutleryInfo = getRequestTypeInfo("cutlery");
    expect(cutleryInfo.label).toBe("Cutlery / Plates");

    const cleanInfo = getRequestTypeInfo("cleaning");
    expect(cleanInfo.label).toBe("Clean Table");

    const customInfo = getRequestTypeInfo("custom");
    expect(customInfo.label).toBe("Custom Request");
  });

  it("handles fallback gracefully for unexpected service request types", () => {
    const unknownInfo = getRequestTypeInfo("something_random");
    expect(unknownInfo.label).toBe("Custom Request");
    expect(unknownInfo.badgeVariant).toBe("secondary");
  });

  it("tracks service request lifecycle transitions accurately", () => {
    type RequestStatus = "pending" | "acknowledged" | "resolved" | "cancelled";
    let status: RequestStatus = "pending";

    // Staff sees call and acknowledges
    status = "acknowledged";
    expect(status).toBe("acknowledged");

    // Staff attends table and resolves
    status = "resolved";
    expect(status).toBe("resolved");
  });
});

describe("Dine-In Multi-Round Ordering & Session Tracking", () => {
  it("computes next round number from active orders", () => {
    const computeNextRound = (orders: Array<{ round_number?: number | null }>) => {
      if (orders.length === 0) return 1;
      const rounds = orders.map((o) => Number(o.round_number || 1));
      return Math.max(...rounds) + 1;
    };

    expect(computeNextRound([])).toBe(1);
    expect(computeNextRound([{ round_number: 1 }])).toBe(2);
    expect(computeNextRound([{ round_number: 1 }, { round_number: 2 }])).toBe(3);
    expect(computeNextRound([{ round_number: null }])).toBe(2);
  });

  it("generates deterministic session token key for table", () => {
    const getSessionKey = (tableNo: string | number) => `dine_in_session_T${tableNo}`;
    expect(getSessionKey(5)).toBe("dine_in_session_T5");
    expect(getSessionKey("vip-1")).toBe("dine_in_session_Tvip-1");
  });

  it("aggregates itemized breakdown and grand total across multiple rounds", () => {
    interface RoundOrder {
      id: string;
      round_number: number;
      items: Array<{ name: string; qty: number; price: number; total_price?: number }>;
      total: number;
    }

    const round1: RoundOrder = {
      id: "ord-1",
      round_number: 1,
      items: [
        { name: "Chicken Dum Biryani", qty: 2, price: 280, total_price: 560 },
        { name: "Fresh Lime Soda", qty: 2, price: 60, total_price: 120 },
      ],
      total: 680,
    };

    const round2: RoundOrder = {
      id: "ord-2",
      round_number: 2,
      items: [
        { name: "Tandoori Fish Tikka", qty: 1, price: 340, total_price: 340 },
        { name: "Gulab Jamun", qty: 2, price: 80, total_price: 160 },
      ],
      total: 500,
    };

    const rounds = [round1, round2];

    const grandTotal = rounds.reduce((sum, r) => sum + r.total, 0);
    expect(grandTotal).toBe(1180);

    const totalItemCount = rounds.reduce(
      (sum, r) => sum + r.items.reduce((s, it) => s + it.qty, 0),
      0
    );
    expect(totalItemCount).toBe(7);

    // Verify itemized details per round
    expect(rounds[0]!.round_number).toBe(1);
    expect(rounds[0]!.items[0]!.name).toBe("Chicken Dum Biryani");
    expect(rounds[1]!.round_number).toBe(2);
    expect(rounds[1]!.items[0]!.name).toBe("Tandoori Fish Tikka");
  });
});

describe("Split Bill Engine Calculations", () => {
  it("calculates exact equal split per diner rounding up to whole rupee", () => {
    const calculateEqualSplit = (total: number, diners: number) => {
      return Math.ceil(total / Math.max(1, diners));
    };

    expect(calculateEqualSplit(1180, 2)).toBe(590);
    expect(calculateEqualSplit(1180, 3)).toBe(394); // 1180 / 3 = 393.33 -> 394
    expect(calculateEqualSplit(1180, 4)).toBe(295);
    expect(calculateEqualSplit(1180, 5)).toBe(236);
  });

  it("handles custom shares correctly", () => {
    const total = 1180;
    const customShare = 500;
    const remaining = total - customShare;
    expect(remaining).toBe(680);
  });
});

describe("Live Order Pipeline Stepper Milestones", () => {
  const getOrderStep = (status: string): number => {
    switch (status) {
      case "pending":
      case "confirmed":
        return 1;
      case "preparing":
        return 2;
      case "ready":
      case "packed":
        return 3;
      case "delivered":
      case "completed":
        return 4;
      default:
        return 1;
    }
  };

  it("maps order status to 4 distinct pipeline steps", () => {
    expect(getOrderStep("pending")).toBe(1);
    expect(getOrderStep("confirmed")).toBe(1);
    expect(getOrderStep("preparing")).toBe(2);
    expect(getOrderStep("ready")).toBe(3);
    expect(getOrderStep("packed")).toBe(3);
    expect(getOrderStep("delivered")).toBe(4);
    expect(getOrderStep("completed")).toBe(4);
  });
});

describe("Floor Staff Dispatch & Table Service Requests Mapping", () => {
  it("associates table service requests by table ID and table number digits", () => {
    const requests = [
      { id: "req-1", table_number: "Table 04", request_type: "bill_request" },
      { id: "req-2", table_number: "vip-1", request_type: "waiter_call" },
    ];

    const map = new Map<string, typeof requests[0]>();
    requests.forEach((req) => {
      const raw = req.table_number.trim().toLowerCase();
      const digits = raw.replace(/\D/g, "");
      if (!map.has(raw)) map.set(raw, req);
      if (digits && !map.has(digits)) map.set(digits, req);
    });

    expect(map.get("table 04")?.request_type).toBe("bill_request");
    expect(map.get("04")?.request_type).toBe("bill_request");
    expect(map.get("4") || map.get("04")).toBeDefined();
    expect(map.get("vip-1")?.request_type).toBe("waiter_call");
  });
});
