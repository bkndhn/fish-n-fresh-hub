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
