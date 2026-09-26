import { createServerFn } from "@tanstack/react-start";
import type { CartItem } from "./types";

/**
 * Core Notifications Engine
 * This provides a strong foundation for scaling automated notifications 
 * across Email, WhatsApp, and Push (FCM). 
 */

// Placeholder for future WhatsApp API Integration (e.g., Twilio / Meta Graph API)
async function sendWhatsAppTemplateMessage(phone: string, template: string, vars: string[]) {
  // Never log the recipient phone number or template variables (customer PII).
  void phone; void vars;
  console.info(`[WhatsApp Engine] Queued ${template}`);
}

// Actual FCM Push Integration wired through the Server API route logic
export const triggerOrderAlert = createServerFn({ method: "POST" })
  .validator((data: { orderId: string; eventType: 'INSERT' | 'UPDATE'; oldStatus?: string; guestPhone?: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(data?.orderId ?? ""))) throw new Error("Invalid order");
    if (data.eventType !== "INSERT" && data.eventType !== "UPDATE") throw new Error("Invalid event");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireOrderAccess } = await import("./authz.server");
    await requireOrderAccess(data.orderId, data.guestPhone ?? null);
    try {
      const { triggerOrderAlert: triggerOrderAlertBackend } = await import("./order-alerts.server");
      await triggerOrderAlertBackend(data.orderId, data.eventType, data.oldStatus);
    } catch (err) {
      console.error("[triggerOrderAlert] Failed:", err);
    }
  });

export async function sendOrderPlacedNotification(orderId: string, customerPhone: string, customerName: string, items: CartItem[], total: number) {
  const itemSummary = items.map(i => `${i.qty}x ${i.name}`).join(", ");
  
  // 1. Send Push Notification 
  try {
    const { triggerOrderAlert: triggerBackend } = await import("./order-alerts.server");
    await triggerBackend(orderId, 'INSERT').catch(console.error);
  } catch (err) {
    console.error("[sendOrderPlacedNotification] Push trigger error:", err);
  }

  // 2. Send WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_placed_template",
    [customerName, orderId, itemSummary, formatINR(total)]
  ).catch(console.error);
}

export async function sendOrderShippedNotification(orderId: string, customerPhone: string, customerName: string, trackingUrl?: string) {
  // 1. Push Notification
  try {
    const { triggerOrderAlert: triggerBackend } = await import("./order-alerts.server");
    await triggerBackend(orderId, 'UPDATE', 'packed').catch(console.error);
  } catch (err) {
    console.error("[sendOrderShippedNotification] Push trigger error:", err);
  }

  // 2. WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_shipped_template",
    [customerName, orderId, trackingUrl || ""]
  ).catch(console.error);
}

export async function sendOrderDeliveredNotification(orderId: string, customerPhone: string, customerName: string) {
  // 1. Push Notification
  try {
    const { triggerOrderAlert: triggerBackend } = await import("./order-alerts.server");
    await triggerBackend(orderId, 'UPDATE', 'out_for_delivery').catch(console.error);
  } catch (err) {
    console.error("[sendOrderDeliveredNotification] Push trigger error:", err);
  }

  // 2. WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_delivered_template",
    [customerName, orderId]
  ).catch(console.error);
}

// Utility for formatting currency in notifications
function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}
