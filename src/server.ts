import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// ── Distributed Multi-Tier Rate Limiter ───────────────────────────
// Sliding-window in-memory rate limiter per edge isolate with distinct tiers:
// - Static assets: 500 req/min
// - Public API & Server Functions (/api/*, /_server/*): 60 req/min
// - Storefront & Admin SSR pages: 120 req/min
type RateLimitTier = "static" | "api" | "page";

const RATE_WINDOW_MS = 60_000; // 1 minute window
const TIER_LIMITS: Record<RateLimitTier, number> = {
  static: 500, // 500 requests per minute for static assets
  api: 60,     // 60 requests per minute for public API & server functions
  page: 120,   // 120 requests per minute for storefront and admin SSR pages
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkEdgeRateLimit(
  ip: string,
  tier: RateLimitTier
): { limited: boolean; limit: number; remaining: number } {
  const now = Date.now();
  const limit = TIER_LIMITS[tier];
  const bucketKey = `${ip}:${tier}`;
  const bucket = rateBuckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { limited: false, limit, remaining: limit - 1 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return { limited: true, limit, remaining: 0 };
  }
  return { limited: false, limit, remaining: limit - bucket.count };
}

// Periodic cleanup to prevent memory leaks (runs every 1000 requests)
let requestCounter = 0;
function maybeCleanupBuckets(): void {
  if (++requestCounter % 1000 !== 0) return;
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}

// ── Health Check Endpoint ─────────────────────────────────────────
function handleHealthCheck(): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(performance.now() / 1000),
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function applySecurityAndCdnHeaders(response: Response, url: string): Response {
  const headers = new Headers(response.headers);

  // 1. Enterprise Defense-in-Depth Security Headers ("Non-Hackable App")
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self)");
  headers.set("X-XSS-Protection", "1; mode=block");

  // Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.razorpay.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.razorpay.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.fr https://fcm.googleapis.com; " +
      "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.fr; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "frame-src https://js.stripe.com https://hooks.stripe.com https://api.razorpay.com; " +
      "frame-ancestors 'none';"
  );

  // 2. Cloudflare & CDN Edge Caching Headers
  const isStaticAsset =
    url.includes("/assets/") ||
    url.includes("/_build/") ||
    url.endsWith(".js") ||
    url.endsWith(".css") ||
    url.endsWith(".png") ||
    url.endsWith(".jpg") ||
    url.endsWith(".webp") ||
    url.endsWith(".svg") ||
    url.endsWith(".woff2");

  if (isStaticAsset) {
    // Only freeze assets that actually exist. Caching a 404 for a CSS/JS chunk
    // is what makes pages render completely unstyled on later visits.
    if (response.status === 200) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      headers.set("Cache-Control", "no-store");
    }
  } else if (!headers.has("Cache-Control")) {
    // HTML must always be revalidated so the browser never loads a cached page
    // that references stale build asset filenames.
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // ── Health check endpoint ──
    if (url.pathname === "/health" || url.pathname === "/ping") {
      return handleHealthCheck();
    }

    // ── Multi-Tier Edge Rate limiting ──
    maybeCleanupBuckets();
    const clientIp =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const isStatic =
      url.pathname.includes("/assets/") ||
      url.pathname.includes("/_build/") ||
      /\.(js|css|png|jpg|webp|svg|woff2|ico)$/.test(url.pathname);
    const isApi =
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/_server/") ||
      url.pathname.startsWith("/api") ||
      url.pathname.startsWith("/_server");

    const tier: RateLimitTier = isStatic ? "static" : isApi ? "api" : "page";

    if (clientIp !== "unknown") {
      const { limited, limit } = checkEdgeRateLimit(clientIp, tier);
      if (limited) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please slow down." }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "60",
              "x-ratelimit-limit": String(limit),
              "x-ratelimit-remaining": "0",
              "cache-control": "no-store",
            },
          }
        );
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityAndCdnHeaders(normalized, request.url);
    } catch (error) {
      console.error(error);
      const errorResp = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
      return applySecurityAndCdnHeaders(errorResp, request.url);
    }
  },
};
