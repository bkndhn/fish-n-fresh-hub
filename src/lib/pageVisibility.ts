import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Pages a store owner may switch off. Core pages (home, auth, admin dashboard, settings) are never listed. */
export const TOGGLEABLE_PAGES: { path: string; label: string; group: "Storefront" | "Admin" }[] = [
  { path: "/catalog", label: "Catalog", group: "Storefront" },
  { path: "/wishlist", label: "Saved / Wishlist", group: "Storefront" },
  { path: "/wholesale", label: "Wholesale portal", group: "Storefront" },
  { path: "/table", label: "Table QR ordering (diners)", group: "Storefront" },
  { path: "/track", label: "Order tracking", group: "Storefront" },
  { path: "/driver", label: "Driver app", group: "Storefront" },
  { path: "/admin/pos", label: "POS Counter", group: "Admin" },
  { path: "/admin/tables", label: "Table QRs", group: "Admin" },
  { path: "/admin/products", label: "Products", group: "Admin" },
  { path: "/admin/broadcasts", label: "Catch Alerts", group: "Admin" },
  { path: "/admin/purchases", label: "Purchases", group: "Admin" },
  { path: "/admin/waste", label: "Waste mgmt", group: "Admin" },
  { path: "/admin/expenses", label: "Expenses", group: "Admin" },
  { path: "/admin/banners", label: "Banners", group: "Admin" },
  { path: "/admin/collections", label: "Collections", group: "Admin" },
  { path: "/admin/customers", label: "Customers", group: "Admin" },
  { path: "/admin/promotions", label: "Promotions", group: "Admin" },
  { path: "/admin/pricing", label: "Dynamic Pricing", group: "Admin" },
  { path: "/admin/wholesale", label: "Wholesale admin", group: "Admin" },
  { path: "/admin/badges", label: "Home cards", group: "Admin" },
  { path: "/admin/reports", label: "Reports", group: "Admin" },
  { path: "/admin/gst-reports", label: "GST & Tax", group: "Admin" },
  { path: "/admin/payments", label: "Payments", group: "Admin" },
  { path: "/admin/delivery", label: "Delivery", group: "Admin" },
  { path: "/admin/returns", label: "Logistics & Returns", group: "Admin" },
  { path: "/admin/support", label: "Live Support", group: "Admin" },
  { path: "/admin/complaints", label: "Complaints", group: "Admin" },
  { path: "/admin/schedule", label: "Schedule", group: "Admin" },
  { path: "/admin/driver", label: "Driver map", group: "Admin" },
];

const ALLOWED = new Set(TOGGLEABLE_PAGES.map((p) => p.path));

export const disabledPagesQuery = queryOptions({
  queryKey: ["disabled_pages"],
  staleTime: 1000 * 60,
  queryFn: async (): Promise<string[]> => {
    const { data, error } = await (supabase as any).from("disabled_pages").select("path");
    if (error) return []; // table missing or offline → everything stays visible
    return (data ?? []).map((r: { path: string }) => r.path).filter((p: string) => ALLOWED.has(p));
  },
});

export function isPathDisabled(pathname: string, disabled: string[] | undefined): boolean {
  if (!disabled?.length) return false;
  return disabled.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function setPageDisabled(path: string, disabled: boolean) {
  if (!ALLOWED.has(path)) throw new Error("This page cannot be hidden");
  const t = (supabase as any).from("disabled_pages");
  const { error } = disabled ? await t.upsert({ path }) : await t.delete().eq("path", path);
  if (error) throw error;
}
