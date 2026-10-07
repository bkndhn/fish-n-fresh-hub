import { describe, it, expect } from "vitest";
import { parseOrderText } from "../lib/whatsappBot";

const catalog = [
  { id: "1", name: "Seer Fish (Vanjaram)", price: 900, unit: "kg" },
  { id: "2", name: "Tiger Prawns", price: 600, unit: "kg" },
  { id: "3", name: "Alphonso Mango Shake", price: 120, unit: "glass" },
];

describe("WhatsApp kitchen bot parser", () => {
  it("prices kg items and converts grams", () => {
    const r = parseOrderText("2kg seer fish, 500g prawns", catalog);
    expect(r.lines.map((l) => l.qty)).toEqual([2, 0.5]);
    expect(r.subtotal).toBe(2100);
  });
  it("counts plain quantities and reports unknown items", () => {
    const r = parseOrderText("2 mango shake\n1 pizza", catalog);
    expect(r.subtotal).toBe(240);
    expect(r.unmatched).toEqual(["1 pizza"]);
  });
});
