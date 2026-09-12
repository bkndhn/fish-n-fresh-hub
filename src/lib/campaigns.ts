/**
 * Storefront Automated Marketing Campaigns & A/B Testing Engine.
 * 
 * Supports:
 * 1. Flash Sales with countdowns and automatic headline banners.
 * 2. Automatic Cart Rules (e.g. Orders >= ₹999 get flat ₹100 off or gift without coupon code).
 * 3. A/B Split Testing: Splits visitors into Variant A or Variant B, tracking conversion velocity.
 */

import { supabase } from "@/integrations/supabase/client";

export interface MarketingCampaign {
  id: string;
  title: string;
  description?: string | null;
  campaign_type: "flash_sale" | "cart_rule" | "ab_test";
  variant_a_code?: string | null;
  variant_b_code?: string | null;
  variant_a_orders?: number;
  variant_b_orders?: number;
  banner_text?: string | null;
  countdown_end?: string | null;
  min_cart_amount?: number;
  discount_amount?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Returns the assigned A/B test variant ("A" or "B") for the current visitor.
 * Persists in localStorage for consistency across sessions.
 */
export function getVisitorVariant(campaignId: string): "A" | "B" {
  if (typeof window === "undefined") return "A";
  const key = `fnf_ab_${campaignId}`;
  const stored = localStorage.getItem(key);
  if (stored === "A" || stored === "B") return stored;

  const assigned = Math.random() < 0.5 ? "A" : "B";
  try {
    localStorage.setItem(key, assigned);
  } catch {}
  return assigned;
}

/**
 * Evaluates active automated cart rules against the current cart subtotal.
 * If eligible, returns the auto-applied discount amount and rule description.
 */
export function evaluateCartRewardRule(
  subtotal: number,
  campaigns: MarketingCampaign[]
): { eligible: boolean; discountAmount: number; title: string; campaignId?: string } {
  const activeCartRules = campaigns.filter(
    (c) => c.is_active && c.campaign_type === "cart_rule"
  );

  for (const rule of activeCartRules) {
    const minSpend = Number(rule.min_cart_amount || 0);
    const discount = Number(rule.discount_amount || 0);
    if (subtotal >= minSpend && discount > 0) {
      return {
        eligible: true,
        discountAmount: discount,
        title: rule.title || `Automatic Cart Reward (Orders above ₹${minSpend})`,
        campaignId: rule.id,
      };
    }
  }

  return { eligible: false, discountAmount: 0, title: "" };
}

/**
 * Records a campaign conversion upon successful order completion.
 */
export async function recordCampaignConversion(
  campaignId: string,
  variant: "A" | "B"
): Promise<void> {
  try {
    const column = variant === "A" ? "variant_a_orders" : "variant_b_orders";
    const { data: current } = await supabase
      .from("marketing_campaigns")
      .select(`id, ${column}`)
      .eq("id", campaignId)
      .maybeSingle();

    if (current) {
      const newVal = (Number(current[column]) || 0) + 1;
      await supabase
        .from("marketing_campaigns")
        .update({ [column]: newVal, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
    }
  } catch (err) {
    console.warn("[Campaigns] Conversion recording note:", err);
  }
}
