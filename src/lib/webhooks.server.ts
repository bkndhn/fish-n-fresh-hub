/**
 * Outbound webhook dispatcher (edge-safe: fetch + Web Crypto only).
 *
 * Any subscribed endpoint receives a signed JSON payload whenever a payment
 * or order lifecycle event happens in the app.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type WebhookEvent =
  | "payment.succeeded"
  | "payment.failed"
  | "order.created"
  | "order.status_changed";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "payment.succeeded",
  "payment.failed",
  "order.created",
  "order.status_changed",
];

function admin() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

const enc = new TextEncoder();

/** HMAC-SHA256 hex signature of the raw JSON body. */
export async function signPayload(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(body) as unknown as BufferSource,
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type OrderLike = Record<string, unknown> & { id?: string };

export function buildPayload(event: WebhookEvent, order: OrderLike | null, extra?: Record<string, unknown>) {
  return {
    event,
    sent_at: new Date().toISOString(),
    data: {
      order: order
        ? {
            id: order["id"] ?? null,
            order_number: order["order_number"] ?? null,
            status: order["status"] ?? null,
            payment_status: order["payment_status"] ?? null,
            payment_method: order["payment_method"] ?? null,
            fulfillment_type: order["fulfillment_type"] ?? null,
            total: order["total"] ?? null,
            subtotal: order["subtotal"] ?? null,
            discount: order["discount"] ?? null,
            delivery_fee: order["delivery_fee"] ?? null,
            gst_amount: order["gst_amount"] ?? null,
            items: order["items"] ?? [],
            customer: {
              name: order["customer_name"] ?? null,
              phone: order["customer_phone"] ?? null,
              email: order["customer_email"] ?? null,
              address: order["customer_address"] ?? null,
            },
            branch_id: order["branch_id"] ?? null,
            created_at: order["created_at"] ?? null,
          }
        : null,
      ...(extra ?? {}),
    },
  };
}

/** POST a signed payload to one URL. Never throws. */
export async function deliverOne(opts: {
  url: string;
  secret: string;
  payload: unknown;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; durationMs: number; error?: string }> {
  const body = JSON.stringify(opts.payload);
  const started = Date.now();
  try {
    const signature = await signPayload(opts.secret, body);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    const res = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": String(Date.now()),
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { ok: res.ok, status: res.status, durationMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Fan a lifecycle event out to every active subscribed endpoint. Never throws. */
export async function dispatchWebhookEvent(
  event: WebhookEvent,
  order: OrderLike | null,
  extra?: Record<string, unknown>,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  try {
    const db = admin();
    const { data: endpoints } = await db
      .from("webhook_endpoints")
      .select("id, url, secret, events, is_active")
      .eq("is_active", true);

    const targets = (endpoints ?? []).filter((e) => (e.events ?? []).includes(event));
    if (targets.length === 0) return { delivered: 0, failed: 0 };

    const payload = buildPayload(event, order, extra);

    await Promise.all(
      targets.map(async (ep) => {
        const result = await deliverOne({ url: ep.url, secret: ep.secret, payload });
        if (result.ok) delivered += 1;
        else failed += 1;
        await db.from("webhook_deliveries").insert({
          endpoint_id: ep.id,
          event,
          order_id: (order?.["id"] as string | undefined) ?? null,
          status_code: result.status,
          ok: result.ok,
          duration_ms: result.durationMs,
          error: result.error ?? null,
        });
        await db
          .from("webhook_endpoints")
          .update({
            last_status: result.status,
            last_error: result.error ?? null,
            last_delivered_at: new Date().toISOString(),
          })
          .eq("id", ep.id);
      }),
    );
  } catch (e) {
    console.error("[webhooks] dispatch failed", e);
  }
  return { delivered, failed };
}

/** Load an order row (service role) for payload building. */
export async function loadOrder(orderId: string): Promise<OrderLike | null> {
  try {
    const { data } = await admin().from("orders").select("*").eq("id", orderId).maybeSingle();
    return (data as OrderLike) ?? null;
  } catch {
    return null;
  }
}
