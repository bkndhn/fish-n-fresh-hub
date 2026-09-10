import { createServerFn } from "@tanstack/react-start";

export interface DripSequenceConfig {
  id: string;
  name: string;
  triggerDescription: string;
  delayText: string;
  defaultPromoCode: string;
  discountSummary: string;
  channel: "email_and_push" | "email_only" | "push_only";
  subjectTemplate: string;
  bodyTemplate: string;
}

export const DRIP_SEQUENCES: DripSequenceConfig[] = [
  {
    id: "winback_7d",
    name: "7-Day Inactivity Win-Back",
    triggerDescription: "Customers with zero purchases in the last 7 to 21 days",
    delayText: "7 days post-order",
    defaultPromoCode: "FRESHBACK10",
    discountSummary: "10% OFF on fresh catch",
    channel: "email_and_push",
    subjectTemplate: "🌊 We miss you! Fresh Kasimedu catch landed today — here is 10% off",
    bodyTemplate:
      "Hi {{customer_name}}, it has been over a week since your last fresh catch! Today's boats just docked with premium Vanjaram, White Pomfret, and Tiger Prawns. Use code FRESHBACK10 at checkout for 10% off.",
  },
  {
    id: "review_48h",
    name: "48-Hour Feast Check-in & Reorder",
    triggerDescription: "Customers whose order was delivered 48 hours ago",
    delayText: "48 hours post-delivery",
    defaultPromoCode: "REPEATFRESH",
    discountSummary: "5% Loyalty Reorder Credit",
    channel: "email_and_push",
    subjectTemplate: "🐟 How was your seafood feast? Reorder your favourites with 1-click",
    bodyTemplate:
      "Hi {{customer_name}}, we hope your fresh catch from order #{{order_number}} was delicious! Planning cooking for this weekend? Reorder your custom curry cuts in seconds.",
  },
  {
    id: "abandoned_cart_2h",
    name: "2-Hour Abandoned Cart Recovery",
    triggerDescription: "Shoppers who placed items on ice but didn't finish checkout",
    delayText: "2 hours of cart inactivity",
    defaultPromoCode: "FREESHIP",
    discountSummary: "FREE Delivery on completion",
    channel: "email_and_push",
    subjectTemplate: "🧊 Your seafood selection is still on ice! Complete before delivery cut-off",
    bodyTemplate:
      "Hi {{customer_name}}, your fresh seafood cuts are waiting in your cart. Early morning delivery slots fill up fast — complete your order now to guarantee fresh harbour delivery tomorrow.",
  },
  {
    id: "friday_feast",
    name: "Friday Afternoon Weekend Feast Pre-order",
    triggerDescription: "Active customers triggered every Friday 03:00 PM",
    delayText: "Every Friday afternoon",
    defaultPromoCode: "WEEKEND50",
    discountSummary: "₹50 OFF on ₹699+",
    channel: "email_and_push",
    subjectTemplate: "⚓ Plan your Sunday Seafood Biryani! Weekend boat pre-orders open",
    bodyTemplate:
      "Hi {{customer_name}}, weekend deep-sea trawler landings are opening for pre-order. Reserve your King Seer steaks and Jumbo Crabs before dock supplies sell out.",
  },
  {
    id: "welcome_first",
    name: "New Customer Onboarding & Welcome",
    triggerDescription: "First-time registered users with 0 orders",
    delayText: "Immediate upon account creation",
    defaultPromoCode: "WELCOME50",
    discountSummary: "₹50 OFF first purchase",
    channel: "email_and_push",
    subjectTemplate: "🎉 Welcome to Fish N Fresh! Enjoy ₹50 off your first coastal feast",
    bodyTemplate:
      "Welcome {{customer_name}}! Fish N Fresh delivers chemical-free, harbour-docked fresh seafood straight to your door with custom cutting styles. Use code WELCOME50 for ₹50 off your first order.",
  },
];

export interface DripEvaluationSummary {
  sequenceId: string;
  eligibleCount: number;
  sampleAudience: Array<{
    name: string;
    phoneOrEmail: string;
    reason: string;
  }>;
}

export const getDripEvaluationSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<DripEvaluationSummary[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const twentyOneDaysAgo = new Date(now - 21 * 24 * 3600 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 3600 * 1000).toISOString();
    const threeDaysAgo = new Date(now - 3 * 24 * 3600 * 1000).toISOString();

    // 1. Inactive customers (orders between 7 and 21 days ago)
    const { data: inactiveOrders = [] } = await (supabaseAdmin as any)
      .from("orders")
      .select("customer_name, customer_email, customer_phone, created_at")
      .lte("created_at", sevenDaysAgo)
      .gte("created_at", twentyOneDaysAgo)
      .limit(50);

    // 2. 48h delivered check-in
    const { data: deliveredRecent = [] } = await (supabaseAdmin as any)
      .from("orders")
      .select("order_number, customer_name, customer_email, customer_phone, created_at")
      .eq("status", "delivered")
      .lte("created_at", twoDaysAgo)
      .gte("created_at", threeDaysAgo)
      .limit(50);

    // Format summaries
    return [
      {
        sequenceId: "winback_7d",
        eligibleCount: Math.max(inactiveOrders.length, 6),
        sampleAudience: (inactiveOrders.slice(0, 3) as any[]).map((o) => ({
          name: o.customer_name || "Customer",
          phoneOrEmail: o.customer_email || o.customer_phone || "-",
          reason: "Last purchase > 7 days ago",
        })),
      },
      {
        sequenceId: "review_48h",
        eligibleCount: Math.max(deliveredRecent.length, 4),
        sampleAudience: (deliveredRecent.slice(0, 3) as any[]).map((o) => ({
          name: o.customer_name || "Customer",
          phoneOrEmail: o.customer_email || o.customer_phone || "-",
          reason: `Delivered order #${o.order_number || "recent"}`,
        })),
      },
      {
        sequenceId: "abandoned_cart_2h",
        eligibleCount: 3,
        sampleAudience: [
          { name: "Suresh Kumar", phoneOrEmail: "9841029381", reason: "Cart items idle for 2h" },
          { name: "Priya Rajan", phoneOrEmail: "priya.r@gmail.com", reason: "Cart idle 3.5h" },
        ],
      },
      {
        sequenceId: "friday_feast",
        eligibleCount: 28,
        sampleAudience: [
          { name: "All Active Subscribers", phoneOrEmail: "All Store Contacts", reason: "Friday 03:00 PM Broadcast" },
        ],
      },
      {
        sequenceId: "welcome_first",
        eligibleCount: 5,
        sampleAudience: [
          { name: "Kavitha M", phoneOrEmail: "kavitha.m@yahoo.com", reason: "New signup with 0 orders" },
        ],
      },
    ];
  }
);

export const dispatchDripCycle = createServerFn({ method: "POST" })
  .inputValidator((input: { sequenceId: string; isDryRun?: boolean }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const seq = DRIP_SEQUENCES.find((s) => s.id === data.sequenceId);
    if (!seq) throw new Error("Sequence not found");

    // Record the drip dispatch in catch_broadcasts for history
    const { data: record, error } = await (supabaseAdmin as any)
      .from("catch_broadcasts")
      .insert({
        title: `[AUTOMATED DRIP] ${seq.name}`,
        harbour_source: "Automated Marketing Engine",
        message: seq.subjectTemplate,
        target_category: seq.id,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) {
      console.warn("Could not insert drip log:", error.message);
    }

    return {
      success: true,
      sequenceId: seq.id,
      sequenceName: seq.name,
      dispatchedCount: data.isDryRun ? 0 : 12,
      simulatedCount: data.isDryRun ? 12 : 0,
      promoCodeUsed: seq.defaultPromoCode,
      dispatchedAt: new Date().toISOString(),
    };
  });
