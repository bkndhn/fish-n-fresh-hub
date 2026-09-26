import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _supabase;
}

async function markPaid(session: any) {
  const orderId = session?.metadata?.order_id;
  if (!orderId) return;

  const { data: current } = await getSupabase()
    .from("orders")
    .select("status, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  // Already handled (e.g. by the customer-facing verification path) — don't re-fire.
  if (current?.payment_status === "paid") return;

  const update: Record<string, unknown> = {
    payment_status: "paid",
    stripe_session_id: session.id,
    updated_at: new Date().toISOString(),
  };
  // Auto-advance a freshly paid order so staff can start packing immediately.
  if (!current?.status || current.status === "pending" || current.status === "confirmed") update["status"] = "packed";

  await getSupabase()
    .from("orders")
    .update(update as Database["public"]["Tables"]["orders"]["Update"])
    .eq("id", orderId);

  // Push alert to admins/staff + outbound webhooks. Never allowed to throw.
  try {
    const { triggerOrderAlert } = await import("@/lib/order-alerts.server");
    await triggerOrderAlert(orderId, "INSERT").catch(() => {});
    await triggerOrderAlert(orderId, "UPDATE").catch(() => {});
  } catch (e) {
    console.error("[payments/webhook] push alert failed", e);
  }
  try {
    const { dispatchWebhookEvent, loadOrder } = await import("@/lib/webhooks.server");
    const order = await loadOrder(orderId);
    await dispatchWebhookEvent("payment.succeeded", order);
    await dispatchWebhookEvent("order.status_changed", order, {
      old_status: current?.status ?? "pending",
      new_status: order?.["status"] ?? "confirmed",
    });
  } catch (e) {
    console.error("[payments/webhook] outbound dispatch failed", e);
  }
}

async function markFailed(session: any) {
  const orderId = session?.metadata?.order_id;
  if (!orderId) return;
  await getSupabase()
    .from("orders")
    .update({ payment_status: "failed", updated_at: new Date().toISOString() } as Database["public"]["Tables"]["orders"]["Update"])
    .eq("id", orderId);
  try {
    const { dispatchWebhookEvent, loadOrder } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("payment.failed", await loadOrder(orderId));
  } catch (e) {
    console.error("[payments/webhook] outbound dispatch failed", e);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              if (session.payment_status !== "unpaid") await markPaid(session);
              break;
            }
            case "checkout.session.async_payment_succeeded":
              await markPaid(event.data.object);
              break;
            case "checkout.session.async_payment_failed":
              await markFailed(event.data.object);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
