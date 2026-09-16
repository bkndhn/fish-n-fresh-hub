import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "./types";

export type OrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  items: { product_id?: string; name: string; price: number; qty: number; unit?: string }[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  status: string;
  payment_method: string;
  fulfillment_type: string;
  delivery_date: string | null;
  delivery_slot: string | null;
  driver_id: string | null;
  driver_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  upi_paid: boolean;
  notes: string | null;
  eta_minutes: number | null;
  delivery_note: string | null;
  payment_status: string;
  refund_amount: number | null;
  refunded_at: string | null;
  stripe_refund_id: string | null;
  stripe_session_id: string | null;
  delivered_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  complaint: string | null;
  cod_settled?: boolean;
  settlement_id?: string | null;
  settled_at?: string | null;
};

export type PromotionRow = {
  id: string;
  name: string;
  type: string;
  code: string | null;
  discount_type: string;
  value: number;
  min_order: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  description: string | null;
};

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export const adminRoleQuery = queryOptions({
  queryKey: ["admin", "role"],
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 60,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) throw error;
    return Boolean(data);
  },
});

export function getAdminOrdersQuery(branchId?: string | "all") {
  const effectiveBranch = typeof branchId === "string" ? branchId : "all";
  return queryOptions({
    queryKey: ["admin", "orders", effectiveBranch],
    queryFn: async (): Promise<OrderRow[]> => {
      let q = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (effectiveBranch !== "all") {
        q = q.eq("branch_id", effectiveBranch);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });
}

export const adminOrdersQuery = Object.assign(
  (branchId?: string | "all") => getAdminOrdersQuery(branchId),
  getAdminOrdersQuery("all")
);

export function getAdminProductsQuery(branchId?: string | "all") {
  const effectiveBranch = typeof branchId === "string" ? branchId : "all";
  return queryOptions({
    queryKey: ["admin", "products", effectiveBranch],
    queryFn: async (): Promise<Product[]> => {
      let q = supabase.from("products").select("*").order("name");
      if (effectiveBranch !== "all") {
        q = q.eq("branch_id", effectiveBranch);
      }
      const { data, error } = await q;
      if (error) throw error;
      const defaultVanjaram = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
      return ((data ?? []) as unknown as Product[]).map((p) => {
        if (
          (p.name?.toLowerCase().includes("vanjaram") || p.name?.toLowerCase().includes("seer fish")) &&
          (!p.image_url || p.image_url.includes("photo-1611171711791-b34fa42e9fc4"))
        ) {
          p.image_url = defaultVanjaram;
        }
        return p;
      });
    },
  });
}

export const adminProductsQuery = Object.assign(
  (branchId?: string | "all") => getAdminProductsQuery(branchId),
  getAdminProductsQuery("all")
);

export const adminPromotionsQuery = queryOptions({
  queryKey: ["admin", "promotions"],
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  queryFn: async (): Promise<PromotionRow[]> => {
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PromotionRow[];
  },
});

export type CustomerItemSummary = {
  name: string;
  qty: number;
  unit: string;
  timesBought: number;
  totalSpent: number;
  preferredCut?: string;
};

export type CustomerRow = {
  phone: string;
  name: string;
  orders: number;
  spent: number;
  last_order: string;
  first_order?: string;
  channel: "online" | "pos" | "omnichannel";
  posOrders: number;
  onlineOrders: number;
  posSpent: number;
  onlineSpent: number;
  topItems: CustomerItemSummary[];
  daysSinceLastOrder: number;
  preferredPayment: string;
  favoriteItemName?: string;
};

export function getAdminCustomersQuery(branchId?: string | "all") {
  const effectiveBranch = typeof branchId === "string" ? branchId : "all";
  return queryOptions({
    queryKey: ["admin", "customers", effectiveBranch],
    queryFn: async (): Promise<CustomerRow[]> => {
      let q = supabase
        .from("orders")
        .select("customer_name, customer_phone, total, created_at, status, branch_id, fulfillment_type, payment_method, items")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (effectiveBranch !== "all") {
        q = q.eq("branch_id", effectiveBranch);
      }

      const { data, error } = await q;
      if (error) throw error;

      type TempCustomer = {
        phone: string;
        name: string;
        orders: number;
        spent: number;
        last_order: string;
        first_order: string;
        posOrders: number;
        onlineOrders: number;
        posSpent: number;
        onlineSpent: number;
        paymentCounts: Record<string, number>;
        itemMap: Map<string, { qty: number; unit: string; timesBought: number; totalSpent: number; cuts: Record<string, number> }>;
      };

      const map = new Map<string, TempCustomer>();

      for (const row of data ?? []) {
        const phone = (row.customer_phone || "").trim();
        if (!phone) continue;

        const isPos = row.fulfillment_type === "pos";
        const isPaid = row.status !== "cancelled";
        const orderTotal = isPaid ? Number(row.total || 0) : 0;
        const pm = (row.payment_method || (isPos ? "cash" : "cod")).toLowerCase();

        let cust = map.get(phone);
        if (!cust) {
          cust = {
            phone,
            name: (row.customer_name || "Guest Customer").trim(),
            orders: 0,
            spent: 0,
            last_order: row.created_at as string,
            first_order: row.created_at as string,
            posOrders: 0,
            onlineOrders: 0,
            posSpent: 0,
            onlineSpent: 0,
            paymentCounts: {},
            itemMap: new Map(),
          };
          map.set(phone, cust);
        }

        // Update name if earlier row had generic and this one has real name
        if (
          (!cust.name || cust.name.toLowerCase().includes("walk-in") || cust.name.toLowerCase().includes("guest")) &&
          row.customer_name &&
          !row.customer_name.toLowerCase().includes("walk-in")
        ) {
          cust.name = row.customer_name.trim();
        }

        cust.orders += 1;
        cust.spent += orderTotal;
        if (new Date(row.created_at).getTime() < new Date(cust.first_order).getTime()) {
          cust.first_order = row.created_at as string;
        }

        if (isPos) {
          cust.posOrders += 1;
          cust.posSpent += orderTotal;
        } else {
          cust.onlineOrders += 1;
          cust.onlineSpent += orderTotal;
        }

        cust.paymentCounts[pm] = (cust.paymentCounts[pm] || 0) + 1;

        // Process items purchased
        const itemsArr = Array.isArray(row.items) ? (row.items as any[]) : [];
        for (const it of itemsArr) {
          const itemName = (it.name || it.product_name || "Unknown Seafood").trim();
          if (!itemName) continue;
          const qty = Number(it.qty || it.weightKg || 1);
          const unit = it.unit || "kg";
          const itemPrice = Number(it.price || it.unitPrice || 0);
          const itemTotal = Number(it.totalPrice || it.line_total || qty * itemPrice);
          const cutStyle = it.cutting_style || it.cuttingStyle;

          const existingItem = cust.itemMap.get(itemName) || {
            qty: 0,
            unit,
            timesBought: 0,
            totalSpent: 0,
            cuts: {},
          };

          existingItem.qty += qty;
          existingItem.timesBought += 1;
          existingItem.totalSpent += itemTotal;
          if (cutStyle) {
            existingItem.cuts[cutStyle] = (existingItem.cuts[cutStyle] || 0) + 1;
          }
          cust.itemMap.set(itemName, existingItem);
        }
      }

      const now = Date.now();
      const result: CustomerRow[] = [];

      for (const cust of map.values()) {
        let channel: "online" | "pos" | "omnichannel" = "online";
        if (cust.posOrders > 0 && cust.onlineOrders > 0) {
          channel = "omnichannel";
        } else if (cust.posOrders > 0) {
          channel = "pos";
        }

        // Determine top items
        const sortedItems: CustomerItemSummary[] = [...cust.itemMap.entries()]
          .map(([name, stat]) => {
            let preferredCut: string | undefined;
            const cutEntries = Object.entries(stat.cuts);
            if (cutEntries.length > 0) {
              cutEntries.sort((a, b) => b[1] - a[1]);
              preferredCut = cutEntries[0][0];
            }
            return {
              name,
              qty: Math.round(stat.qty * 100) / 100,
              unit: stat.unit,
              timesBought: stat.timesBought,
              totalSpent: Math.round(stat.totalSpent),
              preferredCut,
            };
          })
          .sort((a, b) => b.totalSpent - a.totalSpent);

        // Determine preferred payment method
        const paymentEntries = Object.entries(cust.paymentCounts);
        paymentEntries.sort((a, b) => b[1] - a[1]);
        const preferredPayment = paymentEntries.length > 0 ? paymentEntries[0][0] : "cash";

        const daysSinceLastOrder = Math.max(
          0,
          Math.floor((now - new Date(cust.last_order).getTime()) / (1000 * 60 * 60 * 24))
        );

        result.push({
          phone: cust.phone,
          name: cust.name,
          orders: cust.orders,
          spent: cust.spent,
          last_order: cust.last_order,
          first_order: cust.first_order,
          channel,
          posOrders: cust.posOrders,
          onlineOrders: cust.onlineOrders,
          posSpent: cust.posSpent,
          onlineSpent: cust.onlineSpent,
          topItems: sortedItems,
          daysSinceLastOrder,
          preferredPayment,
          favoriteItemName: sortedItems[0]?.name,
        });
      }

      return result.sort((a, b) => b.spent - a.spent);
    },
  });
}

export const adminCustomersQuery = Object.assign(
  (branchId?: string | "all") => getAdminCustomersQuery(branchId),
  getAdminCustomersQuery("all")
);

export const adminSuspensionsQuery = queryOptions({
  queryKey: ["admin", "suspensions"],
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  queryFn: async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase.from("customer_suspensions").select("phone, reason");
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[row.phone] = row.reason || "Suspended";
    }
    return map;
  },
});

export type AppRole =
  | "admin"
  | "super_admin"
  | "staff"
  | "driver"
  | "user"
  | "cashier"
  | "inventory_manager"
  | "support_staff"
  | "manager";

export const DEV_ROLES_STORAGE_KEY = "fnf_dev_role_override";

export function getDevRoleOverride(): AppRole[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEV_ROLES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as AppRole[];
    }
  } catch {
    /* ignore parsing errors */
  }
  return null;
}

export function setDevRoleOverride(roles: AppRole[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEV_ROLES_STORAGE_KEY, JSON.stringify(roles));
}

export function clearDevRoleOverride(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEV_ROLES_STORAGE_KEY);
}

export const myRolesQuery = queryOptions({
  queryKey: ["admin", "my-roles"],
  staleTime: 1000 * 60 * 15, // 15 minutes fresh in-memory cache
  gcTime: 1000 * 60 * 60, // 1 hour garbage collection
  queryFn: async (): Promise<AppRole[]> => {
    // 1. Check if testing / developer override is active
    const override = getDevRoleOverride();
    if (override && override.length > 0) {
      return override;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) throw error;
    return (data ?? []).map((r) => r.role as AppRole);
  },
});

