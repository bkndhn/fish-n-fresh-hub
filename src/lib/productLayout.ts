/**
 * @fileoverview Product Detail Page Layout & Section Customization Engine
 * @module lib/productLayout
 * 
 * Provides store administrators with deep customization over which sections,
 * cards, and labels appear on the product detail page (Nutrition, Culinary/Technical Specs,
 * Portion Chips, Subscriptions, AI Benefits, Reviews, Related Recommendations).
 */

import { detectVerticalFromStoreName, type BusinessVertical } from "./verticals";

export interface ProductLayoutConfig {
  // Section visibility flags
  showNutrition: boolean;
  showCulinarySpecs: boolean;
  showPortionChips: boolean;
  showSubscriptions: boolean;
  showAiBenefits: boolean;
  showReviews: boolean;
  showRelatedProducts: boolean;

  // Customizable section titles and subtitles
  specsTitle: string;
  specsSubtitle: string;
  nutritionTitle: string;
  subscriptionTitle: string;
  subscriptionSubtitle: string;
  reviewsTitle: string;
  relatedTitle: string;
}

export function getDefaultProductLayoutConfig(
  verticalId?: string | null,
  storeName?: string | null
): ProductLayoutConfig {
  const effectiveVertical: BusinessVertical = (verticalId as BusinessVertical) || detectVerticalFromStoreName(storeName);

  if (effectiveVertical === "clothing_fashion") {
    return {
      showNutrition: false,
      showCulinarySpecs: true,
      showPortionChips: false,
      showSubscriptions: false,
      showAiBenefits: true,
      showReviews: true,
      showRelatedProducts: true,
      specsTitle: "Materials, Fit & Care Specifications",
      specsSubtitle: "Fabric composition, sizing standards, and care instructions",
      nutritionTitle: "Product Highlights",
      subscriptionTitle: "VIP Club & Seasonal Drops",
      subscriptionSubtitle: "Priority member access to new arrivals",
      reviewsTitle: "Verified Customer Reviews",
      relatedTitle: "You May Also Like",
    };
  }

  if (effectiveVertical === "electronics_appliances") {
    return {
      showNutrition: false,
      showCulinarySpecs: true,
      showPortionChips: false,
      showSubscriptions: false,
      showAiBenefits: true,
      showReviews: true,
      showRelatedProducts: true,
      specsTitle: "Technical Specifications & Box Contents",
      specsSubtitle: "Hardware specifications, warranty coverage, and included accessories",
      nutritionTitle: "Key Technical Specs",
      subscriptionTitle: "Extended Care & Protection Plan",
      subscriptionSubtitle: "Annual hardware care and priority support",
      reviewsTitle: "Verified Customer Reviews",
      relatedTitle: "Compatible & Related Products",
    };
  }

  // Food / Seafood / Meat / Supermarket / Universal
  const isFood = effectiveVertical === "seafood" || effectiveVertical === "chicken_meat" || effectiveVertical === "all_meat" || effectiveVertical === "grocery_supermarket";

  return {
    showNutrition: isFood,
    showCulinarySpecs: true,
    showPortionChips: isFood,
    showSubscriptions: isFood,
    showAiBenefits: true,
    showReviews: true,
    showRelatedProducts: true,
    specsTitle: isFood ? "Culinary & Sourcing Specifications" : "Product Specifications & Details",
    specsSubtitle: isFood ? "Storage temperature, origin, preparation, and harvest traceability" : "Key characteristics, origin, and instructions",
    nutritionTitle: "Nutritional Highlights (Per 100g)",
    subscriptionTitle: "Subscribe & Save 5%",
    subscriptionSubtitle: isFood ? "Weekly Priority Catch Dispatch" : "Scheduled Automated Reordering",
    reviewsTitle: "Verified Customer Reviews",
    relatedTitle: "You May Also Like",
  };
}

export function getProductLayoutConfig(tenantId?: string | null, storeName?: string | null, verticalId?: string | null): ProductLayoutConfig {
  const defaultConfig = getDefaultProductLayoutConfig(verticalId, storeName);
  if (typeof localStorage === "undefined") return defaultConfig;

  try {
    const key = `fnf_product_layout_${tenantId || "default"}`;
    const raw = localStorage.getItem(key);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    return {
      ...defaultConfig,
      ...parsed,
    };
  } catch {
    return defaultConfig;
  }
}

export function saveProductLayoutConfig(config: ProductLayoutConfig, tenantId?: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    const key = `fnf_product_layout_${tenantId || "default"}`;
    localStorage.setItem(key, JSON.stringify(config));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("fnf_product_layout_updated", { detail: config }));
    }
  } catch (err) {
    console.warn("Failed to persist product layout config:", err);
  }
}
