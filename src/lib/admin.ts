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

export type CustomerRow = {
  phone: string;
  name: string;
  orders: number;
  spent: number;
  last_order: string;
};

export function getAdminCustomersQuery(branchId?: string | "all") {
  const effectiveBranch = typeof branchId === "string" ? branchId : "all";
  return queryOptions({
    queryKey: ["admin", "customers", effectiveBranch],
    queryFn: async (): Promise<CustomerRow[]> => {
      let q = supabase
        .from("orders")
        .select("customer_name, customer_phone, total, created_at, status, branch_id")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (effectiveBranch !== "all") {
        q = q.eq("branch_id", effectiveBranch);
      }

      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, CustomerRow>();
      for (const row of data ?? []) {
        const key = row.customer_phone;
        const existing = map.get(key);
        if (existing) {
          existing.orders += 1;
          if (row.status !== "cancelled") existing.spent += Number(row.total);
        } else {
          map.set(key, {
            phone: key,
            name: row.customer_name,
            orders: 1,
            spent: row.status === "cancelled" ? 0 : Number(row.total),
            last_order: row.created_at as string,
          });
        }
      }
      return [...map.values()].sort((a, b) => b.spent - a.spent);
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

