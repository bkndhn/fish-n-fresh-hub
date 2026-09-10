import { describe, it, expect } from "vitest";
import { DRIP_SEQUENCES } from "@/lib/marketingDrips.server";

describe("Automated Marketing Drips Rules", () => {
  it("contains all 5 enterprise retention sequences", () => {
    expect(DRIP_SEQUENCES).toHaveLength(5);
    const ids = DRIP_SEQUENCES.map((s) => s.id);
    expect(ids).toContain("winback_7d");
    expect(ids).toContain("review_48h");
    expect(ids).toContain("abandoned_cart_2h");
    expect(ids).toContain("friday_feast");
    expect(ids).toContain("welcome_first");
  });

  it("provides valid promo codes for conversion incentives", () => {
    const winback = DRIP_SEQUENCES.find((s) => s.id === "winback_7d");
    expect(winback?.defaultPromoCode).toBe("FRESHBACK10");

    const cart = DRIP_SEQUENCES.find((s) => s.id === "abandoned_cart_2h");
    expect(cart?.defaultPromoCode).toBe("FREESHIP");

    const welcome = DRIP_SEQUENCES.find((s) => s.id === "welcome_first");
    expect(welcome?.defaultPromoCode).toBe("WELCOME50");
  });

  it("includes customer name substitution tag in templates", () => {
    DRIP_SEQUENCES.forEach((seq) => {
      expect(seq.bodyTemplate).toContain("{{customer_name}}");
    });
  });
});
