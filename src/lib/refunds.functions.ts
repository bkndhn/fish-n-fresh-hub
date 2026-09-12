import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type RefundResult =
  | { ok: true; refunded: number; refundId: string | null; note: string }
  | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cancelAndRefundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; reason: string; environment: StripeEnv; refund: boolean }) => {
    if (!UUID.test(input?.orderId ?? "")) throw new Error("Invalid order");
    if (input.environment !== "sandbox" && input.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return {
      orderId: input.orderId,
      reason: String(input.reason ?? "").trim().slice(0, 300) || "Cancelled by store",
      environment: input.environment,
      refund: Boolean(input.refund),
    };
  })
  .handler(async ({ data, context }): Promise<RefundResult> => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { data: isAdmin, error: roleError } = await ctx.supabase.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (roleError) return { error: roleError.message };
    if (!isAdmin) return { error: "Only an admin can cancel and refund an order" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, total, status, payment_status, payment_method, stripe_session_id, refund_amount")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!order) return { error: "Order not found" };
    if (order.status === "cancelled" && Number(order.refund_amount ?? 0) > 0) {
      return { error: "This order is already cancelled and refunded" };
    }

    let refundId: string | null = null;
    let refunded = 0;
    let note = "Order cancelled.";

    const shouldRefund =
      data.refund && order.payment_status === "paid" && Boolean(order.stripe_session_id);

    if (shouldRefund) {
      try {
        const stripe = createStripeClient(data.environment);
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id as string);
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);
        if (!paymentIntent) return { error: "No card payment found for this order" };

        const refund = await stripe.refunds.create({
          payment_intent: paymentIntent,
          reason: "requested_by_customer",
          metadata: { order_id: order.id },
        });
        refundId = refund.id;
        refunded = Number(refund.amount ?? 0) / 100;
        note = `Order cancelled and ${refunded} refunded to the card.`;
      } catch (err) {
        return { error: getStripeErrorMessage(err) };
      }
    } else if (data.refund && order.payment_status === "paid") {
      note = "Order cancelled. This payment was not taken by card, so refund it manually.";
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: data.reason,
        cancelled_by: ctx.userId,
        ...(refundId
          ? {
              stripe_refund_id: refundId,
              refund_amount: refunded,
              refunded_at: new Date().toISOString(),
              payment_status: "refunded",
            }
          : {}),
      })
      .eq("id", order.id);
    if (updateError) return { error: updateError.message };

    // Put the stock back for the cancelled order (safe if it was never deducted)
    const { error: stockErr } = await supabaseAdmin.rpc("restore_order_stock_atomic", {
      p_order_id: order.id,
    });
    if (stockErr) console.warn("[Refunds] Stock restoral notice:", stockErr.message);

    return { ok: true, refunded, refundId, note };
  });
