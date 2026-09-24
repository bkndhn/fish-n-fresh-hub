import { createServerFn } from "@tanstack/react-start";
import type { CartItem } from "./types";
import { triggerOrderAlert as triggerOrderAlertBackend } from "@/routes/api/public/order-alerts";

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
      await triggerOrderAlertBackend(data.orderId, data.eventType, data.oldStatus);
    } catch (err) {
      console.error("[triggerOrderAlert] Failed:", err);
    }
  });

export async function sendOrderPlacedNotification(orderId: string, customerPhone: string, customerName: string, items: CartItem[], total: number) {
  const itemSummary = items.map(i => `${i.qty}x ${i.name}`).join(", ");
  
  // 1. Send Push Notification 
  await triggerOrderAlertBackend(orderId, 'INSERT').catch(console.error);

  // 2. Send WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_placed_template",
    [customerName, orderId, itemSummary, formatINR(total)]
  ).catch(console.error);
}

export async function sendOrderShippedNotification(orderId: string, customerPhone: string, customerName: string, trackingUrl?: string) {
  // 1. Push Notification
  await triggerOrderAlertBackend(orderId, 'UPDATE', 'packed').catch(console.error);

  // 2. WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_shipped_template",
    [customerName, orderId, trackingUrl || ""]
  ).catch(console.error);
}

export async function sendOrderDeliveredNotification(orderId: string, customerPhone: string, customerName: string) {
  // 1. Push Notification
  await triggerOrderAlertBackend(orderId, 'UPDATE', 'out_for_delivery').catch(console.error);

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
