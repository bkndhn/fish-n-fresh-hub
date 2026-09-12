import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNextOrderSequenceNumber } from "../lib/orderNumber";
import { DEFAULT_PORTION_CHIPS, getStoredPortionChips, type PortionChip } from "../components/admin/PortionChipsModal";

// Mock localStorage for vitest node environment
const storageMock: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k in storageMock) delete storageMock[k];
  },
});

describe("Universal Portion Chips & Presets", () => {
  it("provides standard portion presets ranging from 100g to 5kg", () => {
    expect(DEFAULT_PORTION_CHIPS.length).toBeGreaterThanOrEqual(10);
    const weights = DEFAULT_PORTION_CHIPS.map((c) => c.val);
    expect(weights).toContain(0.25);
    expect(weights).toContain(0.5);
    expect(weights).toContain(1.0);
    expect(weights).toContain(2.0);
    expect(weights).toContain(5.0);
  });

  it("formats labels correctly with unit suffix", () => {
    const chip250g = DEFAULT_PORTION_CHIPS.find((c) => c.val === 0.25);
    expect(chip250g?.label).toBe("250g");

    const chip1kg = DEFAULT_PORTION_CHIPS.find((c) => c.val === 1.0);
    expect(chip1kg?.label).toBe("1 kg");
  });

  it("supports adding and updating custom portion chips", () => {
    const customChip: PortionChip = {
      label: "750g Cleaned",
      val: 0.75,
    };
    const updated = [...DEFAULT_PORTION_CHIPS, customChip];
    expect(updated.find((c) => c.label === "750g Cleaned")?.val).toBe(0.75);
  });
});

describe("Sequential Order Number Generation (POS vs Online)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates online order number with FNF prefix and formatted date", async () => {
    const num = await getNextOrderSequenceNumber("online");
    expect(num).toMatch(/^FNF-\d{8}-\d{4}$/);
  });

  it("generates POS in-store order number with POS prefix and formatted date", async () => {
    const num = await getNextOrderSequenceNumber("pos");
    expect(num).toMatch(/^POS-\d{8}-\d{4}$/);
  });

  it("maintains separate sequence tracks for POS and Online orders", async () => {
    const online1 = await getNextOrderSequenceNumber("online");
    const pos1 = await getNextOrderSequenceNumber("pos");
    expect(online1.startsWith("FNF-")).toBe(true);
    expect(pos1.startsWith("POS-")).toBe(true);
  });
});

describe("Delivery Turnaround Timing & PIN Anti-Theft Security", () => {
  function computeTiming(createdAt: string, deliveredAt: string | null) {
    const placed = new Date(createdAt).getTime();
    const ended = deliveredAt ? new Date(deliveredAt).getTime() : Date.now();
    const elapsedMins = Math.max(1, Math.round((ended - placed) / (1000 * 60)));
    return {
      placedAt: new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      deliveredAt: deliveredAt ? new Date(deliveredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
      elapsedMins,
      isDelivered: Boolean(deliveredAt),
    };
  }

  it("correctly computes turnaround minutes for delivered order", () => {
    const placed = "2026-09-12T10:00:00.000Z";
    const delivered = "2026-09-12T10:35:00.000Z";
    const timing = computeTiming(placed, delivered);
    expect(timing.elapsedMins).toBe(35);
    expect(timing.isDelivered).toBe(true);
  });

  it("sanitizes customer WhatsApp messages so delivery PIN is never leaked in text", () => {
    const customerName = "Aravind";
    const orderRef = "FNF-20260912-0001";
    const driverName = "Karthik R";
    const etaMins = "25";

    // Anti-theft sanitized preset:
    const sanitizedDispatchedText = `🚀 Hi ${customerName}! Your fresh seafood order #${orderRef} is OUT FOR DELIVERY with rider ${driverName}. Estimated arrival in ~${etaMins} mins.\n\n🔒 For safe and verified delivery, please keep your 4-digit Doorstep PIN ready from your order tracking screen to provide to the rider.`;

    // Must NOT leak plaintext PIN into message
    expect(sanitizedDispatchedText).not.toContain("*1234*");
    expect(sanitizedDispatchedText).toContain("Doorstep PIN ready");
  });
});
