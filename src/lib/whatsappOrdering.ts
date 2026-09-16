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
  storeName: string;
  storePhone: string;
  customer: WhatsAppOrderCustomerInfo;
  items: WhatsAppOrderItem[];
  subtotal: number;
  deliveryFee: number;
  gstAmount: number;
  isGstEnabled: boolean;
  total: number;
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
 * Formats a clean, high-conversion WhatsApp order text message.
 */
export function buildWhatsAppOrderMessage(data: WhatsAppOrderSummary): string {
  const store = data.storeName.toUpperCase();
  const fulfillmentLabel = data.customer.fulfillment === "pickup" ? "🏪 Store Self-Pickup" : "🚚 Doorstep Delivery";
  
  const lines: string[] = [
    `🌊 *NEW ORDER - ${store}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Customer:* ${data.customer.name.trim() || "Customer"}`,
    `📱 *Phone:* ${data.customer.phone.trim() || "N/A"}`,
  ];

  if (data.customer.fulfillment !== "pickup" && data.customer.address?.trim()) {
    lines.push(`📍 *Delivery Address:* ${data.customer.address.trim()}`);
  }

  lines.push(`📦 *Fulfillment:* ${fulfillmentLabel}`);

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

  lines.push(`💬 _Order placed via Store Web App. Please confirm availability & dispatch time._`);

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
 * Records an order dispatched via WhatsApp into Supabase orders table,
 * ensuring inventory tracking and CRM purchase history are kept fully up to date.
 */
export async function recordWhatsAppOrderInCrm(data: WhatsAppOrderSummary): Promise<{ orderNumber: string; success: boolean }> {
  const orderNumber = `WA-${Date.now().toString().slice(-6)}`;
  try {
    const cleanPhone = data.customer.phone.replace(/\D/g, "") || "9999999999";
    const cleanName = data.customer.name.trim() || "WhatsApp Customer";

    const payload = {
      order_number: orderNumber,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_address: data.customer.address?.trim() || null,
      fulfillment_type: data.customer.fulfillment === "pickup" ? "pickup" : "delivery",
      status: "pending",
      payment_method: "whatsapp",
      payment_status: "pending",
      subtotal: data.subtotal,
      delivery_fee: data.customer.fulfillment === "pickup" ? 0 : data.deliveryFee,
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
      notes: `Order via WhatsApp Deep Link${data.customer.notes ? ` | Notes: ${data.customer.notes}` : ""}`,
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
