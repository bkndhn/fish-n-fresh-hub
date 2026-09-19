import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHIPPING_SCOPE_CONFIG,
  getShippingScopeConfig,
  evaluateOrderShippingRate,
  extractScopeBadge,
  type ShippingScopeConfig,
} from "@/lib/shippingScope";
import type { SiteSettings } from "@/lib/types";

describe("Geographic Delivery Coverage & Shipping Scope Engine", () => {
  it("initializes default configuration with local mode", () => {
    const config = getShippingScopeConfig(undefined);
    expect(config.scope_mode).toBe("local");
    expect(config.local_enabled).toBe(true);
    expect(config.state_name).toBe("Tamil Nadu");
    expect(config.local_radius_km).toBe(15);
  });

  it("merges site settings into shipping scope configuration", () => {
    const mockSettings: Partial<SiteSettings> = {
      delivery_radius_km: 18,
      base_delivery_fee: 55,
      free_delivery_over: 650,
      per_km_charge: 10,
      express_delivery_enabled: true,
      express_delivery_fee: 35,
    };

    const config = getShippingScopeConfig(mockSettings as SiteSettings);
    expect(config.local_radius_km).toBe(18);
    expect(config.local_base_fee).toBe(55);
    expect(config.local_free_over).toBe(650);
    expect(config.local_per_km_charge).toBe(10);
    expect(config.local_express_fee).toBe(35);
  });

  describe("Local Tier Evaluation (Hyperlocal City Radius)", () => {
    const localConfig: ShippingScopeConfig = {
      ...DEFAULT_SHIPPING_SCOPE_CONFIG,
      scope_mode: "local",
      local_base_fee: 40,
      local_free_over: 500,
      local_per_km_charge: 5,
      local_express_fee: 25,
      local_express_enabled: true,
    };

    it("charges base fee + km fee when subtotal is below free threshold", () => {
      const evalResult = evaluateOrderShippingRate(localConfig, {
        subtotal: 350,
        distanceKm: 6,
        isExpress: false,
      });

      expect(evalResult.tier).toBe("local");
      expect(evalResult.isServiceable).toBe(true);
      // 40 base + (6 * 5) = 70
      expect(evalResult.fee).toBe(70);
      expect(evalResult.isFree).toBe(false);
      expect(evalResult.amountNeededForFree).toBe(150);
    });

    it("provides free delivery when subtotal meets free threshold", () => {
      const evalResult = evaluateOrderShippingRate(localConfig, {
        subtotal: 550,
        distanceKm: 8,
        isExpress: false,
      });

      expect(evalResult.tier).toBe("local");
      expect(evalResult.fee).toBe(0);
      expect(evalResult.isFree).toBe(true);
      expect(evalResult.amountNeededForFree).toBe(0);
    });

    it("adds express priority surcharge when express is chosen", () => {
      const evalResult = evaluateOrderShippingRate(localConfig, {
        subtotal: 350,
        distanceKm: 4,
        isExpress: true,
      });

      // 40 base + (4 * 5 = 20) + 25 express = 85
      expect(evalResult.fee).toBe(85);
      expect(evalResult.slaText).toContain("Express Priority");
    });
  });

  describe("State-Wide Tier Evaluation (e.g. Tamil Nadu Regional)", () => {
    const stateConfig: ShippingScopeConfig = {
      ...DEFAULT_SHIPPING_SCOPE_CONFIG,
      scope_mode: "state",
      state_name: "Tamil Nadu",
      state_shipping_fee: 120,
      state_free_over: 1500,
      state_sla_text: "Next-Day Cold-Chain Inter-District Delivery",
      state_courier_partners: "ST Courier / Professional Couriers Cold Logistics",
    };

    it("charges state-wide flat rate for inter-district orders below threshold", () => {
      const evalResult = evaluateOrderShippingRate(stateConfig, {
        subtotal: 800,
        state: "Tamil Nadu",
        district: "Madurai",
      });

      expect(evalResult.tier).toBe("state");
      expect(evalResult.tierTitle).toContain("Tamil Nadu Regional Delivery");
      expect(evalResult.fee).toBe(120);
      expect(evalResult.isFree).toBe(false);
      expect(evalResult.amountNeededForFree).toBe(700);
      expect(evalResult.carrierText).toContain("ST Courier");
      expect(evalResult.scopeTag).toContain("Madurai");
    });

    it("gives free shipping for state orders above free threshold", () => {
      const evalResult = evaluateOrderShippingRate(stateConfig, {
        subtotal: 1600,
        state: "Tamil Nadu",
        district: "Coimbatore",
      });

      expect(evalResult.tier).toBe("state");
      expect(evalResult.fee).toBe(0);
      expect(evalResult.isFree).toBe(true);
    });
  });

  describe("Pan-India National Tier Evaluation", () => {
    const nationalConfig: ShippingScopeConfig = {
      ...DEFAULT_SHIPPING_SCOPE_CONFIG,
      scope_mode: "national",
      national_shipping_fee: 250,
      national_free_over: 2500,
      national_sla_text: "24–48 Hours Air Cargo Thermo-Insulated Box",
      national_courier_partners: "BlueDart Express / Delhivery Cold Air Cargo",
    };

    it("charges national shipping fee and tags destination state", () => {
      const evalResult = evaluateOrderShippingRate(nationalConfig, {
        subtotal: 1200,
        state: "Karnataka",
      });

      expect(evalResult.tier).toBe("national");
      expect(evalResult.fee).toBe(250);
      expect(evalResult.slaText).toContain("Air Cargo");
      expect(evalResult.scopeTag).toContain("Karnataka");
    });

    it("applies free domestic courier over threshold", () => {
      const evalResult = evaluateOrderShippingRate(nationalConfig, {
        subtotal: 3000,
        state: "Maharashtra",
      });

      expect(evalResult.tier).toBe("national");
      expect(evalResult.fee).toBe(0);
      expect(evalResult.isFree).toBe(true);
    });
  });

  describe("International / Worldwide Export Tier Evaluation", () => {
    const intlConfig: ShippingScopeConfig = {
      ...DEFAULT_SHIPPING_SCOPE_CONFIG,
      scope_mode: "international",
      international_shipping_fee: 3500,
      international_min_order: 5000,
      international_sla_text: "3–5 Days Worldwide DHL/FedEx Express Cargo",
      international_customs_note: "Packed with dry ice & health certificate for customs clearance",
    };

    it("blocks order if subtotal is below minimum export order value", () => {
      const evalResult = evaluateOrderShippingRate(intlConfig, {
        subtotal: 3200,
        country: "United Arab Emirates",
      });

      expect(evalResult.tier).toBe("international");
      expect(evalResult.isServiceable).toBe(false);
      expect(evalResult.unserviceableReason).toContain("Minimum order value for international export is ₹5,000");
    });

    it("permits export order when subtotal meets minimum order requirement", () => {
      const evalResult = evaluateOrderShippingRate(intlConfig, {
        subtotal: 6500,
        country: "Singapore",
      });

      expect(evalResult.tier).toBe("international");
      expect(evalResult.isServiceable).toBe(true);
      expect(evalResult.fee).toBe(3500);
      expect(evalResult.packagingNote).toContain("dry ice");
      expect(evalResult.scopeTag).toContain("Singapore");
    });
  });

  describe("Hybrid Multi-Tier Auto Routing", () => {
    const hybridConfig: ShippingScopeConfig = {
      ...DEFAULT_SHIPPING_SCOPE_CONFIG,
      scope_mode: "hybrid",
      state_name: "Tamil Nadu",
      local_radius_km: 12,
    };

    it("routes to international tier when country is outside India", () => {
      const evalResult = evaluateOrderShippingRate(hybridConfig, {
        subtotal: 8000,
        country: "United States",
      });
      expect(evalResult.tier).toBe("international");
    });

    it("routes to local tier when within local radius in state", () => {
      const evalResult = evaluateOrderShippingRate(hybridConfig, {
        subtotal: 600,
        distanceKm: 5,
        state: "Tamil Nadu",
      });
      expect(evalResult.tier).toBe("local");
    });

    it("routes to state tier when distance exceeds local radius in state", () => {
      const evalResult = evaluateOrderShippingRate(hybridConfig, {
        subtotal: 600,
        distanceKm: 85,
        state: "Tamil Nadu",
        district: "Tiruchirappalli",
      });
      expect(evalResult.tier).toBe("state");
    });

    it("routes to national tier when state is another Indian state", () => {
      const evalResult = evaluateOrderShippingRate(hybridConfig, {
        subtotal: 1000,
        state: "Kerala",
      });
      expect(evalResult.tier).toBe("national");
    });

    it("respects explicit tier override when chosen by customer", () => {
      const evalResult = evaluateOrderShippingRate(hybridConfig, {
        subtotal: 1000,
        distanceKm: 2,
        state: "Tamil Nadu",
        selectedTierOverride: "national",
      });
      expect(evalResult.tier).toBe("national");
    });
  });

  describe("extractScopeBadge Helper", () => {
    it("extracts global export badge", () => {
      const badge = extractScopeBadge("Hub: Main | [Scope: International Export | Destination: UAE]");
      expect(badge).not.toBeNull();
      expect(badge?.tier).toBe("international");
      expect(badge?.label).toContain("Global Export");
    });

    it("extracts pan-india badge", () => {
      const badge = extractScopeBadge("[Scope: Pan-India National | State: Delhi] | Notes: Fragile");
      expect(badge).not.toBeNull();
      expect(badge?.tier).toBe("national");
      expect(badge?.label).toContain("Pan-India");
    });

    it("extracts state regional badge", () => {
      const badge = extractScopeBadge("[Scope: Tamil Nadu Regional | District: Salem]");
      expect(badge).not.toBeNull();
      expect(badge?.tier).toBe("state");
      expect(badge?.label).toContain("TN Regional");
    });

    it("extracts local express badge", () => {
      const badge = extractScopeBadge("Hub: Chennai | [Scope: Local Hyperlocal]");
      expect(badge).not.toBeNull();
      expect(badge?.tier).toBe("local");
      expect(badge?.label).toContain("Local Express");
    });

    it("returns null for notes without scope tags", () => {
      expect(extractScopeBadge(null)).toBeNull();
      expect(extractScopeBadge("Please deliver at backdoor")).toBeNull();
    });
  });
});
