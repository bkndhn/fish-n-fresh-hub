import { createServerFn } from "@tanstack/react-start";

export interface CreateSubscriptionInput {
  userId?: string | undefined;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | undefined;
  customerAddress: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  cuttingStyle: string;
  frequency: "daily" | "weekly" | "bi_weekly" | "monthly";
  dayOfWeek: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  preferredSlot: string;
  pricePerUnit: number;
}

export function calculateNextDeliveryDate(
  frequency: "daily" | "weekly" | "bi_weekly" | "monthly",
  dayOfWeek: string,
  fromDate = new Date()
): string {
  const daysMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = daysMap[dayOfWeek.toLowerCase()] ?? 0;
  const nextDate = new Date(fromDate);

  if (frequency === "daily") {
    nextDate.setDate(nextDate.getDate() + 1);
  } else {
    // weekly, bi-weekly, or monthly
    const currentDay = nextDate.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    nextDate.setDate(nextDate.getDate() + diff);

    if (frequency === "bi_weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    }
  }

  return nextDate.toISOString().slice(0, 10);
}

export const createSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: CreateSubscriptionInput) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const price = Number(data.pricePerUnit) || 0;
    const qty = Number(data.quantity) || 1;
    const discount = 5.0; // 5% Subscribe & Save discount
    const subtotal = price * qty;
    const totalPrice = Math.round(subtotal * (1 - discount / 100));

    const nextDate = calculateNextDeliveryDate(data.frequency, data.dayOfWeek);

    const payload = {
      user_id: data.userId || null,
      customer_name: data.customerName,
      customer_phone: data.customerPhone.replace(/\D/g, ""),
      customer_email: data.customerEmail || null,
      customer_address: data.customerAddress,
      product_id: data.productId,
      product_name: data.productName,
      quantity: qty,
      unit: data.unit || "kg",
      cutting_style: data.cuttingStyle || "Curry Cut",
      frequency: data.frequency,
      day_of_week: data.dayOfWeek,
      preferred_slot: data.preferredSlot || "07:00 AM - 09:00 AM (Early Catch)",
      price_per_unit: price,
      total_price: totalPrice,
      discount_percent: discount,
      next_delivery_date: nextDate,
      status: "active",
      payment_method: "cod",
    };

    const { data: created, error } = await supabaseAdmin
      .from("customer_subscriptions")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { success: true, subscription: created };
  });

export const updateSubscriptionStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { subscriptionId: string; status: "active" | "paused" | "cancelled" }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.subscriptionId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const generateDueSubscriptionOrders = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Fetch active subscriptions whose next_delivery_date is today or in the past
    const { data: dueSubs = [], error } = await supabaseAdmin
      .from("customer_subscriptions")
      .select("*")
      .eq("status", "active")
      .lte("next_delivery_date", todayStr);

    if (error) throw new Error(error.message);

    const generatedOrders: any[] = [];

    for (const sub of dueSubs) {
      const orderNumber = `SUB-${Math.floor(100000 + Math.random() * 900000)}`;
      const item = {
        productId: sub.product_id,
        product_id: sub.product_id,
        name: `${sub.product_name} (Weekly Sub)`,
        price: sub.price_per_unit,
        qty: sub.quantity,
        weight: sub.quantity,
        unit: sub.unit,
        cutting_style: sub.cutting_style,
        total: sub.total_price,
      };

      const orderPayload = {
        order_number: orderNumber,
        user_id: sub.user_id || null,
        customer_name: sub.customer_name,
        customer_phone: sub.customer_phone,
        customer_email: sub.customer_email || null,
        customer_address: sub.customer_address,
        items: [item],
        total: sub.total_price,
        subtotal: sub.total_price,
        delivery_fee: 0,
        status: "confirmed",
        payment_status: "pending",
        payment_method: sub.payment_method || "cod",
        fulfillment_type: "delivery",
        delivery_slot: sub.preferred_slot,
        delivery_note: `Automated Recurring Subscription Delivery (${sub.frequency.toUpperCase()})`,
        created_at: new Date().toISOString(),
      };

      const { data: createdOrder } = await supabaseAdmin
        .from("orders")
        .insert(orderPayload)
        .select("id, order_number")
        .single();

      if (createdOrder) {
        generatedOrders.push(createdOrder);
      }

      // Advance next_delivery_date by frequency
      const nextDate = calculateNextDeliveryDate(
        sub.frequency,
        sub.day_of_week,
        new Date(Date.now() + 24 * 3600 * 1000)
      );

      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          next_delivery_date: nextDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }

    return {
      success: true,
      ordersGenerated: generatedOrders.length,
      orders: generatedOrders,
    };
  }
);
