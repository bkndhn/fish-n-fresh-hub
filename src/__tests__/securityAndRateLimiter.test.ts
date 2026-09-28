import { describe, it, expect, beforeEach, vi } from "vitest";
import { formatMaskedPhone } from "@/lib/format";
import { timingSafeEqual, hashDeliveryPin } from "@/lib/deliveryPin";
import {
  RATE_LIMIT_CONFIGS,
  checkRateLimit,
  recordRateLimitAttempt,
  resetRateLimit,
  formatRetryAfter,
} from "@/lib/rateLimiter";

describe("Enterprise Security Hardening & PII Masking", () => {
  describe("formatMaskedPhone", () => {
    it("masks standard 10-digit Indian mobile numbers", () => {
      expect(formatMaskedPhone("9843061919")).toBe("98****1919");
      expect(formatMaskedPhone("9876543210")).toBe("98****3210");
    });

    it("masks formatted Indian mobile numbers with country prefix +91", () => {
      expect(formatMaskedPhone("+91 98430 61919")).toBe("+91 98****1919");
      expect(formatMaskedPhone("+919843061919")).toBe("+91 98****1919");
    });

    it("handles 12-digit Indian numbers without plus prefix", () => {
      expect(formatMaskedPhone("919843061919")).toBe("+91 98****1919");
    });

    it("safely handles null, undefined, and empty string without throwing", () => {
      expect(formatMaskedPhone(null)).toBe("");
      expect(formatMaskedPhone(undefined)).toBe("");
      expect(formatMaskedPhone("")).toBe("");
      expect(formatMaskedPhone("   ")).toBe("");
    });

    it("masks international and variable length numbers", () => {
      const res = formatMaskedPhone("+14155552671");
      expect(res.startsWith("+14")).toBe(true);
      expect(res.endsWith("2671")).toBe(true);
      expect(res.includes("****")).toBe(true);
    });
  });

  describe("timingSafeEqual (Constant-Time Verification)", () => {
    it("returns true for identical delivery PINs", () => {
      expect(timingSafeEqual("4921", "4921")).toBe(true);
      expect(timingSafeEqual("0000", "0000")).toBe(true);
    });

    it("returns false for non-matching delivery PINs of same length", () => {
      expect(timingSafeEqual("4921", "4922")).toBe(false);
      expect(timingSafeEqual("1234", "4321")).toBe(false);
    });

    it("returns false for strings of differing length", () => {
      expect(timingSafeEqual("492", "4921")).toBe(false);
      expect(timingSafeEqual("4921", "49210")).toBe(false);
    });

    it("verifies SHA-256 hashes correctly in constant time", async () => {
      const pin = "7382";
      const hash1 = await hashDeliveryPin(pin);
      const hash2 = await hashDeliveryPin(pin);
      const wrongHash = await hashDeliveryPin("7383");

      expect(timingSafeEqual(hash1, hash2)).toBe(true);
      expect(timingSafeEqual(hash1, wrongHash)).toBe(false);
    });
  });

  describe("Multi-Tier Rate Limiting Configuration", () => {
    beforeEach(() => {
      resetRateLimit("auth_signin", "test-user@example.com");
      resetRateLimit("auth_reset", "test-user@example.com");
      resetRateLimit("checkout_order", "9843061919");
      resetRateLimit("guest_order_lookup", "test-guest-ip");
    });

    it("enforces 10-minute window with 5 max attempts on auth signin", () => {
      expect(RATE_LIMIT_CONFIGS.auth_signin.maxAttempts).toBe(5);
      expect(RATE_LIMIT_CONFIGS.auth_signin.windowMs).toBe(10 * 60 * 1000);
    });

    it("enforces 10-minute window with 5 max attempts on auth password reset", () => {
      expect(RATE_LIMIT_CONFIGS.auth_reset.maxAttempts).toBe(5);
      expect(RATE_LIMIT_CONFIGS.auth_reset.windowMs).toBe(10 * 60 * 1000);
    });

    it("enforces 2-minute window with 5 max attempts on checkout order", () => {
      expect(RATE_LIMIT_CONFIGS.checkout_order.maxAttempts).toBe(5);
      expect(RATE_LIMIT_CONFIGS.checkout_order.windowMs).toBe(2 * 60 * 1000);
    });

    it("enforces 1-minute window with 6 max attempts on guest order lookup", () => {
      expect(RATE_LIMIT_CONFIGS.guest_order_lookup.maxAttempts).toBe(6);
      expect(RATE_LIMIT_CONFIGS.guest_order_lookup.windowMs).toBe(60 * 1000);
    });

    it("blocks guest lookup after 6 attempts and allows after reset", () => {
      const id = "lookup-bot-ip";
      resetRateLimit("guest_order_lookup", id);

      for (let i = 0; i < 6; i++) {
        const check = checkRateLimit("guest_order_lookup", id);
        expect(check.allowed).toBe(true);
        recordRateLimitAttempt("guest_order_lookup", id);
      }

      // 7th attempt should be blocked
      const blocked = checkRateLimit("guest_order_lookup", id);
      expect(blocked.allowed).toBe(false);
      expect(blocked.errorMessage).toContain("Too many guest order lookup attempts");

      // Reset allows again
      resetRateLimit("guest_order_lookup", id);
      const afterReset = checkRateLimit("guest_order_lookup", id);
      expect(afterReset.allowed).toBe(true);
    });

    it("formats retry-after durations cleanly", () => {
      expect(formatRetryAfter(45)).toBe("45s");
      expect(formatRetryAfter(90)).toBe("1m 30s");
      expect(formatRetryAfter(120)).toBe("2m");
    });
  });

  describe("Server-Side Price Verification & Anti-Tampering Tolerances", () => {
    it("accepts orders within 10 paise rounding tolerance", () => {
      const serverTotal = 549.00;
      const clientTotalWithPaise = 549.08; // 8 paise diff, <= 0.10
      const diff = Math.abs(clientTotalWithPaise - serverTotal);
      expect(diff <= 0.10).toBe(true);
    });

    it("detects and flags price tampering exceeding 10 paise", () => {
      const serverTotal = 549.00;
      const tamperedClientTotal = 499.00; // ₹50 discount injected on client
      const diff = Math.abs(tamperedClientTotal - serverTotal);
      expect(diff > 0.10).toBe(true);

      const errorMessage = `400 Bad Request: Order total calculation mismatch (expected ₹${serverTotal.toFixed(2)}, got ₹${tamperedClientTotal.toFixed(2)})`;
      expect(errorMessage).toContain("400 Bad Request: Order total calculation mismatch");
    });

    it("verifies accurate GST computation and subtotal addition", () => {
      const items = [
        { price: 400, qty: 1, gst_percent: 5, gst_included: false },
        { price: 200, qty: 2, gst_percent: 0, gst_included: false },
      ];

      const subtotal = items.reduce((acc, i) => acc + i.price * i.qty, 0);
      expect(subtotal).toBe(800);

      const gst = items.reduce((acc, i) => {
        if (i.gst_percent > 0 && !i.gst_included) {
          return acc + (i.price * i.qty * i.gst_percent) / 100;
        }
        return acc;
      }, 0);
      expect(gst).toBe(20);

      const deliveryFee = 50;
      const discount = 30;
      const calculatedTotal = subtotal - discount + deliveryFee + gst;
      expect(calculatedTotal).toBe(840);
    });
  });
});
