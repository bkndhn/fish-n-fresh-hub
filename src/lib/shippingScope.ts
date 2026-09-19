/**
 * @fileoverview Geographic Delivery Coverage & Multi-Tier Shipping Scope Engine
 * @module lib/shippingScope
 * 
 * Supports configurable delivery coverage scopes:
 * - 'local': Hyperlocal / City Radius (Default - existing distance pricing preserved 100%)
 * - 'state': Regional / State-Wide (e.g. All over Tamil Nadu or merchant's primary state)
 * - 'national': Pan-India (Domestic express air/surface courier across 28 states & 8 UTs)
 * - 'international': Worldwide / Global Export (Cross-border express logistics)
 * - 'hybrid': Multi-Tier (Smart auto-routing based on customer destination)
 */

import type { SiteSettings } from "./types";

export type ShippingScopeMode = "local" | "state" | "national" | "international" | "hybrid";

export interface ShippingScopeConfig {
  scope_mode: ShippingScopeMode;

  // 1. Local Hyperlocal Radius (Current behavior preserved 100%)
  local_enabled: boolean;
  local_radius_km: number;
  local_base_fee: number;
  local_free_over: number;
  local_per_km_charge: number;
  local_express_enabled: boolean;
  local_express_fee: number;
  local_express_sla_mins: number;

  // 2. State-Wide / Regional (e.g. Tamil Nadu)
  state_enabled: boolean;
  state_name: string;
  state_shipping_fee: number;
  state_free_over: number;
  state_sla_text: string;
  state_courier_partners: string;

  // 3. Pan-India / Domestic National
  national_enabled: boolean;
  national_shipping_fee: number;
  national_free_over: number;
  national_sla_text: string;
  national_courier_partners: string;

  // 4. International / Worldwide Export
  international_enabled: boolean;
  international_shipping_fee: number;
  international_min_order: number;
  international_sla_text: string;
  international_courier_partners: string;
  international_customs_note: string;

  // 5. Merchant Packaging & Handling Policy
  custom_packaging_notice: string;
}

export const TAMIL_NADU_DISTRICTS: string[] = [
  "Chennai",
  "Coimbatore",
  "Madurai",
  "Tiruchirappalli",
  "Salem",
  "Tiruppur",
  "Erode",
  "Vellore",
  "Thoothukudi",
  "Tirunelveli",
  "Dindigul",
  "Thanjavur",
  "Ranipet",
  "Virudhunagar",
  "Karur",
  "Nilgiris (Ooty)",
  "Kanchipuram",
  "Chengalpattu",
  "Cuddalore",
  "Dharmapuri",
  "Kallakurichi",
  "Kanniyakumari (Nagercoil)",
  "Krishnagiri",
  "Nagapattinam",
  "Namakkal",
  "Perambalur",
  "Pudukkottai",
  "Ramanathapuram",
  "Sivaganga",
  "Tenkasi",
  "Theni",
  "Thiruvallur",
  "Thiruvarur",
  "Tirupathur",
  "Tiruvannamalai",
  "Viluppuram",
  "Mayiladuthurai",
  "Ariyalur",
];

export const INDIAN_STATES: string[] = [
  "Tamil Nadu",
  "Kerala",
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Puducherry",
  "Goa",
  "Gujarat",
  "Delhi",
  "Haryana",
  "Punjab",
  "Rajasthan",
  "Uttar Pradesh",
  "West Bengal",
  "Odisha",
  "Madhya Pradesh",
  "Bihar",
  "Assam",
  "Chandigarh",
  "Chhattisgarh",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Uttarakhand",
  "Andaman & Nicobar Islands",
  "Arunachal Pradesh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Ladakh",
  "Lakshadweep",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Sikkim",
  "Tripura",
];

export const INTERNATIONAL_COUNTRIES: string[] = [
  "United States",
  "United Arab Emirates",
  "United Kingdom",
  "Singapore",
  "Malaysia",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Oman",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "New Zealand",
  "Bahrain",
  "Japan",
  "South Korea",
  "Switzerland",
  "Netherlands",
  "Sri Lanka",
  "Maldives",
];

export const DEFAULT_SHIPPING_SCOPE_CONFIG: ShippingScopeConfig = {
  scope_mode: "local",

  local_enabled: true,
  local_radius_km: 15,
  local_base_fee: 40,
  local_free_over: 500,
  local_per_km_charge: 5,
  local_express_enabled: true,
  local_express_fee: 25,
  local_express_sla_mins: 35,

  state_enabled: false,
  state_name: "Tamil Nadu",
  state_shipping_fee: 60,
  state_free_over: 999,
  state_sla_text: "Next-Day Cold-Chain Delivery across Tamil Nadu (24–36 Hours)",
  state_courier_partners: "ST Courier, Professional Courier, Bus Parcel Express",

  national_enabled: false,
  national_shipping_fee: 120,
  national_free_over: 1499,
  national_sla_text: "2–3 Days Pan-India Express Air Cargo (Insulated Dry-Ice Packaging)",
  national_courier_partners: "BlueDart, Delhivery, India Post Speed Post",

  international_enabled: false,
  international_shipping_fee: 850,
  international_min_order: 2500,
  international_sla_text: "4–7 Business Days Worldwide Express (DHL / FedEx / Aramex)",
  international_courier_partners: "DHL Express, FedEx International, Aramex",
  international_customs_note: "Vacuum packed & airtight insulated. Subject to destination customs clearance.",

  custom_packaging_notice: "Fresh items for outstation shipping are packed in thermocol boxes with food-grade gel ice packs / dry ice.",
};

const STORAGE_KEY = "fnf_shipping_scope_config";

/**
 * Loads the shipping scope configuration from store settings,
 * falling back to localStorage or default values.
 */
export function getShippingScopeConfig(settings?: Partial<SiteSettings> | null): ShippingScopeConfig {
  let loaded: Partial<ShippingScopeConfig> | null = null;

  // 1. Try from Supabase store_settings
  if (settings && (settings as any).shipping_scope_config) {
    const raw = (settings as any).shipping_scope_config;
    if (typeof raw === "object" && raw !== null) {
      loaded = raw;
    } else if (typeof raw === "string") {
      try {
        loaded = JSON.parse(raw);
      } catch {
        // invalid JSON
      }
    }
  }

  // 2. Try from localStorage override
  if (!loaded && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        loaded = JSON.parse(cached);
      }
    } catch {
      // ignore
    }
  }

  // 3. Merge with default values & existing base settings
  const base: ShippingScopeConfig = {
    ...DEFAULT_SHIPPING_SCOPE_CONFIG,
    local_radius_km: Number(settings?.delivery_radius_km ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_radius_km),
    local_base_fee: Number(settings?.base_delivery_fee ?? settings?.delivery_fee ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_base_fee),
    local_free_over: Number(settings?.free_delivery_over ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_free_over),
    local_per_km_charge: Number(settings?.per_km_charge ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_per_km_charge),
    local_express_enabled: (settings as any)?.express_delivery_enabled ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_express_enabled,
    local_express_fee: Number((settings as any)?.express_delivery_fee ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_express_fee),
    local_express_sla_mins: Number((settings as any)?.express_sla_mins ?? DEFAULT_SHIPPING_SCOPE_CONFIG.local_express_sla_mins),
  };

  if (!loaded) return base;

  return {
    ...base,
    ...loaded,
    // Ensure numbers are properly parsed
    local_radius_km: Number(loaded.local_radius_km ?? base.local_radius_km),
    local_base_fee: Number(loaded.local_base_fee ?? base.local_base_fee),
    local_free_over: Number(loaded.local_free_over ?? base.local_free_over),
    local_per_km_charge: Number(loaded.local_per_km_charge ?? base.local_per_km_charge),
    state_shipping_fee: Number(loaded.state_shipping_fee ?? base.state_shipping_fee),
    state_free_over: Number(loaded.state_free_over ?? base.state_free_over),
    national_shipping_fee: Number(loaded.national_shipping_fee ?? base.national_shipping_fee),
    national_free_over: Number(loaded.national_free_over ?? base.national_free_over),
    international_shipping_fee: Number(loaded.international_shipping_fee ?? base.international_shipping_fee),
    international_min_order: Number(loaded.international_min_order ?? base.international_min_order),
  };
}

/**
 * Persists shipping scope configuration to localStorage and fires a sync event.
 */
export function saveShippingScopeConfig(config: ShippingScopeConfig): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(
        new CustomEvent("fishnfresh:shipping-scope-updated", { detail: config })
      );
    } catch {
      // storage unavailable
    }
  }
}

export interface ShippingRateEvaluation {
  tier: "local" | "state" | "national" | "international";
  tierTitle: string;
  fee: number;
  baseFee: number;
  isFree: boolean;
  freeOverThreshold: number;
  amountNeededForFree: number;
  slaText: string;
  carrierText: string;
  isServiceable: boolean;
  unserviceableReason?: string | undefined;
  scopeTag: string;
  packagingNote?: string | undefined;
}

export interface DestinationContext {
  subtotal: number;
  distanceKm?: number | null;
  state?: string | null;
  district?: string | null;
  country?: string | null;
  isExpress?: boolean;
  selectedTierOverride?: "local" | "state" | "national" | "international" | null;
}

/**
 * Evaluates the shipping rate, SLA, and eligibility based on the merchant's configured scope
 * and customer's destination address.
 */
export function evaluateOrderShippingRate(
  config: ShippingScopeConfig,
  ctx: DestinationContext
): ShippingRateEvaluation {
  const { subtotal, distanceKm, state, country, isExpress, selectedTierOverride } = ctx;
  const mode = config.scope_mode;

  // Determine effective shipping tier
  let activeTier: "local" | "state" | "national" | "international" = "local";

  if (selectedTierOverride) {
    activeTier = selectedTierOverride;
  } else if (mode === "local") {
    activeTier = "local";
  } else if (mode === "state") {
    activeTier = "state";
  } else if (mode === "national") {
    activeTier = "national";
  } else if (mode === "international") {
    activeTier = "international";
  } else if (mode === "hybrid") {
    // Smart Hybrid auto-routing:
    // 1. If country specified and not India -> international
    const normCountry = (country || "India").trim().toLowerCase();
    if (normCountry !== "india" && normCountry !== "in") {
      activeTier = "international";
    } else {
      const normState = (state || "").trim().toLowerCase();
      const targetState = (config.state_name || "Tamil Nadu").trim().toLowerCase();
      
      // 2. If within local distance radius (< config.local_radius_km) -> local
      if (distanceKm !== null && distanceKm <= config.local_radius_km && (normState === "" || normState === targetState)) {
        activeTier = "local";
      } else if (normState === targetState || (normState === "" && distanceKm !== null && distanceKm > config.local_radius_km)) {
        // 3. Outside city radius but in state -> state-wide
        activeTier = "state";
      } else if (normState !== "" && normState !== targetState) {
        // 4. Different Indian state -> national
        activeTier = "national";
      } else {
        activeTier = "local";
      }
    }
  }

  // Evaluate Tier specifics
  if (activeTier === "international") {
    const minOrder = config.international_min_order;
    const isBelowMin = subtotal < minOrder;
    const fee = config.international_shipping_fee;

    return {
      tier: "international",
      tierTitle: "Worldwide / International Export",
      fee: isBelowMin ? fee : fee,
      baseFee: fee,
      isFree: false,
      freeOverThreshold: 0,
      amountNeededForFree: 0,
      slaText: config.international_sla_text,
      carrierText: config.international_courier_partners,
      isServiceable: !isBelowMin,
      unserviceableReason: isBelowMin
        ? `Minimum order value for international export is ₹${minOrder.toLocaleString("en-IN")} (Current: ₹${subtotal.toLocaleString("en-IN")})`
        : undefined,
      scopeTag: `[Scope: International Export | Destination: ${country || "Global"}]`,
      packagingNote: config.international_customs_note,
    };
  }

  if (activeTier === "national") {
    const threshold = config.national_free_over;
    const isFree = subtotal >= threshold;
    const baseFee = config.national_shipping_fee;
    const fee = isFree ? 0 : baseFee;
    const amountNeeded = Math.max(0, threshold - subtotal);

    return {
      tier: "national",
      tierTitle: "Pan-India Domestic Courier",
      fee,
      baseFee,
      isFree,
      freeOverThreshold: threshold,
      amountNeededForFree: amountNeeded,
      slaText: config.national_sla_text,
      carrierText: config.national_courier_partners,
      isServiceable: true,
      scopeTag: `[Scope: Pan-India National | State: ${state || "Domestic"}]`,
      packagingNote: config.custom_packaging_notice,
    };
  }

  if (activeTier === "state") {
    const threshold = config.state_free_over;
    const isFree = subtotal >= threshold;
    const baseFee = config.state_shipping_fee;
    const fee = isFree ? 0 : baseFee;
    const amountNeeded = Math.max(0, threshold - subtotal);

    return {
      tier: "state",
      tierTitle: `${config.state_name} Regional Delivery`,
      fee,
      baseFee,
      isFree,
      freeOverThreshold: threshold,
      amountNeededForFree: amountNeeded,
      slaText: config.state_sla_text,
      carrierText: config.state_courier_partners,
      isServiceable: true,
      scopeTag: `[Scope: ${config.state_name} Regional | District: ${ctx.district || "State-Wide"}]`,
      packagingNote: config.custom_packaging_notice,
    };
  }

  // Default: Local Hyperlocal Radius
  const threshold = config.local_free_over;
  const isFreeBase = subtotal >= threshold;
  const baseFee = config.local_base_fee;
  const perKm = config.local_per_km_charge;
  const distanceFee = distanceKm ? Math.round(distanceKm * perKm) : 0;
  let calculatedFee = isFreeBase ? 0 : (distanceKm ? baseFee + distanceFee : baseFee);

  if (isExpress && config.local_express_enabled) {
    calculatedFee += config.local_express_fee;
  }

  const amountNeeded = Math.max(0, threshold - subtotal);

  return {
    tier: "local",
    tierTitle: "Local City Express Radius",
    fee: calculatedFee,
    baseFee,
    isFree: isFreeBase && !isExpress,
    freeOverThreshold: threshold,
    amountNeededForFree: amountNeeded,
    slaText: isExpress
      ? `Express Priority Dispatch in 30–${config.local_express_sla_mins} Mins`
      : "Standard Same-Day Fresh Delivery",
    carrierText: "Store In-House Delivery Fleet / Local Rider",
    isServiceable: true,
    scopeTag: "[Scope: Local Hyperlocal]",
    packagingNote: isExpress ? "Packed on crushed ice in food-safe sealed bags." : undefined,
  };
}

export interface ScopeBadgeInfo {
  label: string;
  badgeClass: string;
  tier: "local" | "state" | "national" | "international";
}

/**
 * Parses order notes or metadata and returns visual badge styling for the fulfillment scope.
 */
export function extractScopeBadge(notes: string | null | undefined): ScopeBadgeInfo | null {
  if (!notes) return null;
  if (notes.includes("International Export") || notes.includes("[Scope: International")) {
    return {
      label: "🌍 Global Export",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      tier: "international",
    };
  }
  if (notes.includes("Pan-India") || notes.includes("[Scope: Pan-India")) {
    return {
      label: "🇮🇳 Pan-India",
      badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
      tier: "national",
    };
  }
  if (notes.includes("Regional") || notes.includes("[Scope: Tamil Nadu")) {
    return {
      label: "🗺️ TN Regional",
      badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      tier: "state",
    };
  }
  if (notes.includes("Local Hyperlocal") || notes.includes("[Scope: Local")) {
    return {
      label: "📍 Local Express",
      badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      tier: "local",
    };
  }
  return null;
}

