/**
 * @fileoverview Sentry Error Monitoring Integration
 * @module lib/sentry
 *
 * Initializes Sentry for browser-side error capture, breadcrumbs,
 * and optional performance monitoring. Server-side capture is handled
 * separately in server.ts.
 *
 * Setup: Set VITE_SENTRY_DSN in your .env file to enable.
 * If the DSN is not set, Sentry is a no-op (safe for local dev).
 */

/** Whether Sentry has been initialized */
let isInitialized = false;

/** Lazily loaded Sentry module */
let SentryModule: typeof import("@sentry/react") | null = null;

/**
 * Initialize Sentry error monitoring.
 * Safe to call multiple times — only initializes once.
 * If VITE_SENTRY_DSN is not set, this is a no-op.
 */
export async function initSentry(): Promise<void> {
  if (isInitialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info(
        "[Sentry] Skipped — VITE_SENTRY_DSN not set. Error monitoring disabled."
      );
    }
    return;
  }

  try {
    const Sentry = await import("@sentry/react");
    SentryModule = Sentry;

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || "production",
      release: `fish-n-fresh-hub@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,

      // Sample 100% of errors, 10% of transactions for perf monitoring
      sampleRate: 1.0,
      tracesSampleRate: 0.1,

      // Filter out noisy errors
      ignoreErrors: [
        // Browser extensions
        "Non-Error exception captured",
        "Non-Error promise rejection captured",
        // Network errors that are expected
        "Failed to fetch",
        "NetworkError",
        "AbortError",
        "Load failed",
        // ResizeObserver noise
        "ResizeObserver loop",
      ],

      // Breadcrumbs for debugging context
      beforeBreadcrumb(breadcrumb) {
        // Skip noisy console.log breadcrumbs in production
        if (breadcrumb.category === "console" && breadcrumb.level === "log") {
          return null;
        }
        return breadcrumb;
      },

      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Session Replay — capture 10% of sessions, 100% of error sessions
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });

    isInitialized = true;
    console.info("[Sentry] Initialized successfully");
  } catch (err) {
    // Sentry init failure should never crash the app
    console.warn("[Sentry] Failed to initialize:", err);
  }
}

/**
 * Capture an exception in Sentry.
 * Safe to call even if Sentry is not initialized.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (SentryModule) {
    SentryModule.captureException(error, { extra: context });
  }
  // Always log to console as well
  console.error("[Error]", error, context);
}

/**
 * Capture a message in Sentry.
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info"
): void {
  if (SentryModule) {
    SentryModule.captureMessage(message, level);
  }
}

/**
 * Set user context for Sentry error reports.
 * Call this after authentication.
 */
export function setUser(user: {
  id: string;
  email?: string;
  role?: string;
} | null): void {
  if (SentryModule) {
    SentryModule.setUser(user);
  }
}

/**
 * Get the Sentry ErrorBoundary component for React error boundaries.
 * Returns a fallback div if Sentry is not loaded.
 */
export function getErrorBoundary(): React.ComponentType<{
  fallback: React.ReactNode;
  children: React.ReactNode;
}> | null {
  return SentryModule?.ErrorBoundary ?? null;
}
