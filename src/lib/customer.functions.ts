import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PurchaseTier = "frequent" | "sometimes" | "one_time" | "never";

export type RegisteredCustomer = {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  ordersCount: number;
  lifetimeSpent: number;
  lastOrderAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  purchaseTier: PurchaseTier;
  confirmed: boolean;
};

export const listAllCustomersDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegisteredCustomer[]> => {
    const ctx = context as any;

    // 1. Fetch all orders to compute order statistics per user/phone
    const { data: orders, error: ordersError } = await ctx.supabase
      .from("orders")
      .select("id, user_id, customer_name, customer_phone, total, status, created_at")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching orders for customer aggregation:", ordersError);
    }

    // Map stats by user_id AND by clean 10-digit phone
    const statsByUserId = new Map<string, { count: number; spent: number; lastOrder: string; name: string; phone: string }>();
    const statsByPhone = new Map<string, { count: number; spent: number; lastOrder: string; name: string; userId?: string }>();

    for (const o of orders ?? []) {
      const isPaid = o.status !== "cancelled";
      const amt = isPaid ? Number(o.total || 0) : 0;
      const cleanPhone = (o.customer_phone || "").replace(/\D/g, "").slice(-10);

      if (o.user_id) {
        const existing = statsByUserId.get(o.user_id);
        if (existing) {
          existing.count += 1;
          existing.spent += amt;
        } else {
          statsByUserId.set(o.user_id, {
            count: 1,
            spent: amt,
            lastOrder: o.created_at,
            name: o.customer_name || "",
            phone: o.customer_phone || "",
          });
        }
      }

      if (cleanPhone) {
        const existingP = statsByPhone.get(cleanPhone);
        if (existingP) {
          existingP.count += 1;
          existingP.spent += amt;
        } else {
          statsByPhone.set(cleanPhone, {
            count: 1,
            spent: amt,
            lastOrder: o.created_at,
            name: o.customer_name || "",
            userId: o.user_id || undefined,
          });
        }
      }
    }

    // 2. Try fetching full registered auth users via supabaseAdmin
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

      if (!authError && authData?.users) {
        const registeredList: RegisteredCustomer[] = authData.users.map((u) => {
          const userMeta = u.user_metadata ?? {};
          const metaPhone = (userMeta["phone"] as string) || u.phone || "";
          const cleanPhone = metaPhone.replace(/\D/g, "").slice(-10);

          // Find order stats by user_id first, then by phone
          const stats = statsByUserId.get(u.id) || (cleanPhone ? statsByPhone.get(cleanPhone) : undefined);

          const ordersCount = stats?.count ?? 0;
          const lifetimeSpent = stats?.spent ?? 0;
          const lastOrderAt = stats?.lastOrder ?? null;

          let purchaseTier: PurchaseTier = "never";
          if (ordersCount >= 3) purchaseTier = "frequent";
          else if (ordersCount === 2) purchaseTier = "sometimes";
          else if (ordersCount === 1) purchaseTier = "one_time";
          else purchaseTier = "never";

          const fullName: string =
            String(userMeta["full_name"] ||
            userMeta["name"] ||
            stats?.name ||
            (u.email ? u.email.split("@")[0] : "Customer"));

          const customerPhone: string = metaPhone || (stats && "phone" in stats ? (stats as any).phone : cleanPhone) || "";

          return {
            id: u.id,
            email: u.email ?? "",
            phone: customerPhone,
            fullName,
            ordersCount,
            lifetimeSpent,
            lastOrderAt,
            lastSignInAt: u.last_sign_in_at ?? null,
            createdAt: u.created_at,
            purchaseTier,
            confirmed: Boolean(u.email_confirmed_at),
          };
        });

        // Also append guests who ordered via phone but don't have an auth user record
        const processedPhones = new Set(
          registeredList.map((r) => r.phone.replace(/\D/g, "").slice(-10)).filter(Boolean)
        );

        statsByPhone.forEach((val, phone) => {
          if (!processedPhones.has(phone)) {
            let tier: PurchaseTier = "never";
            if (val.count >= 3) tier = "frequent";
            else if (val.count === 2) tier = "sometimes";
            else if (val.count === 1) tier = "one_time";

            registeredList.push({
              id: `guest-${phone}`,
              email: "",
              phone,
              fullName: val.name || `Customer (${phone.slice(-4)})`,
              ordersCount: val.count,
              lifetimeSpent: val.spent,
              lastOrderAt: val.lastOrder,
              lastSignInAt: null,
              createdAt: val.lastOrder,
              purchaseTier: tier,
              confirmed: true,
            });
          }
        });

        return registeredList.sort((a, b) => {
          // Sort by spend descending, then by creation date
          if (b.lifetimeSpent !== a.lifetimeSpent) return b.lifetimeSpent - a.lifetimeSpent;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
    } catch (adminErr: any) {
      console.warn("supabaseAdmin listUsers fallback:", adminErr?.message);
    }

    // 3. Fallback: Synthesize from orders table directly
    const fallbackList: RegisteredCustomer[] = [];
    statsByPhone.forEach((val, phone) => {
      let tier: PurchaseTier = "never";
      if (val.count >= 3) tier = "frequent";
      else if (val.count === 2) tier = "sometimes";
      else if (val.count === 1) tier = "one_time";

      fallbackList.push({
        id: val.userId || `phone-${phone}`,
        email: "",
        phone,
        fullName: val.name || `Customer (${phone})`,
        ordersCount: val.count,
        lifetimeSpent: val.spent,
        lastOrderAt: val.lastOrder,
        lastSignInAt: null,
        createdAt: val.lastOrder,
        purchaseTier: tier,
        confirmed: true,
      });
    });

    return fallbackList.sort((a, b) => b.lifetimeSpent - a.lifetimeSpent);
  });
