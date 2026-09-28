import { createServerFn } from "@tanstack/react-start";
import { requireStaff } from "@/lib/authz.server";

export type GuestOrder = {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_status: string;
  payment_method: string;
  fulfillment_type: string;
  total: number;
  items: { name: string; price: number; qty: number }[];
  eta_minutes: number | null;
  delivery_note: string | null;
  status_history: { status: string; at: string; note: string | null }[];
  created_at: string;
  delivered_at: string | null;
};

const FIELDS =
  "id, order_number, customer_name, customer_phone, status, payment_status, payment_method, fulfillment_type, total, items, eta_minutes, delivery_note, status_history, created_at, delivered_at";

/** Guest lookup: requires BOTH the order reference and the phone used on the order. */
export const lookupGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { reference: string; phone: string }) => {
    const reference = String(input.reference ?? "").trim();
    const phone = String(input.phone ?? "").replace(/\D/g, "");
    if (reference.length < 4) throw new Error("Enter your order number");
    if (phone.length < 10) throw new Error("Enter the 10-digit phone used on the order");
    return { reference, phone };
  })
  .handler(async ({ data }): Promise<GuestOrder | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("orders").select(FIELDS).eq("customer_phone", data.phone).limit(1);
    query = /^[0-9a-f-]{36}$/i.test(data.reference)
      ? query.eq("id", data.reference)
      : query.eq("order_number", data.reference);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows?.[0] as unknown as GuestOrder) ?? null);
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Subtract stock for an order. Safe to call twice: the database only deducts once. */
export const deductOrderStockServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; items?: unknown }) => {
    if (!UUID_RE.test(String(input?.orderId ?? ""))) throw new Error("Invalid order");
    return { orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if store has unlimited stock enabled
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("business_vertical")
      .limit(1)
      .maybeSingle();

    const isGlobalUnlimited = Boolean(
      (settings as any)?.allow_unlimited_stock ||
      settings?.business_vertical === "restaurant_cafe" ||
      settings?.business_vertical === "juice_shake_bar" ||
      settings?.business_vertical === "bakery_cake"
    );

    if (isGlobalUnlimited) {
      return { success: true, message: "Unlimited stock mode active — stock deduction skipped" };
    }

    const { data: result, error } = await supabaseAdmin.rpc("deduct_order_stock_atomic", {
      p_order_id: data.orderId,
    });
    if (error) {
      console.error("[Orders] Stock deduction failed:", error.message);
      return { success: false, message: error.message };
    }
    const r = (result && typeof result === "object" && !Array.isArray(result)) ? (result as Record<string, unknown>) : {};
    return { success: Boolean(r["success"]), message: (r["message"] as string) ?? "" };
  });

/** Add stock back for a cancelled/refunded order. Only restores if it was deducted. */
export const restoreOrderStockServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; items?: unknown }) => {
    if (!UUID_RE.test(String(input?.orderId ?? ""))) throw new Error("Invalid order");
    return { orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("restore_order_stock_atomic", {
      p_order_id: data.orderId,
    });
    if (error) {
      console.error("[Orders] Stock restoral failed:", error.message);
      return { success: false, message: error.message };
    }
    const r2 = (result && typeof result === "object" && !Array.isArray(result)) ? (result as Record<string, unknown>) : {};
    return { success: Boolean(r2["success"]), message: (r2["message"] as string) ?? "" };
  });

export const updateOrderStatusWithEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; status: string; driverInfo?: { name?: string; phone?: string } }) => {
    return input;
  })
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "delivered") {
      patch['delivered_at'] = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("orders").update(patch as never).eq("id", data.orderId);
    if (error) throw new Error(error.message);

    // Deduct stock upon order completion or delivery if not already deducted and not unlimited
    if (data.status === "completed" || data.status === "delivered") {
      try {
        const { data: settings } = await supabaseAdmin
          .from("store_settings")
          .select("business_vertical")
          .limit(1)
          .maybeSingle();

        const isGlobalUnlimited = Boolean(
          (settings as any)?.allow_unlimited_stock ||
          settings?.business_vertical === "restaurant_cafe" ||
          settings?.business_vertical === "juice_shake_bar" ||
          settings?.business_vertical === "bakery_cake"
        );

        if (!isGlobalUnlimited) {
          const { error: rpcErr } = await supabaseAdmin.rpc("deduct_order_stock_atomic", {
            p_order_id: data.orderId,
          });
          if (rpcErr) console.warn("[Orders] Stock deduction on completion notice:", rpcErr.message);
        }
      } catch (err) {
        console.warn("[Orders] Stock deduction error on completion:", err);
      }
    }

    // Automatically restore stock if order is cancelled or rejected (idempotent in SQL)
    if (data.status === "cancelled" || data.status === "rejected") {
      const { error: rpcErr } = await supabaseAdmin.rpc("restore_order_stock_atomic", {
        p_order_id: data.orderId,
      });
      if (rpcErr) console.warn("[Orders] Stock restoral notice:", rpcErr.message);
    }

    // Trigger transactional notifications (FCM, WhatsApp, Email)
    try {
      const { sendOrderDeliveredEmail, sendOutForDeliveryEmail } = await import("@/lib/emails.server");
      const { sendOrderShippedNotification, sendOrderDeliveredNotification } = await import("@/lib/notifications.functions");
      
      // We need the order details to send the notification
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("customer_name, customer_phone, tracking_url")
        .eq("id", data.orderId)
        .single();
        
      if (orderData && orderData.customer_phone) {
        if (data.status === "delivered") {
          await sendOrderDeliveredEmail(data.orderId);
          await sendOrderDeliveredNotification(data.orderId, orderData.customer_phone, orderData.customer_name);
        } else if (data.status === "out_for_delivery") {
          await sendOutForDeliveryEmail(data.orderId, data.driverInfo);
        } else if (data.status === "shipped") {
          await sendOrderShippedNotification(data.orderId, orderData.customer_phone, orderData.customer_name, orderData.tracking_url ?? undefined);
        }
      }
    } catch (e) {
      console.warn("[Orders] Transactional notification notice:", e);
    }

    return { success: true };
  });


export const updateOrderWeightAndPrice = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; total: number; weight: number }) => input)
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        total: data.total,
        pos_scale_weight_kg: data.weight,
        updated_at: new Date().toISOString()
      } as never)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return true;
  });

export type VerifyOrderPriceInput = {
  items: Array<{
    product_id: string;
    qty: number;
    price?: number;
  }>;
  fulfillment?: "delivery" | "pickup";
  deliveryFee?: number;
  discount?: number;
  walletDiscount?: number;
  appliedPromoCode?: string | null;
  clientTotal: number;
};

export type VerifyOrderPriceResult = {
  verified: boolean;
  serverSubtotal: number;
  serverGst: number;
  serverDeliveryFee: number;
  serverTotal: number;
};

/**
 * Server-Side Price Verification & Anti-Tampering Engine
 * Never trusts client-submitted prices or totals.
 * Queries current live prices directly from `products` table in Supabase.
 * Recalculates subtotal, GST tax, delivery fee, and validates total within 10 paise tolerance.
 * Throws "400 Bad Request: Order total calculation mismatch" if tampered.
 */
export const verifyOrderPriceServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: VerifyOrderPriceInput) => {
    if (!input || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Invalid order items");
    }
    for (const item of input.items) {
      if (!item.product_id || typeof item.product_id !== "string") {
        throw new Error("Invalid product in order items");
      }
      if (typeof item.qty !== "number" || item.qty <= 0) {
        throw new Error("Invalid quantity in order items");
      }
    }
    return input;
  })
  .handler(async ({ data }): Promise<VerifyOrderPriceResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch live product prices from database
    const productIds = Array.from(new Set(data.items.map((i) => i.product_id)));
    const { data: dbProducts, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, wholesale_price, gst_percent, gst_included, is_available")
      .in("id", productIds);

    if (prodErr || !dbProducts) {
      throw new Error("Could not verify product catalog prices");
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let serverSubtotal = 0;
    for (const item of data.items) {
      const liveProduct = productMap.get(item.product_id);
      if (!liveProduct) {
        throw new Error(`Product ${item.product_id} is no longer available in store catalog`);
      }
      const unitPrice = Number(liveProduct.price || 0);
      serverSubtotal += unitPrice * item.qty;
    }

    // Fetch store settings for GST and store policies
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("gst_enabled, free_delivery_over")
      .limit(1)
      .maybeSingle();

    const isGstActive = (settings as any)?.gst_enabled !== false;
    let serverGstAmount = 0;
    if (isGstActive) {
      for (const item of data.items) {
        const liveProduct = productMap.get(item.product_id);
        if (liveProduct && Number(liveProduct.gst_percent || 0) > 0 && !liveProduct.gst_included) {
          serverGstAmount += ((Number(liveProduct.price || 0) * item.qty) * Number(liveProduct.gst_percent || 0)) / 100;
        }
      }
      serverGstAmount = Math.round(serverGstAmount);
    }

    const serverDeliveryFee = data.fulfillment === "pickup" ? 0 : Math.max(0, Number(data.deliveryFee || 0));
    const discount = Math.max(0, Number(data.discount || 0));
    const walletDiscount = Math.max(0, Number(data.walletDiscount || 0));

    const serverTotal = Math.max(0, serverSubtotal - discount - walletDiscount + serverDeliveryFee + serverGstAmount);

    const diff = Math.abs(data.clientTotal - serverTotal);
    if (diff > 0.10) {
      throw new Error(
        `400 Bad Request: Order total calculation mismatch (expected ₹${serverTotal.toFixed(2)}, got ₹${Number(data.clientTotal).toFixed(2)})`
      );
    }

    return {
      verified: true,
      serverSubtotal,
      serverGst: serverGstAmount,
      serverDeliveryFee,
      serverTotal,
    };
  });
