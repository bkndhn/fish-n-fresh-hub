import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Banner, Category, Product } from "./types";

const DEFAULT_VANJARAM_IMG = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";

function sanitizeProduct(p: Product): Product {
  if (
    p.name?.toLowerCase().includes("vanjaram") ||
    p.name?.toLowerCase().includes("seer fish")
  ) {
    if (!p.image_url || p.image_url.includes("photo-1611171711791-b34fa42e9fc4")) {
      p.image_url = DEFAULT_VANJARAM_IMG;
      // Persist to DB in background
      supabase
        .from("products")
        .update({ image_url: DEFAULT_VANJARAM_IMG })
        .eq("id", p.id)
        .then(() => {});
    }
  }
  return p;
}

export function getProductsQuery(branchId?: string) {
  const effectiveBranch = branchId || "all";
  return queryOptions({
    queryKey: ["products", effectiveBranch],
    staleTime: 1000 * 60 * 10, // 10 minutes fresh cache
    gcTime: 1000 * 60 * 60 * 24, // 24 hours persistence
    queryFn: async (): Promise<Product[]> => {
      // Categories to hide — chicken/poultry products excluded from seafood store
      const HIDDEN_CATEGORIES = [
        "Chicken & Meat",
        "Chicken",
        "Meat",
        "Poultry",
        "Country Chicken",
        "Nattu Kozhi",
      ];

      let q = supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .order("name");

      // Exclude all chicken/meat categories
      for (const cat of HIDDEN_CATEGORIES) {
        q = q.neq("category", cat);
      }

      if (branchId) {
        q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      const { data, error } = await q;
      if (error) throw error;
      const list = ((data ?? []) as unknown as Product[]).map(sanitizeProduct);

      // If branch has no products yet, fallback to all available products (still excluding hidden)
      if (branchId && list.length === 0) {
        let fallbackQ = supabase
          .from("products")
          .select("*")
          .eq("is_available", true)
          .order("name");
        for (const cat of HIDDEN_CATEGORIES) {
          fallbackQ = fallbackQ.neq("category", cat);
        }
        const { data: fallbackData } = await fallbackQ;
        return ((fallbackData ?? []) as unknown as Product[]).map(sanitizeProduct);
      }

      return list;
    },
  });
}

export const productsQuery = Object.assign(
  (branchId?: string) => getProductsQuery(branchId),
  getProductsQuery()
);

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 60 * 24,
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as unknown as Category[];
  },
});

export const bannersQuery = queryOptions({
  queryKey: ["banners"],
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 60 * 24,
  queryFn: async (): Promise<Banner[]> => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as unknown as Banner[];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["store_settings"],
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 60 * 24,
  queryFn: async () => {
    // Signed-out visitors read the public-safe view (no UPI ID, GSTIN, FSSAI or
    // integration keys). Signed-in staff/admins read the full settings row.
    const { data: sessionData } = await supabase.auth.getSession();
    const source = sessionData.session ? "store_settings" : "store_settings_public";
    const { data, error } = await supabase.from(source as "store_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },
});


export function productQuery(id: string) {
  return queryOptions({
    queryKey: ["product", id],
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      const res = (data ?? null) as unknown as Product | null;
      return res ? sanitizeProduct(res) : null;
    },
  });
}

export function ordersByPhoneQuery(phone: string) {
  return queryOptions({
    queryKey: ["orders", phone],
    enabled: phone.length >= 10,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_phone", phone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type TrustBadge = {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  active: boolean;
};

export const trustBadgesQuery = queryOptions({
  queryKey: ["trust_badges"],
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 60 * 24,
  queryFn: async (): Promise<TrustBadge[]> => {
    const { data, error } = await supabase
      .from("trust_badges")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as unknown as TrustBadge[];
  },
});

export const adminTrustBadgesQuery = queryOptions({
  queryKey: ["admin", "trust_badges"],
  staleTime: 1000 * 60 * 15,
  gcTime: 1000 * 60 * 60 * 24,
  queryFn: async (): Promise<TrustBadge[]> => {
    const { data, error } = await supabase.from("trust_badges").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as unknown as TrustBadge[];
  },
});
