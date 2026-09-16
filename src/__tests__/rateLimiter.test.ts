import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  recordRateLimitAttempt,
  resetRateLimit,
  formatRetryAfter,
  RATE_LIMIT_CONFIGS,
} from "../lib/rateLimiter";

describe("Application & Client-Side Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimit("auth_signin", "test_user_1");
    resetRateLimit("auth_signin", "test_user_2");
    resetRateLimit("checkout_order", "9843061919");
    resetRateLimit("support_chat", "session_123");
  });

  describe("formatRetryAfter", () => {
    it("formats small seconds into seconds string", () => {
      expect(formatRetryAfter(45)).toBe("45s");
      expect(formatRetryAfter(5)).toBe("5s");
    });

    it("formats minutes and remainder seconds", () => {
      expect(formatRetryAfter(125)).toBe("2m 5s");
      expect(formatRetryAfter(180)).toBe("3m");
    });

    it("handles zero and negative seconds gracefully", () => {
      expect(formatRetryAfter(0)).toBe("a moment");
      expect(formatRetryAfter(-10)).toBe("a moment");
    });
  });

  describe("checkRateLimit", () => {
    it("allows initial action and reports max configured attempts", () => {
      const res = checkRateLimit("auth_signin", "test_user_1");
      expect(res.allowed).toBe(true);
      expect(res.remainingAttempts).toBe(RATE_LIMIT_CONFIGS.auth_signin.maxAttempts);
      expect(res.retryAfterSeconds).toBe(0);
      expect(res.errorMessage).toBeUndefined();
    });

    it("does not increment or consume the limit counter", () => {
      checkRateLimit("auth_signin", "test_user_1");
      checkRateLimit("auth_signin", "test_user_1");
      const res = checkRateLimit("auth_signin", "test_user_1");
      expect(res.remainingAttempts).toBe(RATE_LIMIT_CONFIGS.auth_signin.maxAttempts);
    });
  });

  describe("recordRateLimitAttempt & sliding window", () => {
    it("decrements remaining attempts on each call", () => {
      const max = RATE_LIMIT_CONFIGS.auth_signin.maxAttempts;
      const r1 = recordRateLimitAttempt("auth_signin", "test_user_1");
      expect(r1.allowed).toBe(true);
      expect(r1.remainingAttempts).toBe(max - 1);

      const r2 = recordRateLimitAttempt("auth_signin", "test_user_1");
      expect(r2.allowed).toBe(true);
      expect(r2.remainingAttempts).toBe(max - 2);
    });

    it("blocks and provides error message when max attempts reached", () => {
      const max = RATE_LIMIT_CONFIGS.auth_signin.maxAttempts; // 5
      for (let i = 0; i < max; i++) {
        recordRateLimitAttempt("auth_signin", "test_user_1");
      }

      // Next attempt should be blocked
      const blocked = recordRateLimitAttempt("auth_signin", "test_user_1");
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingAttempts).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.errorMessage).toContain("Too many sign in attempts");
    });

    it("isolates different users and identifiers strictly", () => {
      const max = RATE_LIMIT_CONFIGS.auth_signin.maxAttempts;
      for (let i = 0; i < max; i++) {
        recordRateLimitAttempt("auth_signin", "test_user_1");
      }

      // User 1 is blocked
      expect(checkRateLimit("auth_signin", "test_user_1").allowed).toBe(false);

      // User 2 must NOT be blocked!
      const user2Check = checkRateLimit("auth_signin", "test_user_2");
      expect(user2Check.allowed).toBe(true);
      expect(user2Check.remainingAttempts).toBe(max);
    });

    it("isolates different action types strictly", () => {
      const max = RATE_LIMIT_CONFIGS.checkout_order.maxAttempts;
      for (let i = 0; i < max; i++) {
        recordRateLimitAttempt("checkout_order", "9843061919");
      }

      // Checkout is blocked
      expect(checkRateLimit("checkout_order", "9843061919").allowed).toBe(false);

      // Support chat or auth must still be permitted for the same identifier
      expect(checkRateLimit("support_chat", "9843061919").allowed).toBe(true);
    });
  });

  describe("resetRateLimit", () => {
    it("clears attempts and instantly unblocks the action", () => {
      const max = RATE_LIMIT_CONFIGS.auth_signin.maxAttempts;
      for (let i = 0; i < max; i++) {
        recordRateLimitAttempt("auth_signin", "test_user_1");
      }
      expect(checkRateLimit("auth_signin", "test_user_1").allowed).toBe(false);

      // Reset after successful login or admin unlock
      resetRateLimit("auth_signin", "test_user_1");

      const fresh = checkRateLimit("auth_signin", "test_user_1");
      expect(fresh.allowed).toBe(true);
      expect(fresh.remainingAttempts).toBe(max);
    });
  });
});
