import { describe, it, expect } from "vitest";
import { evaluateCartRewardRule, getVisitorVariant, type MarketingCampaign } from "@/lib/campaigns";

describe("Marketing Campaigns & A/B Engine", () => {
  const mockCampaigns: MarketingCampaign[] = [
    {
      id: "camp-rule-1",
      title: "Free Cleaned Prawns Cart Trigger",
      campaign_type: "cart_rule",
      min_cart_amount: 999,
      discount_amount: 100,
      is_active: true,
    },
    {
      id: "camp-rule-inactive",
      title: "Inactive Rule",
      campaign_type: "cart_rule",
      min_cart_amount: 500,
      discount_amount: 50,
      is_active: false,
    },
    {
      id: "camp-ab-1",
      title: "A/B Coupon Experiment",
      campaign_type: "ab_test",
      variant_a_code: "FLAT100",
      variant_b_code: "SEAFOOD15",
      is_active: true,
    },
  ];

  it("evaluates active cart reward rule when subtotal exceeds threshold", () => {
    const res = evaluateCartRewardRule(1200, mockCampaigns);
    expect(res.eligible).toBe(true);
    expect(res.discountAmount).toBe(100);
    expect(res.title).toBe("Free Cleaned Prawns Cart Trigger");
    expect(res.campaignId).toBe("camp-rule-1");
  });

  it("does not trigger cart reward when subtotal is below threshold", () => {
    const res = evaluateCartRewardRule(850, mockCampaigns);
    expect(res.eligible).toBe(false);
    expect(res.discountAmount).toBe(0);
  });

  it("ignores inactive cart rules even if spend threshold is met", () => {
    const onlyInactive: MarketingCampaign[] = [mockCampaigns[1] as MarketingCampaign];
    const res = evaluateCartRewardRule(750, onlyInactive);
    expect(res.eligible).toBe(false);
  });

  it("assigns deterministic A/B variant to visitor", () => {
    const variant = getVisitorVariant("camp-ab-1");
    expect(["A", "B"]).toContain(variant);

    // Calling again returns identical assigned variant
    const secondCall = getVisitorVariant("camp-ab-1");
    expect(secondCall).toBe(variant);
  });
});
