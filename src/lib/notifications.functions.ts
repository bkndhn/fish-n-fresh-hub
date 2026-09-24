import { createServerFn } from "@tanstack/react-start";
import type { CartItem } from "./types";

/**
 * Core Notifications Engine
 * This provides a strong foundation for scaling automated notifications 
 * across Email, WhatsApp, and Push (FCM). 
 */

// Placeholder for future WhatsApp API Integration (e.g., Twilio / Meta Graph API)
async function sendWhatsAppTemplateMessage(phone: string, template: string, vars: string[]) {
  console.log(`[WhatsApp Engine] Sending ${template} to ${phone} with vars:`, vars);
}

// Actual FCM Push Integration wired through the Server API route logic
export const triggerOrderAlert = createServerFn({ method: "POST" })
  .validator((data: { orderId: string; eventType: 'INSERT' | 'UPDATE'; oldStatus?: string }) => data)
  .handler(async ({ data }) => {
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
