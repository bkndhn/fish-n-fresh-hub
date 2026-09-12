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

// ── Rate Limiter ──────────────────────────────────────────────────
// Sliding-window in-memory rate limiter. On Cloudflare Workers each
// isolate has its own Map, so this is per-edge-node (good enough for
// DDoS mitigation; for stricter limits use Cloudflare Rate Limiting).
const RATE_WINDOW_MS = 60_000; // 1 minute window
const API_RATE_LIMIT = 100;    // 100 requests per minute for API/pages
const STATIC_RATE_LIMIT = 500; // 500 requests per minute for static assets
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, isStatic: boolean): boolean {
  const now = Date.now();
  const limit = isStatic ? STATIC_RATE_LIMIT : API_RATE_LIMIT;
  const bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  bucket.count++;
  if (bucket.count > limit) return true;
  return false;
}

// Periodic cleanup to prevent memory leaks (runs every 1000 requests)
let requestCounter = 0;
function maybeCleanupBuckets(): void {
  if (++requestCounter % 1000 !== 0) return;
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
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
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  headers.set("X-XSS-Protection", "1; mode=block");

  // Content Security Policy
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.fr https://fcm.googleapis.com; " +
      "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.fr; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "frame-src https://js.stripe.com https://hooks.stripe.com; " +
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
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (!headers.has("Cache-Control")) {
    headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
    );
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

    // ── Rate limiting ──
    maybeCleanupBuckets();
    const clientIp =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const isStatic =
      url.pathname.includes("/assets/") ||
      url.pathname.includes("/_build/") ||
      /\.(js|css|png|jpg|webp|svg|woff2|ico)$/.test(url.pathname);

    if (isRateLimited(clientIp, isStatic)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
            "cache-control": "no-store",
          },
        }
      );
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
