import type { CartItem } from "./types";

/**
 * Core Notifications Engine
 * This provides a strong foundation for scaling automated notifications 
 * across Email, WhatsApp, and Push (FCM). 
 * API Keys and deeper integrations (like dynamic deep links) can be configured 
 * here without modifying this business logic.
 */

// Placeholder for future WhatsApp API Integration (e.g., Twilio / Meta Graph API)
async function sendWhatsAppTemplateMessage(phone: string, template: string, vars: string[]) {
  console.log(`[WhatsApp Engine] Sending ${template} to ${phone} with vars:`, vars);
}

// Placeholder for future FCM Push Notification Integration
async function sendFCMNotification(phone: string, title: string, body: string) {
  console.log(`[FCM Engine] Sending Push to ${phone}: ${title} - ${body}`);
}

export async function sendOrderPlacedNotification(orderId: string, customerPhone: string, customerName: string, items: CartItem[], total: number) {
  const itemSummary = items.map(i => `${i.qty}x ${i.name}`).join(", ");
  
  // 1. Send Push Notification if FCM is configured
  await sendFCMNotification(
    customerPhone, 
    "Order Placed Successfully! 🛒", 
    `Hi ${customerName}, your order for ${formatINR(total)} is confirmed. Preparing your items now!`
  ).catch(console.error);

  // 2. Send WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_placed_template",
    [customerName, orderId, itemSummary, formatINR(total)]
  ).catch(console.error);
}

export async function sendOrderShippedNotification(orderId: string, customerPhone: string, customerName: string, trackingUrl?: string) {
  // 1. Push Notification
  await sendFCMNotification(
    customerPhone, 
    "Your Order is Out for Delivery! 🚚", 
    `Hi ${customerName}, order #${orderId.slice(0, 8)} has been shipped. Track it live!`
  ).catch(console.error);

  // 2. WhatsApp Notification
  await sendWhatsAppTemplateMessage(
    customerPhone,
    "order_shipped_template",
    [customerName, orderId, trackingUrl || ""]
  ).catch(console.error);
}

export async function sendOrderDeliveredNotification(orderId: string, customerPhone: string, customerName: string) {
  // 1. Push Notification
  await sendFCMNotification(
    customerPhone, 
    "Order Delivered! 🎉", 
    `Hi ${customerName}, your order #${orderId.slice(0, 8)} was delivered successfully. Enjoy your fresh produce!`
  ).catch(console.error);

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
