import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Branch {
  id: string;
  name: string;
  slug: string;
  code: string;
  address: string | null;
  phone: string | null;
  manager: string | null;
  manager_user_id: string | null;
  lat: number | null;
  lng: number | null;
  open_time: string | null;
  close_time: string | null;
  delivery_radius_km: number;
  is_active: boolean;
  is_default: boolean;
  gstin: string | null;
  fssai_license: string | null;
  upi_id: string | null;
  min_order_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BranchManagerPermissions {
  can_manage_inventory: boolean;
  can_edit_prices: boolean;
  can_manage_local_staff: boolean;
  can_view_financial_reports: boolean;
  can_dispatch_drivers: boolean;
  can_modify_store_hours: boolean;
  has_full_branch_access: boolean;
}

export const DEFAULT_MANAGER_PERMISSIONS: BranchManagerPermissions = {
  can_manage_inventory: true,
  can_edit_prices: false,
  can_manage_local_staff: false,
  can_view_financial_reports: true,
  can_dispatch_drivers: true,
  can_modify_store_hours: false,
  has_full_branch_access: false,
};

export const FULL_MANAGER_PERMISSIONS: BranchManagerPermissions = {
  can_manage_inventory: true,
  can_edit_prices: true,
  can_manage_local_staff: true,
  can_view_financial_reports: true,
  can_dispatch_drivers: true,
  can_modify_store_hours: true,
  has_full_branch_access: true,
};

/**
 * Normalizes branch data with safe defaults for backwards-compatibility.
 */
export function normalizeBranch(raw: Partial<Branch>): Branch {
  const name = raw.name || "Main Branch";
  const slug = raw.slug || generateBranchSlug(name);
  const code = raw.code || generateBranchCode(name);

  return {
    id: raw.id || "",
    name,
    slug,
    code,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    manager: raw.manager ?? null,
    manager_user_id: raw.manager_user_id ?? null,
    lat: raw.lat !== undefined && raw.lat !== null ? Number(raw.lat) : null,
    lng: raw.lng !== undefined && raw.lng !== null ? Number(raw.lng) : null,
    open_time: raw.open_time ?? "06:00",
    close_time: raw.close_time ?? "21:00",
    delivery_radius_km: raw.delivery_radius_km ? Number(raw.delivery_radius_km) : 12,
    is_active: raw.is_active ?? true,
    is_default: raw.is_default ?? false,
    gstin: raw.gstin ?? null,
    fssai_license: raw.fssai_license ?? null,
    upi_id: raw.upi_id ?? null,
    min_order_amount: raw.min_order_amount ? Number(raw.min_order_amount) : 0,
    sort_order: raw.sort_order ? Number(raw.sort_order) : 1,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

/**
 * Generates an SEO & URL friendly slug from a branch title.
 */
export function generateBranchSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates a standard 3-character uppercase alphanumeric store code.
 */
export function generateBranchCode(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "HUB").padEnd(3, "X");
}

/**
 * Computes geodesic distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Finds the nearest active branch for given customer GPS coordinates.
 */
export function findNearestBranch(
  branches: Branch[],
  userLat: number,
  userLng: number
): { branch: Branch; distanceKm: number; isWithinDeliveryRadius: boolean } | null {
  const activeBranches = branches.filter((b) => b.is_active && b.lat !== null && b.lng !== null);
  if (!activeBranches.length) return null;

  let nearest: Branch = activeBranches[0]!;
  let minDistance = calculateDistanceKm(userLat, userLng, nearest.lat!, nearest.lng!);

  for (let i = 1; i < activeBranches.length; i++) {
    const b = activeBranches[i]!;
    const dist = calculateDistanceKm(userLat, userLng, b.lat!, b.lng!);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = b;
    }
  }

  return {
    branch: nearest,
    distanceKm: minDistance,
    isWithinDeliveryRadius: minDistance <= (nearest.delivery_radius_km || 12),
  };
}

/**
 * Resolves the flagship/default branch, with graceful fallback to the first active branch.
 */
export function getDefaultBranch(branches: Branch[]): Branch | null {
  if (!branches.length) return null;
  return (
    branches.find((b) => b.is_active && b.is_default) ||
    branches.find((b) => b.is_active) ||
    branches[0] ||
    null
  );
}

/**
 * Resolves a branch by URL slug or code.
 */
export function resolveBranchBySlug(branches: Branch[], slugOrCode: string): Branch | null {
  if (!slugOrCode) return null;
  const normalized = slugOrCode.toLowerCase().trim();
  return (
    branches.find((b) => b.slug.toLowerCase() === normalized) ||
    branches.find((b) => b.code.toLowerCase() === normalized) ||
    null
  );
}

/**
 * Validates whether cart items belong to the targeted branch, preventing cross-branch orders.
 */
export function validateCartForBranch(
  items: Array<{ product_id?: string; branch_id?: string | null }>,
  targetBranchId: string
): { isValid: boolean; mismatchedCount: number } {
  if (!items.length || !targetBranchId) return { isValid: true, mismatchedCount: 0 };
  const mismatched = items.filter((item) => item.branch_id && item.branch_id !== targetBranchId);
  return {
    isValid: mismatched.length === 0,
    mismatchedCount: mismatched.length,
  };
}

/**
 * TanStack query options to fetch all branches ordered by priority.
 */
export const branchesQuery = queryOptions({
  queryKey: ["branches", "all"],
  queryFn: async (): Promise<Branch[]> => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(normalizeBranch);
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
});

/**
 * TanStack query options to fetch active public branches.
 */
export const activeBranchesQuery = queryOptions({
  queryKey: ["branches", "active"],
  queryFn: async (): Promise<Branch[]> => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(normalizeBranch);
  },
  staleTime: 1000 * 60 * 5,
});
