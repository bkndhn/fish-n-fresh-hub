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
  driver_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  upi_paid: boolean;
  notes: string | null;
  eta_minutes: number | null;
  delivery_note: string | null;
  payment_status: string;
  created_at: string;
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
  queryFn: async () => {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) throw error;
    return Boolean(data);
  },
});

export const adminOrdersQuery = queryOptions({
  queryKey: ["admin", "orders"],
  queryFn: async (): Promise<OrderRow[]> => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as unknown as OrderRow[];
  },
});

export const adminProductsQuery = queryOptions({
  queryKey: ["admin", "products"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as unknown as Product[];
  },
});

export const adminPromotionsQuery = queryOptions({
  queryKey: ["admin", "promotions"],
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

export const adminCustomersQuery = queryOptions({
  queryKey: ["admin", "customers"],
  queryFn: async (): Promise<CustomerRow[]> => {
    const { data, error } = await supabase
      .from("orders")
      .select("customer_name, customer_phone, total, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1000);
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

export type AppRole = "admin" | "staff" | "driver" | "user";

export const myRolesQuery = queryOptions({
  queryKey: ["admin", "my-roles"],
  queryFn: async (): Promise<AppRole[]> => {
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) throw error;
    return (data ?? []).map((r) => r.role as AppRole);
  },
});
