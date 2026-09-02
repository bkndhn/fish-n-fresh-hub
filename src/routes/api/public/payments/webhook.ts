import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _supabase;
}

async function markPaid(session: any) {
  const orderId = session?.metadata?.order_id;
  if (!orderId) return;
  await getSupabase()
    .from("orders")
    .update({
      payment_status: "paid",
      stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", orderId);
}

async function markFailed(session: any) {
  const orderId = session?.metadata?.order_id;
  if (!orderId) return;
  await getSupabase()
    .from("orders")
    .update({ payment_status: "failed", updated_at: new Date().toISOString() } as never)
    .eq("id", orderId);
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
