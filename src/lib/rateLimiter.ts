/**
 * Application & Client-Side Rate Limiter
 * Provides sliding-window rate limiting with in-memory tracking and
 * optional sessionStorage persistence to prevent brute force, rapid form spam,
 * order flooding, and bot abuse across critical storefront and admin paths.
 */

export type RateLimitAction =
  | "auth_signin"
  | "auth_signup"
  | "auth_reset"
  | "auth_otp_verify"
  | "auth_otp_send"
  | "checkout_order"
  | "delivery_pin"
  | "support_chat"
  | "product_review";

export interface RateLimitRule {
  /** Maximum number of allowed attempts within the window */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Human readable description of action */
  label: string;
}

export const RATE_LIMIT_CONFIGS: Record<RateLimitAction, RateLimitRule> = {
  auth_signin: {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    label: "Sign in",
  },
  auth_signup: {
    maxAttempts: 4,
    windowMs: 10 * 60 * 1000, // 10 minutes
    label: "Account registration",
  },
  auth_reset: {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    label: "Password reset",
  },
  auth_otp_verify: {
    maxAttempts: 5,             // 5 wrong guesses = locked out
    windowMs: 15 * 60 * 1000,  // 15-minute window
    label: "OTP verification",
  },
  auth_otp_send: {
    maxAttempts: 3,             // 3 OTP send requests max
    windowMs: 10 * 60 * 1000,  // 10-minute window
    label: "OTP send",
  },
  checkout_order: {
    maxAttempts: 5,
    windowMs: 2 * 60 * 1000, // 2 minutes
    label: "Order placement",
  },
  delivery_pin: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    label: "PIN verification",
  },
  support_chat: {
    maxAttempts: 15,
    windowMs: 60 * 1000, // 1 minute
    label: "Chat message",
  },
  product_review: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    label: "Customer review",
  },
};

export interface RateLimitResult {
  /** True if the action is permitted */
  allowed: boolean;
  /** Number of attempts remaining before being blocked */
  remainingAttempts: number;
  /** Seconds until the current rate limit window resets */
  retryAfterSeconds: number;
  /** Ready-to-display error message if rate limit is exceeded */
  errorMessage?: string;
}

interface BucketRecord {
  timestamps: number[];
}

// In-memory bucket store
const memoryStore = new Map<string, BucketRecord>();

function getStorageKey(action: RateLimitAction, identifier: string): string {
  return `fnf_rl_${action}_${identifier.trim().toLowerCase()}`;
}

function loadBucket(action: RateLimitAction, identifier: string, windowMs: number): number[] {
  const now = Date.now();
  const key = getStorageKey(action, identifier);

  // 1. Check in-memory store
  let timestamps: number[] = memoryStore.get(key)?.timestamps || [];

  // 2. Check localStorage (persists across tabs, windows, and page reloads)
  if (timestamps.length === 0 && typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          timestamps = parsed.filter((t): t is number => typeof t === "number");
        }
      }
    } catch {
      // Storage unavailable
    }
  }

  // 3. Fallback to sessionStorage
  if (timestamps.length === 0 && typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          timestamps = parsed.filter((t): t is number => typeof t === "number");
        }
      }
    } catch {
      // Storage unavailable
    }
  }

  // Filter out timestamps outside the sliding window
  const activeTimestamps = timestamps.filter((t) => now - t < windowMs);
  memoryStore.set(key, { timestamps: activeTimestamps });

  return activeTimestamps;
}

function saveBucket(action: RateLimitAction, identifier: string, timestamps: number[]): void {
  const key = getStorageKey(action, identifier);
  memoryStore.set(key, { timestamps });

  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(timestamps));
      }
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, JSON.stringify(timestamps));
      }
    } catch {
      // Storage full or disabled
    }
  }
}

/**
 * Format remaining retry seconds into user-friendly string (e.g., "45s" or "2m 15s")
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds <= 0) return "a moment";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
}

/**
 * Check if an action is currently allowed without consuming an attempt.
 */
export function checkRateLimit(
  action: RateLimitAction,
  identifier: string = "default"
): RateLimitResult {
  const rule = RATE_LIMIT_CONFIGS[action];
  const timestamps = loadBucket(action, identifier, rule.windowMs);
  const now = Date.now();

  const count = timestamps.length;
  const remaining = Math.max(0, rule.maxAttempts - count);

  if (count >= rule.maxAttempts) {
    const oldest = timestamps[0] || now;
    const retryAfterMs = Math.max(0, rule.windowMs - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      errorMessage: `Too many ${rule.label.toLowerCase()} attempts. Please wait ${formatRetryAfter(
        retryAfterSeconds
      )} before trying again.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: remaining,
    retryAfterSeconds: 0,
  };
}

/**
 * Record an attempt and determine if it exceeds the rate limit.
 * Increments the attempt counter inside the sliding window.
 */
export function recordRateLimitAttempt(
  action: RateLimitAction,
  identifier: string = "default"
): RateLimitResult {
  const rule = RATE_LIMIT_CONFIGS[action];
  const timestamps = loadBucket(action, identifier, rule.windowMs);
  const now = Date.now();

  if (timestamps.length >= rule.maxAttempts) {
    const oldest = timestamps[0] || now;
    const retryAfterMs = Math.max(0, rule.windowMs - (now - oldest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      errorMessage: `Too many ${rule.label.toLowerCase()} attempts. Please wait ${formatRetryAfter(
        retryAfterSeconds
      )} before trying again.`,
    };
  }

  const updated = [...timestamps, now];
  saveBucket(action, identifier, updated);

  const remaining = Math.max(0, rule.maxAttempts - updated.length);

  return {
    allowed: true,
    remainingAttempts: remaining,
    retryAfterSeconds: 0,
  };
}

/**
 * Reset rate limit bucket for an action (e.g. after successful sign in or checkout).
 */
export function resetRateLimit(action: RateLimitAction, identifier: string = "default"): void {
  const key = getStorageKey(action, identifier);
  memoryStore.delete(key);

  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) window.localStorage.removeItem(key);
      if (window.sessionStorage) window.sessionStorage.removeItem(key);
    } catch {
      // Storage unavailable
    }
  }
}
