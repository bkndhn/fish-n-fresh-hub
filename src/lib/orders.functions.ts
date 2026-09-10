import { createServerFn } from "@tanstack/react-start";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("deduct_order_stock_atomic", {
      p_order_id: data.orderId,
    });
    if (error) {
      console.error("[Orders] Stock deduction failed:", error.message);
      return { success: false, message: error.message };
    }
    return { success: Boolean(result?.success), message: result?.message ?? "" };
  });

/** Add stock back for a cancelled/refunded order. Only restores if it was deducted. */
export const restoreOrderStockServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; items?: unknown }) => {
    if (!UUID_RE.test(String(input?.orderId ?? ""))) throw new Error("Invalid order");
    return { orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("restore_order_stock_atomic", {
      p_order_id: data.orderId,
    });
    if (error) {
      console.error("[Orders] Stock restoral failed:", error.message);
      return { success: false, message: error.message };
    }
    return { success: Boolean(result?.success), message: result?.message ?? "" };
  });

export const updateOrderStatusWithEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string; status: string; driverInfo?: { name?: string; phone?: string } }) => {
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "delivered") {
      patch['delivered_at'] = new Date().toISOString();
    }
    const { error } = await (supabaseAdmin as any).from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);

    // Automatically restore stock if order is cancelled or rejected (idempotent in SQL)
    if (data.status === "cancelled" || data.status === "rejected") {
      const { error: rpcErr } = await (supabaseAdmin as any).rpc("restore_order_stock_atomic", {
        p_order_id: data.orderId,
      });
      if (rpcErr) console.warn("[Orders] Stock restoral notice:", rpcErr.message);
    }

    // Trigger transactional email
    try {
      const { sendOrderDeliveredEmail, sendOutForDeliveryEmail } = await import("@/lib/emails.server");
      if (data.status === "delivered") {
        await sendOrderDeliveredEmail(data.orderId);
      } else if (data.status === "out_for_delivery") {
        await sendOutForDeliveryEmail(data.orderId, data.driverInfo);
      }
    } catch (e) {
      console.warn("[Orders] Transactional email notice:", e);
    }

    return { success: true };
  });


