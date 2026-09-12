import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createOrderCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!UUID.test(data?.orderId ?? "")) throw new Error("Invalid order");
    if (!data.returnUrl?.startsWith("http")) throw new Error("Invalid return URL");
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, customer_email, customer_name, payment_status")
        .eq("id", data.orderId)
        .maybeSingle();

      if (error) return { error: error.message };
      if (!order) return { error: "Order not found" };
      if (order.payment_status === "paid") return { error: "This order is already paid" };

      const amount = Math.round(Number(order.total) * 100);
      if (amount < 100) return { error: "Order total is too small for online payment" };

      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: `Fish N Fresh order ${order.order_number ?? order.id.slice(0, 8)}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: "Fish N Fresh seafood order" },
        ...(order.customer_email ? { customer_email: order.customer_email } : {}),
        metadata: { order_id: order.id },
      });

      await supabaseAdmin
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", order.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

export const verifyOrderPaymentSession = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string; environment?: StripeEnv }) => {
    if (!UUID.test(data?.orderId ?? "")) throw new Error("Invalid order");
    return data;
  })
  .handler(async ({ data }): Promise<{ success: boolean; paid: boolean; error?: string; orderNumber?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, status, payment_status, stripe_session_id, customer_email, customer_name")
        .eq("id", data.orderId)
        .maybeSingle();

      if (error || !order) {
        return { success: false, paid: false, error: "Order not found" };
      }

      if (order.payment_status === "paid") {
        return { success: true, paid: true, orderNumber: order.order_number ?? order.id.slice(0, 8) };
      }

      if (!order.stripe_session_id) {
        return { success: true, paid: false };
      }

      const env = data.environment || "sandbox";
      const stripe = createStripeClient(env);
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);

      if (session.payment_status === "paid" || session.status === "complete") {
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "paid",
            actual_payment_method: "stripe_card",
            payment_method: "card",
            status: order.status === "pending" ? "confirmed" : order.status,
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", order.id);

        // Dispatch Order Confirmed Transactional Email
        try {
          const { sendOrderConfirmedEmail } = await import("@/lib/emails.server");
          await sendOrderConfirmedEmail(order.id);
        } catch (emailErr) {
          console.warn("[Payments] Order confirmation email error:", emailErr);
        }

        return { success: true, paid: true, orderNumber: order.order_number ?? order.id.slice(0, 8) };
      }

      return { success: true, paid: false };
    } catch (err) {
      console.error("[Payments] Error verifying Stripe session:", err);
      return { success: false, paid: false, error: getStripeErrorMessage(err) };
    }
  });

