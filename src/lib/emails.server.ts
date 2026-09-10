/**
 * Server-side Transactional Email Delivery Engine.
 *
 * Dispatches responsive HTML emails for:
 * 1. Order Confirmed (with invoice items, delivery pin, store details)
 * 2. Order Delivered (with satisfaction guarantee, WhatsApp feedback)
 * 3. Out For Delivery (with driver tracking)
 *
 * Uses real store settings (store_name, store_phone, store_address)
 * and dispatches via Resend API (or simulation mode if API key is not yet set).
 */

import {
  buildOrderConfirmedEmail,
  buildOrderDeliveredEmail,
  buildOutForDeliveryEmail,
  type OrderEmailData,
  type EmailOrderItem,
} from "./emails";

export interface EmailDispatchResult {
  success: boolean;
  recipient?: string;
  orderNumber?: string;
  mode: "resend" | "simulated";
  messageId?: string;
  error?: string;
}

export async function sendOrderConfirmedEmail(orderId: string): Promise<EmailDispatchResult> {
  return dispatchOrderEmail(orderId, "confirmed");
}

export async function sendOrderDeliveredEmail(orderId: string): Promise<EmailDispatchResult> {
  return dispatchOrderEmail(orderId, "delivered");
}

export async function sendOutForDeliveryEmail(
  orderId: string,
  driver?: { name?: string; phone?: string }
): Promise<EmailDispatchResult> {
  return dispatchOrderEmail(orderId, "out_for_delivery", driver);
}

async function dispatchOrderEmail(
  orderId: string,
  type: "confirmed" | "out_for_delivery" | "delivered",
  driver?: { name?: string; phone?: string }
): Promise<EmailDispatchResult> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch Order Details
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn(`[Email Engine] Order ${orderId} not found for ${type} email.`);
      return { success: false, error: "Order not found", mode: "simulated" };
    }

    const recipient = order.customer_email || (order as any).user_email || "";
    const orderNumber = order.order_number || order.id.slice(0, 8);

    // 2. Fetch Store Settings (Real store details)
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("*")
      .maybeSingle();

    const storeName = (settings as any)?.store_name || "Fish N Fresh Hub";
    const storePhone = (settings as any)?.store_phone || (settings as any)?.phone || "9843061919";
    const storeAddress = (settings as any)?.store_address || (settings as any)?.address_line || "Main Beach Road, Chennai, Tamil Nadu";

    // 3. Format Items
    const rawItems = (Array.isArray(order.items) ? order.items : []) as any[];
    const items: EmailOrderItem[] = rawItems.map((it) => ({
      name: it.name || "Seafood Item",
      qty: Number(it.qty) || 1,
      unit: it.unit || "kg",
      price: Number(it.price) || 0,
      total: (Number(it.qty) || 1) * (Number(it.price) || 0),
      cuttingStyle: it.cuttingStyle || it.cut_preference || undefined,
    }));

    // 4. Construct Email Payload
    const emailData: OrderEmailData = {
      orderNumber,
      orderId: order.id,
      customerName: order.customer_name || "Valued Customer",
      customerEmail: recipient,
      customerPhone: order.customer_phone || "",
      deliveryAddress: order.customer_address || "Pickup from Store",
      deliverySlot: order.delivery_slot || undefined,
      deliveryPin: (order as any).delivery_pin || undefined,
      driverName: driver?.name || (order as any).driver_name || undefined,
      driverPhone: driver?.phone || (order as any).driver_phone || undefined,
      items,
      subtotal: Number(order.subtotal) || Number(order.total) || 0,
      discount: Number(order.discount) || 0,
      deliveryFee: Number(order.delivery_fee) || 0,
      gstAmount: Number(order.gst_amount) || 0,
      total: Number(order.total) || 0,
      storeName,
      storePhone,
      storeAddress,
    };

    let html = "";
    let subject = "";

    if (type === "confirmed") {
      html = buildOrderConfirmedEmail(emailData);
      subject = `Order Confirmed #${orderNumber} — ${storeName}`;
    } else if (type === "out_for_delivery") {
      html = buildOutForDeliveryEmail(emailData);
      subject = `Out for Delivery #${orderNumber} — Fresh from ${storeName}`;
    } else {
      html = buildOrderDeliveredEmail(emailData);
      subject = `Delivered Fresh! #${orderNumber} — Thank you from ${storeName}`;
    }

    // 5. Send via Resend if API key is provided
    const resendApiKey = process.env['RESEND_API_KEY'];
    if (resendApiKey && recipient) {
      try {
        const fromEmail = process.env['MAIL_FROM'] || `orders@${process.env['RESEND_DOMAIN'] || "resend.dev"}`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${storeName} <${fromEmail}>`,
            to: [recipient],
            subject,
            html,
          }),
        });

        if (res.ok) {
          const json = (await res.json()) as any;
          console.log(`[Email Engine] Sent real email via Resend to ${recipient}: ${json.id}`);
          return {
            success: true,
            recipient,
            orderNumber,
            mode: "resend",
            messageId: json.id,
          };
        } else {
          const errText = await res.text();
          console.warn(`[Email Engine] Resend API error: ${errText}`);
        }
      } catch (sendErr) {
        console.warn(`[Email Engine] Resend delivery network error:`, sendErr);
      }
    }

    // Fallback: Safe simulated dispatch log with complete store details
    console.log(`[Email Engine: ${type.toUpperCase()}] To: ${recipient || "Customer (No Email Given)"} | Subject: "${subject}" | Store: ${storeName} (${storePhone})`);
    return {
      success: true,
      recipient: recipient || "customer",
      orderNumber,
      mode: "simulated",
    };
  } catch (err: any) {
    console.error(`[Email Engine] Exception:`, err);
    return { success: false, error: err?.message || String(err), mode: "simulated" };
  }
}
