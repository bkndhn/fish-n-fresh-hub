/**
 * @fileoverview WhatsApp Deep-Link Ordering Utility
 * @module lib/whatsappOrdering
 * 
 * Provides end-to-end support for catalog-first and WhatsApp ordering flows.
 * Allows customers to browse products, build carts, choose cut preferences,
 * and dispatch clean, itemized orders directly to the store WhatsApp number
 * via deep link (wa.me) with automatic CRM sync.
 */

import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface WhatsAppOrderCustomerInfo {
  name: string;
  phone: string;
  address?: string | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  googleMapsLink?: string | undefined;
  fulfillment?: "delivery" | "pickup" | undefined;
  preferredDate?: string | undefined;
  notes?: string | undefined;
}

export interface WhatsAppOrderItem {
  productId: string;
  name: string;
  cutPreference?: string | undefined;
  qty: number;
  unit: string;
  price: number;
  totalPrice: number;
}

export interface WhatsAppOrderSummary {
  orderNumber?: string;
  storeName: string;
  storePhone: string;
  customer: WhatsAppOrderCustomerInfo;
  items: WhatsAppOrderItem[];
  subtotal: number;
  deliveryFee: number;
  gstAmount: number;
  isGstEnabled: boolean;
  total: number;
  trackingBaseUrl?: string;
}

/**
 * Normalizes phone number into international E.164 format suitable for WhatsApp wa.me links.
 * Defaults to Indian country code (91) for 10-digit mobile numbers.
 */
export function normalizeWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "919843061919"; // fallback
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Formats a clean, high-conversion WhatsApp order text message with rich in-depth details,
 * custom cuts, door-step GPS navigation link, and tracking link.
 */
export function buildWhatsAppOrderMessage(data: WhatsAppOrderSummary): string {
  const store = data.storeName.toUpperCase();
  const fulfillmentLabel = data.customer.fulfillment === "pickup" ? "🏪 Store Self-Pickup" : "🚚 Doorstep Delivery";
  const orderRef = data.orderNumber || `WA-${Date.now().toString().slice(-6)}`;
  
  const lines: string[] = [
    `🌊 *NEW ORDER - ${store}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🆔 *Order Ref:* #${orderRef}`,
    `👤 *Customer:* ${data.customer.name.trim() || "Customer"}`,
    `📱 *Phone:* ${data.customer.phone.trim() || "N/A"}`,
    `📦 *Fulfillment:* ${fulfillmentLabel}`,
  ];

  if (data.customer.fulfillment !== "pickup" && data.customer.address?.trim()) {
    lines.push(`📍 *Delivery Address:* ${data.customer.address.trim()}`);
    
    // Attach live Google Maps doorstep navigation link if GPS coordinates or link exist
    if (data.customer.lat && data.customer.lng) {
      lines.push(`🧭 *Doorstep Navigation:* https://maps.google.com/?q=${data.customer.lat},${data.customer.lng}`);
    } else if (data.customer.googleMapsLink) {
      lines.push(`🧭 *Doorstep Navigation:* ${data.customer.googleMapsLink}`);
    }
  }

  if (data.customer.preferredDate?.trim()) {
    lines.push(`📅 *Preferred Date:* ${data.customer.preferredDate.trim()}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🛒 *ORDER ITEMS (${data.items.length}):*`);

  data.items.forEach((item, index) => {
    const cutSuffix = item.cutPreference ? ` [${item.cutPreference}]` : "";
    const isWeight = (item.unit || "").toLowerCase().includes("kg") || (item.unit || "").toLowerCase() === "g";
    const qtyFormatted = isWeight ? `${item.qty.toFixed(2)} ${item.unit}` : `${item.qty} ${item.unit}`;
    const rateFormatted = inr(item.price);
    const lineTotal = inr(item.totalPrice);

    lines.push(
      `${index + 1}. *${item.name}*${cutSuffix}\n   └ ${qtyFormatted} × ${rateFormatted} = *${lineTotal}*`
    );
  });

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💰 *Subtotal:* ${inr(data.subtotal)}`);
  
  if (data.customer.fulfillment !== "pickup") {
    lines.push(`🚚 *Delivery Fee:* ${data.deliveryFee === 0 ? "FREE" : inr(data.deliveryFee)}`);
  }

  if (data.isGstEnabled && data.gstAmount > 0) {
    lines.push(`🧾 *GST:* ${inr(data.gstAmount)}`);
  }

  lines.push(`💳 *GRAND TOTAL: ${inr(data.total)}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (data.customer.notes?.trim()) {
    lines.push(`📝 *Special Instructions:*`);
    lines.push(`_${data.customer.notes.trim()}_`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  const cleanCustPhone = data.customer.phone.replace(/\D/g, "");
  if (cleanCustPhone.length >= 10) {
    const base = data.trackingBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://fishnfreshhub.com");
    lines.push(`🔍 *Track Order Live:* ${base}/orders?phone=${cleanCustPhone}`);
  }

  lines.push(`💬 _Order placed via Store Web App. Please reply to confirm availability & dispatch time._`);

  return lines.join("\n");
}

/**
 * Builds the official WhatsApp deep link (wa.me) for instant 1-tap ordering.
 */
export function getWhatsAppOrderDeepLink(storePhone: string, message: string): string {
  const cleanPhone = normalizeWhatsAppNumber(storePhone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

/**
 * Generates the official WhatsApp Business Auto-Reply message template
 * that store owners can configure in WhatsApp Business App (Quick Replies or Away Message).
 */
export function getWhatsAppBusinessAutoReplyTemplate(
  data: WhatsAppOrderSummary,
  orderNumber?: string
): string {
  const ord = orderNumber || data.orderNumber || "WA-ORDER";
  const cleanCustPhone = data.customer.phone.replace(/\D/g, "");
  const base = data.trackingBaseUrl || (typeof window !== "undefined" ? window.location.origin : "https://fishnfreshhub.com");
  const trackingUrl = cleanCustPhone ? `${base}/orders?phone=${cleanCustPhone}` : `${base}/orders`;

  return `👋 Hi ${data.customer.name.trim() || "Customer"}, thank you for ordering from ${data.storeName}!

🌊 We have received your order *#${ord}* (${data.items.length} item${data.items.length === 1 ? "" : "s"} · Total: ${inr(data.total)}).
🛵 Our team is preparing your fresh dock-landed catch with live custom cutting and chilled ice packaging.

📍 Delivery to: ${data.customer.address || "Store Pickup"}
🔍 Track your live order status: ${trackingUrl}

If you need any cut preference modifications, please reply here. Thank you!`;
}

/**
 * Records an order dispatched via WhatsApp into Supabase orders table,
 * ensuring inventory tracking and CRM purchase history are kept fully up to date.
 */
export async function recordWhatsAppOrderInCrm(data: WhatsAppOrderSummary): Promise<{ orderNumber: string; success: boolean }> {
  const orderNumber = data.orderNumber || `WA-${Date.now().toString().slice(-6)}`;
  try {
    const cleanPhone = data.customer.phone.replace(/\D/g, "") || "9999999999";
    const cleanName = data.customer.name.trim() || "WhatsApp Customer";
    const navLink = data.customer.lat && data.customer.lng
      ? `https://maps.google.com/?q=${data.customer.lat},${data.customer.lng}`
      : data.customer.googleMapsLink || null;

    const payload = {
      order_number: orderNumber,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_address: data.customer.address?.trim() || null,
      location_lat: data.customer.lat ?? null,
      location_lng: data.customer.lng ?? null,
      map_link: navLink,
      fulfillment_type: data.customer.fulfillment === "pickup" ? "pickup" : "delivery",
      status: "pending",
      payment_method: "whatsapp",
      payment_status: "pending",
      subtotal: data.subtotal,
      delivery_fee: data.customer.fulfillment === "pickup" ? 0 : data.deliveryFee,
      delivery_date: data.customer.preferredDate || null,
      delivery_note: data.customer.notes || null,
      gst_amount: data.isGstEnabled ? data.gstAmount : 0,
      discount: 0,
      total: data.total,
      items: data.items.map((it) => ({
        product_id: it.productId,
        name: it.name,
        price: it.price,
        qty: it.qty,
        unit: it.unit,
        cutting_style: it.cutPreference || null,
        line_total: it.totalPrice,
      })) as unknown as Json,
      notes: data.customer.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("orders").insert(payload);
    if (error) {
      console.warn("[WhatsAppOrdering] CRM record sync error:", error);
      return { orderNumber, success: false };
    }

    return { orderNumber, success: true };
  } catch (err) {
    console.warn("[WhatsAppOrdering] Failed to record WhatsApp order in CRM:", err);
    return { orderNumber, success: false };
  }
}
