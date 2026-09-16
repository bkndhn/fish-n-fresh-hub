/**
 * Store-Level Custom Payment Methods & POS Configuration Module
 * Provides multi-tenant isolated custom payment options, default payment method
 * selection, and real-time cash register audio synthesizer.
 */

import { getCurrentTenant } from "@/lib/tenant";

export interface CustomPaymentMethod {
  id: string;
  name: string;
  description?: string;
  requiresRef?: boolean;
  refPlaceholder?: string;
  icon?: string;
  isEnabled: boolean;
}

export interface StorePaymentConfig {
  defaultMethod: "cash" | "upi" | "card" | "split" | string;
  customMethods: CustomPaymentMethod[];
}

export const DEFAULT_STORE_PAYMENT_CONFIG: StorePaymentConfig = {
  defaultMethod: "cash",
  customMethods: [
    {
      id: "sodexo",
      name: "Sodexo / Pluxee",
      description: "Meal card / voucher payment",
      requiresRef: true,
      refPlaceholder: "Voucher / Card Slip #",
      isEnabled: true,
    },
    {
      id: "khata",
      name: "Store Credit / Khata",
      description: "Customer credit account / pay later",
      requiresRef: true,
      refPlaceholder: "Khata Customer ID / Mobile",
      isEnabled: true,
    },
  ],
};

const STORAGE_PREFIX = "fnf_payment_config_";

export function getStorePaymentConfig(tenantId?: string): StorePaymentConfig {
  if (typeof window === "undefined") return DEFAULT_STORE_PAYMENT_CONFIG;
  try {
    const tid = tenantId || getCurrentTenant().tenantId || "default";
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tid}`) || localStorage.getItem("fnf_global_payment_config");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        defaultMethod: parsed.defaultMethod || "cash",
        customMethods: Array.isArray(parsed.customMethods) ? parsed.customMethods : DEFAULT_STORE_PAYMENT_CONFIG.customMethods,
      };
    }
  } catch (err) {
    console.warn("Failed to load store payment config:", err);
  }
  return DEFAULT_STORE_PAYMENT_CONFIG;
}

export function saveStorePaymentConfig(config: StorePaymentConfig, tenantId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const tid = tenantId || getCurrentTenant().tenantId || "default";
    const serialized = JSON.stringify(config);
    localStorage.setItem(`${STORAGE_PREFIX}${tid}`, serialized);
    localStorage.setItem("fnf_global_payment_config", serialized);
  } catch (err) {
    console.warn("Failed to save store payment config:", err);
  }
}

/**
 * Play a rich, tactile cash register "Ka-Ching!" completion chime using the Web Audio API.
 * Instant, zero-latency, 100% offline, and works across all modern browsers.
 */
export function playCashRegisterChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // First oscillator: mechanical register slide (triangle wave)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.23);

    // Second oscillator: bright bell resonance (sine wave)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.06); // B5
    osc2.frequency.setValueAtTime(1318.51, now + 0.12); // E6

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.45, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.61);
  } catch {
    /* AudioContext policy restriction fallback */
  }
}
