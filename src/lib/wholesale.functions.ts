import { createServerFn } from "@tanstack/react-start";
import { requireAdmin, requireUser, getCallerUserId } from "@/lib/authz.server";
import type { WholesaleAccount, WholesaleBand } from "@/lib/wholesale";


const ACCOUNT_FIELDS =
  "id, user_id, business_name, contact_name, phone, email, gstin, address, status, extra_discount_percent, credit_limit, notes, created_at";

export type WholesaleStatus = {
  isWholesale: boolean;
  status: string | null;
  account: WholesaleAccount | null;
};

/** The signed-in buyer's own trade account (if any). */
export const getMyWholesaleAccount = createServerFn({ method: "GET" }).handler(
  async (): Promise<WholesaleStatus> => {
    const userId = await getCallerUserId();
    if (!userId) return { isWholesale: false, status: null, account: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("wholesale_accounts")
      .select(ACCOUNT_FIELDS)
      .eq("user_id", userId)
      .maybeSingle();
    const account = (data as unknown as WholesaleAccount) ?? null;
    return {
      isWholesale: account?.status === "approved",
      status: account?.status ?? null,
      account,
    };
  },
);

/** A retail shop applies for wholesale rates. Always starts as pending. */
export const applyForWholesale = createServerFn({ method: "POST" })
  .inputValidator((input: { business_name: string; contact_name?: string; phone: string; email?: string; gstin?: string; address?: string }) => {
    const business_name = String(input?.business_name ?? "").trim();
    const phone = String(input?.phone ?? "").replace(/\D/g, "");
    if (business_name.length < 3) throw new Error("Enter your shop name");
    if (phone.length < 10) throw new Error("Enter a 10-digit phone number");
    return {
      business_name,
      contact_name: String(input?.contact_name ?? "").trim() || null,
      phone: phone.slice(-10),
      email: String(input?.email ?? "").trim() || null,
      gstin: String(input?.gstin ?? "").trim().toUpperCase() || null,
      address: String(input?.address ?? "").trim() || null,
    };
  })
  .handler(async ({ data }) => {
    const userId = await requireUser();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("wholesale_accounts")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("wholesale_accounts")
        .update({ ...data } as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { success: true, status: existing.status as string };
    }

    const { error } = await supabaseAdmin
      .from("wholesale_accounts")
      .insert({ ...data, user_id: userId, status: "pending" } as never);
    if (error) throw new Error(error.message);
    return { success: true, status: "pending" };
  });

/** Admin: every trade account, newest first. */
export const listWholesaleAccounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<WholesaleAccount[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("wholesale_accounts")
      .select(ACCOUNT_FIELDS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as WholesaleAccount[];
  },
);

/** Admin: approve, reject or adjust a trade account. */
export const updateWholesaleAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status?: string; extra_discount_percent?: number; credit_limit?: number; notes?: string }) => {
    const id = String(input?.id ?? "");
    if (!id) throw new Error("Missing account");
    const allowed = ["pending", "approved", "rejected", "suspended"];
    const patch: Record<string, unknown> = {};
    if (input.status) {
      if (!allowed.includes(input.status)) throw new Error("Invalid status");
      patch["status"] = input.status;
    }
    if (input.extra_discount_percent != null) {
      patch["extra_discount_percent"] = Math.min(Math.max(Number(input.extra_discount_percent) || 0, 0), 50);
    }
    if (input.credit_limit != null) {
      patch["credit_limit"] = Math.max(Number(input.credit_limit) || 0, 0);
    }
    if (input.notes != null) patch["notes"] = String(input.notes).slice(0, 500);
    return { id, patch };
  })
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = { ...data.patch } as Record<string, unknown>;
    if (patch["status"] === "approved") {
      patch["approved_by"] = userId;
      patch["approved_at"] = new Date().toISOString();
    }
    const { error } = await supabaseAdmin
      .from("wholesale_accounts")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export type WholesalePriceRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  price: number;
  wholesale_price: number | null;
  wholesale_min_qty: number;
  wholesale_tiers: { min_qty: number; price: number }[];
};

/** The wholesale price list for the current catalogue (admin view). */
export const listWholesalePrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<WholesalePriceRow[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, name, category, unit, price, wholesale_price, wholesale_min_qty, wholesale_tiers")
      .eq("is_available", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as WholesalePriceRow[];
  },
);

/** Admin: save a product's wholesale rate and bulk tiers. */
export const saveWholesalePrice = createServerFn({ method: "POST" })
  .inputValidator((input: { productId: string; wholesale_price: number | null; wholesale_min_qty: number; tiers: { min_qty: number; price: number }[] }) => {
    const productId = String(input?.productId ?? "");
    if (!productId) throw new Error("Missing product");
    const tiers = (input.tiers ?? [])
      .map((t) => ({ min_qty: Math.max(0, Number(t.min_qty) || 0), price: Math.max(0, Number(t.price) || 0) }))
      .filter((t) => t.price > 0)
      .sort((a, b) => a.min_qty - b.min_qty)
      .slice(0, 6);
    const wp = input.wholesale_price == null || Number(input.wholesale_price) <= 0 ? null : Number(input.wholesale_price);
    return {
      productId,
      wholesale_price: wp,
      wholesale_min_qty: Math.max(0, Number(input.wholesale_min_qty) || 0),
      tiers,
    };
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("products")
      .update({
        wholesale_price: data.wholesale_price,
        wholesale_min_qty: data.wholesale_min_qty,
        wholesale_tiers: data.tiers,
      } as never)
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
