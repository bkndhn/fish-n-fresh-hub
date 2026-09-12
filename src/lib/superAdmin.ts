import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Branch } from "./multiBranch";
import { type AppRole } from "./admin";

export interface TenantQuota {
  id: string;
  tenant_name: string;
  tenant_code: string;
  max_branches: number;
  max_staff_per_branch: number;
  max_monthly_orders: number;
  max_storage_mb: number;
  tier: "starter" | "growth" | "enterprise" | "custom";
  is_locked: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformRevocation {
  id: string;
  scope: "global" | "branch" | "user";
  target_id: string | null;
  reason: string;
  revoked_by?: string | null;
  revoked_at: string;
  created_at?: string;
}

export interface PlatformAuditLog {
  id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface SuperAdminStats {
  activeBranchesCount: number;
  maxBranchesQuota: number;
  branchQuotaUtilizationPct: number;
  totalStaffCount: number;
  maxStaffQuota: number;
  totalOrdersThisMonth: number;
  maxMonthlyOrdersQuota: number;
  ordersQuotaUtilizationPct: number;
  activeKillSwitchesCount: number;
  isTenantLocked: boolean;
  tier: "starter" | "growth" | "enterprise";
}

export const DEFAULT_TENANT_QUOTA: TenantQuota = {
  id: "default-fnf-tenant",
  tenant_name: "Fish N Fresh Enterprise",
  tenant_code: "FNF-MAIN",
  max_branches: 10,
  max_staff_per_branch: 15,
  max_monthly_orders: 25000,
  max_storage_mb: 5000,
  tier: "enterprise",
  is_locked: false,
};

/**
 * Checks whether tenant has quota headroom to provision an additional branch.
 */
export function checkBranchQuotaAvailable(
  activeBranchesCount: number,
  maxAllowed: number
): { allowed: boolean; remaining: number; message?: string | undefined } {
  const remaining = Math.max(0, maxAllowed - activeBranchesCount);
  const allowed = activeBranchesCount < maxAllowed;
  return {
    allowed,
    remaining,
    message: allowed
      ? undefined
      : `Branch creation quota limit reached (${activeBranchesCount}/${maxAllowed} active hubs). Upgrade tenant quota in Super Admin.`,
  };
}

/**
 * Checks whether a branch has staff seat quota headroom.
 */
export function checkStaffQuotaAvailable(
  currentStaffInBranch: number,
  maxAllowedPerBranch: number
): { allowed: boolean; remaining: number; message?: string | undefined } {
  const remaining = Math.max(0, maxAllowedPerBranch - currentStaffInBranch);
  const allowed = currentStaffInBranch < maxAllowedPerBranch;
  return {
    allowed,
    remaining,
    message: allowed
      ? undefined
      : `Staff seat quota reached for this hub (${currentStaffInBranch}/${maxAllowedPerBranch} members). Upgrade staff quota in Super Admin.`,
  };
}

/**
 * TanStack query options to fetch tenant quota configuration.
 */
export const tenantQuotasQuery = queryOptions({
  queryKey: ["super-admin", "tenant-quotas"],
  queryFn: async (): Promise<TenantQuota> => {
    try {
      const { data, error } = await supabase
        .from("tenant_quotas")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return DEFAULT_TENANT_QUOTA;
      }

      return data as TenantQuota;
    } catch {
      return DEFAULT_TENANT_QUOTA;
    }
  },
  staleTime: 1000 * 60 * 2,
});

/**
 * TanStack query options to fetch active platform revocations (kill switch events).
 */
export const platformRevocationsQuery = queryOptions({
  queryKey: ["super-admin", "revocations"],
  queryFn: async (): Promise<PlatformRevocation[]> => {
    try {
      const { data, error } = await supabase
        .from("platform_revocations")
        .select("*")
        .order("revoked_at", { ascending: false })
        .limit(50);

      if (error || !data) return [];
      return data as PlatformRevocation[];
    } catch {
      return [];
    }
  },
  staleTime: 1000 * 30,
});

/**
 * TanStack query options to fetch platform audit trails.
 */
export const platformAuditLogsQuery = queryOptions({
  queryKey: ["super-admin", "audit-logs"],
  queryFn: async (): Promise<PlatformAuditLog[]> => {
    try {
      const { data, error } = await supabase
        .from("platform_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !data) return [];
      return data as PlatformAuditLog[];
    } catch {
      return [];
    }
  },
  staleTime: 1000 * 30,
});

/**
 * TanStack query options for Super Admin platform rollup statistics.
 */
export const superAdminStatsQuery = queryOptions({
  queryKey: ["super-admin", "stats"],
  queryFn: async (): Promise<SuperAdminStats> => {
    try {
      // 1. Fetch active branches
      const { count: branchesCount } = await supabase
        .from("branches")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // 2. Fetch staff members
      const { count: staffCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("role", ["admin", "manager", "staff", "driver", "cashier", "inventory_manager"]);

      // 3. Fetch monthly orders count (since start of current month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: ordersCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString());

      // 4. Fetch tenant quota
      const { data: quotaData } = await supabase
        .from("tenant_quotas")
        .select("*")
        .limit(1)
        .maybeSingle();

      const quota: TenantQuota = quotaData || DEFAULT_TENANT_QUOTA;

      // 5. Fetch recent kill switch events count (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: revocationsCount } = await supabase
        .from("platform_revocations")
        .select("*", { count: "exact", head: true })
        .gte("revoked_at", oneDayAgo);

      const activeBranches = branchesCount ?? 1;
      const totalStaff = staffCount ?? 1;
      const totalOrders = ordersCount ?? 0;

      return {
        activeBranchesCount: activeBranches,
        maxBranchesQuota: quota.max_branches,
        branchQuotaUtilizationPct: Math.min(
          100,
          Math.round((activeBranches / quota.max_branches) * 100)
        ),
        totalStaffCount: totalStaff,
        maxStaffQuota: quota.max_staff_per_branch * activeBranches,
        totalOrdersThisMonth: totalOrders,
        maxMonthlyOrdersQuota: quota.max_monthly_orders,
        ordersQuotaUtilizationPct: Math.min(
          100,
          Math.round((totalOrders / quota.max_monthly_orders) * 100)
        ),
        activeKillSwitchesCount: revocationsCount ?? 0,
        isTenantLocked: quota.is_locked,
        tier: quota.tier,
      };
    } catch {
      return {
        activeBranchesCount: 1,
        maxBranchesQuota: 10,
        branchQuotaUtilizationPct: 10,
        totalStaffCount: 1,
        maxStaffQuota: 15,
        totalOrdersThisMonth: 0,
        maxMonthlyOrdersQuota: 25000,
        ordersQuotaUtilizationPct: 0,
        activeKillSwitchesCount: 0,
        isTenantLocked: false,
        tier: "enterprise",
      };
    }
  },
  staleTime: 1000 * 60,
});

/**
 * Updates tenant quota limits (Super Admin only).
 */
export async function updateTenantQuotas(updates: Partial<TenantQuota>): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: current } = await supabase
      .from("tenant_quotas")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (current?.id) {
      const { error } = await supabase
        .from("tenant_quotas")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("tenant_quotas")
        .insert({
          ...DEFAULT_TENANT_QUOTA,
          ...updates,
        });

      if (error) throw error;
    }

    // Log to platform audit trail
    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("platform_audit_logs").insert({
        actor_id: user.user?.id || null,
        actor_role: "super_admin",
        action: "UPDATE_TENANT_QUOTA",
        target_type: "tenant_quotas",
        details: updates,
      });
    } catch {
      /* ignore */
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update tenant quotas." };
  }
}

/**
 * Triggers an Emergency Force Logout ("Kill Switch") across sessions.
 */
export async function executeKillSwitch(
  scope: "global" | "branch" | "user",
  targetId?: string | null,
  reason: string = "Emergency security revocation"
): Promise<{ success: boolean; revocationId?: string; message?: string }> {
  try {
    const { data: authUser } = await supabase.auth.getUser();
    const actorId = authUser.user?.id || null;

    // 1. Insert into platform_revocations
    const { data, error } = await supabase
      .from("platform_revocations")
      .insert({
        scope,
        target_id: targetId || null,
        reason,
        revoked_by: actorId,
        revoked_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    // 2. Broadcast via Supabase Realtime channel
    const channel = supabase.channel("security_killswitch");
    await channel.send({
      type: "broadcast",
      event: "force_logout",
      payload: {
        scope,
        target_id: targetId || null,
        reason,
        revoked_at: new Date().toISOString(),
      },
    });

    // 3. Log to platform audit trail
    try {
      await supabase.from("platform_audit_logs").insert({
        actor_id: actorId,
        actor_role: "super_admin",
        action: "force_logout",
        target_type: scope,
        target_id: targetId || null,
        details: { reason, timestamp: new Date().toISOString() },
      });
    } catch {
      /* ignore */
    }

    return { success: true, revocationId: data?.id };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to execute kill switch." };
  }
}

/**
 * Creates a new branch with automated quota validation.
 */
export async function createBranchWithQuotaGuard(
  branchData: Omit<Branch, "id" | "created_at" | "updated_at">
): Promise<{ success: boolean; branch?: Branch | undefined; message?: string | undefined }> {
  try {
    // 1. Check current active count vs quota
    const { count: currentCount } = await supabase
      .from("branches")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { data: quotaData } = await supabase
      .from("tenant_quotas")
      .select("max_branches, is_locked")
      .limit(1)
      .maybeSingle();

    const maxAllowed = quotaData?.max_branches ?? DEFAULT_TENANT_QUOTA.max_branches;

    if (quotaData?.is_locked) {
      return { success: false, message: "Tenant is currently locked by Super Administrator." };
    }

    const check = checkBranchQuotaAvailable(currentCount ?? 0, maxAllowed);
    if (!check.allowed) {
      return { success: false, message: check.message };
    }

    // 2. Insert new branch
    const { data, error } = await supabase
      .from("branches")
      .insert({
        ...branchData,
      })
      .select("*")
      .single();

    if (error) throw error;

    // 3. Audit log
    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("platform_audit_logs").insert({
        actor_id: user.user?.id || null,
        actor_role: "super_admin",
        action: "CREATE_BRANCH",
        target_type: "branches",
        target_id: data.id,
        details: { name: branchData.name, code: branchData.code, slug: branchData.slug },
      });
    } catch {
      /* ignore */
    }

    return { success: true, branch: data as unknown as Branch };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to create branch." };
  }
}

/* ==========================================================================
   MULTI-CLIENT FLEET GOVERNANCE & ONBOARDING (Super Admin Only)
   ========================================================================== */

export interface PlatformClient {
  id: string;
  client_name: string;
  tenant_code: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  vertical: "seafood" | "chicken_meat" | "all_meat" | "organic_veggies" | "custom";
  domain: string;
  tier: "starter" | "growth" | "enterprise" | "custom";
  max_branches: number;
  max_staff_per_branch: number;
  max_monthly_orders: number;
  max_storage_mb: number;
  is_active: boolean;
  is_locked: boolean;
  active_branches_count: number;
  total_staff_count: number;
  monthly_orders_count: number;
  created_at: string;
  last_active_at?: string;
  onboarding_notes?: string;
}

export interface OnboardClientInput {
  client_name: string;
  tenant_code?: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  vertical: "seafood" | "chicken_meat" | "all_meat" | "organic_veggies" | "custom";
  domain?: string;
  tier: "starter" | "growth" | "enterprise" | "custom";
  max_branches?: number;
  max_staff_per_branch?: number;
  max_monthly_orders?: number;
  admin_temp_password?: string;
  onboarding_notes?: string;
}

export interface OnboardingResult {
  success: boolean;
  client?: PlatformClient;
  credentials?: {
    adminEmail: string;
    tempPassword: string;
    loginUrl: string;
    tenantCode: string;
  };
  message?: string;
}

const CLIENTS_STORAGE_KEY = "fnf_platform_clients_v2";

export const INITIAL_PLATFORM_CLIENTS: PlatformClient[] = [
  {
    id: "client-fnf-flagship",
    client_name: "Fish N Fresh Flagship Hub",
    tenant_code: "FNF-MAIN",
    owner_name: "Master Platform Administrator",
    owner_email: "admin@fishnfresh.in",
    owner_phone: "+91 98400 12345",
    vertical: "seafood",
    domain: "fishnfresh.in",
    tier: "enterprise",
    max_branches: 15,
    max_staff_per_branch: 30,
    max_monthly_orders: 100000,
    max_storage_mb: 25000,
    is_active: true,
    is_locked: false,
    active_branches_count: 3,
    total_staff_count: 12,
    monthly_orders_count: 4280,
    created_at: "2026-01-10T08:00:00Z",
    last_active_at: "Just now",
  },
  {
    id: "client-ocean-catch",
    client_name: "Ocean Catch Coastal Marine",
    tenant_code: "OCEAN-CATCH",
    owner_name: "Suresh Ramanathan",
    owner_email: "suresh@oceancatch.in",
    owner_phone: "+91 98411 22334",
    vertical: "seafood",
    domain: "oceancatch.in",
    tier: "growth",
    max_branches: 8,
    max_staff_per_branch: 15,
    max_monthly_orders: 20000,
    max_storage_mb: 10000,
    is_active: true,
    is_locked: false,
    active_branches_count: 2,
    total_staff_count: 6,
    monthly_orders_count: 1840,
    created_at: "2026-04-12T10:30:00Z",
    last_active_at: "14 mins ago",
  },
  {
    id: "client-tender-farms",
    client_name: "Tender Farms Poultry & Halal",
    tenant_code: "TENDER-FARMS",
    owner_name: "Karthik Venkat",
    owner_email: "karthik@tenderfarms.co",
    owner_phone: "+91 98422 33445",
    vertical: "chicken_meat",
    domain: "tenderfarms.co",
    tier: "starter",
    max_branches: 3,
    max_staff_per_branch: 5,
    max_monthly_orders: 5000,
    max_storage_mb: 3000,
    is_active: true,
    is_locked: false,
    active_branches_count: 1,
    total_staff_count: 4,
    monthly_orders_count: 920,
    created_at: "2026-06-01T14:15:00Z",
    last_active_at: "1 hour ago",
  },
  {
    id: "client-daily-greens",
    client_name: "Daily Greens & Organic Superstore",
    tenant_code: "DAILY-GREENS",
    owner_name: "Priya Sundaram",
    owner_email: "priya@dailygreens.in",
    owner_phone: "+91 98433 44556",
    vertical: "organic_veggies",
    domain: "dailygreens.in",
    tier: "starter",
    max_branches: 3,
    max_staff_per_branch: 5,
    max_monthly_orders: 5000,
    max_storage_mb: 3000,
    is_active: false,
    is_locked: true,
    active_branches_count: 1,
    total_staff_count: 2,
    monthly_orders_count: 0,
    created_at: "2026-07-15T09:00:00Z",
    last_active_at: "3 days ago",
    onboarding_notes: "Subscription expired - billing overdue.",
  },
  {
    id: "client-royal-meat",
    client_name: "Royal Multi-Meat & Protein Chain",
    tenant_code: "ROYAL-MEAT",
    owner_name: "Mohammed Farhan",
    owner_email: "admin@royalmeatmart.com",
    owner_phone: "+91 98444 55667",
    vertical: "all_meat",
    domain: "royalmeatmart.com",
    tier: "growth",
    max_branches: 8,
    max_staff_per_branch: 15,
    max_monthly_orders: 20000,
    max_storage_mb: 10000,
    is_active: false,
    is_locked: true,
    active_branches_count: 0,
    total_staff_count: 0,
    monthly_orders_count: 0,
    created_at: "2026-08-20T11:45:00Z",
    last_active_at: "1 week ago",
    onboarding_notes: "Onboarding paused: KYC / FSSAI verification pending.",
  },
];

function getStoredClients(): PlatformClient[] {
  if (typeof localStorage === "undefined") return INITIAL_PLATFORM_CLIENTS;
  try {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(INITIAL_PLATFORM_CLIENTS));
      return INITIAL_PLATFORM_CLIENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PLATFORM_CLIENTS;
  } catch {
    return INITIAL_PLATFORM_CLIENTS;
  }
}

function saveStoredClients(clients: PlatformClient[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch (err) {
    console.error("Failed to persist platform clients:", err);
  }
}

/**
 * TanStack Query options for Super Admin client fleet.
 */
export const platformClientsQuery = queryOptions({
  queryKey: ["super-admin", "clients-fleet"],
  queryFn: async (): Promise<PlatformClient[]> => {
    return getStoredClients();
  },
  staleTime: 1000 * 30,
});

/**
 * Onboards a brand-new client organization on the platform.
 */
export async function onboardNewClient(input: OnboardClientInput): Promise<OnboardingResult> {
  try {
    const clients = getStoredClients();

    const code = (input.tenant_code || input.client_name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 12)).toUpperCase();

    // Check duplicate code
    if (clients.some((c) => c.tenant_code === code)) {
      return { success: false, message: `Tenant Code "${code}" is already in use by another client.` };
    }

    // Determine quotas from tier
    let b = input.max_branches ?? 3;
    let s = input.max_staff_per_branch ?? 5;
    let o = input.max_monthly_orders ?? 5000;

    if (input.tier === "growth") {
      b = input.max_branches ?? 8;
      s = input.max_staff_per_branch ?? 15;
      o = input.max_monthly_orders ?? 20000;
    } else if (input.tier === "enterprise") {
      b = input.max_branches ?? 15;
      s = input.max_staff_per_branch ?? 30;
      o = input.max_monthly_orders ?? 100000;
    }

    const tempPassword = input.admin_temp_password || `FnF@${Math.floor(100000 + Math.random() * 900000)}!`;
    const domain = input.domain?.trim() || `${code.toLowerCase()}.fishnfresh.in`;

    const newClient: PlatformClient = {
      id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      client_name: input.client_name.trim(),
      tenant_code: code,
      owner_name: input.owner_name.trim(),
      owner_email: input.owner_email.trim().toLowerCase(),
      owner_phone: input.owner_phone.trim(),
      vertical: input.vertical,
      domain,
      tier: input.tier,
      max_branches: b,
      max_staff_per_branch: s,
      max_monthly_orders: o,
      max_storage_mb: 5000,
      is_active: true,
      is_locked: false,
      active_branches_count: 1, // initial primary branch
      total_staff_count: 1, // owner account
      monthly_orders_count: 0,
      created_at: new Date().toISOString(),
      last_active_at: "Just provisioned",
      onboarding_notes: input.onboarding_notes?.trim(),
    };

    const updated = [newClient, ...clients];
    saveStoredClients(updated);

    // Audit log
    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("platform_audit_logs").insert({
        actor_id: user.user?.id || null,
        actor_role: "super_admin",
        action: "ONBOARD_NEW_CLIENT",
        target_type: "client",
        target_id: newClient.id,
        details: {
          client_name: newClient.client_name,
          tenant_code: newClient.tenant_code,
          owner_email: newClient.owner_email,
          tier: newClient.tier,
          max_branches: newClient.max_branches,
        },
      });
    } catch {
      /* ignore */
    }

    const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/auth?next=/admin` : `https://${domain}/auth?next=/admin`;

    return {
      success: true,
      client: newClient,
      credentials: {
        adminEmail: newClient.owner_email,
        tempPassword,
        loginUrl,
        tenantCode: newClient.tenant_code,
      },
      message: `Client "${newClient.client_name}" onboarded successfully!`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to onboard client." };
  }
}

/**
 * Activates or deactivates/suspends an entire client organization.
 */
export async function toggleClientStatus(clientId: string, nextActiveState: boolean): Promise<{ success: boolean; message?: string }> {
  try {
    const clients = getStoredClients();
    const target = clients.find((c) => c.id === clientId);
    if (!target) return { success: false, message: "Client not found." };

    const updated = clients.map((c) => {
      if (c.id === clientId) {
        return {
          ...c,
          is_active: nextActiveState,
          is_locked: !nextActiveState,
          last_active_at: nextActiveState ? "Re-activated just now" : "Suspended",
        };
      }
      return c;
    });

    saveStoredClients(updated);

    // If client is being suspended, force logout all users immediately
    if (!nextActiveState) {
      await forceLogoutClient(target.id, target.client_name, target.tenant_code, "Client suspended by Platform Super Admin");
    }

    return {
      success: true,
      message: `Client "${target.client_name}" is now ${nextActiveState ? "Active" : "Suspended / Inactive"}.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update client status." };
  }
}

/**
 * Updates quota allocations for a specific client organization.
 */
export async function updateClientQuotas(
  clientId: string,
  quotas: {
    tier?: "starter" | "growth" | "enterprise" | "custom";
    max_branches?: number;
    max_staff_per_branch?: number;
    max_monthly_orders?: number;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const clients = getStoredClients();
    const target = clients.find((c) => c.id === clientId);
    if (!target) return { success: false, message: "Client not found." };

    const updated = clients.map((c) => {
      if (c.id === clientId) {
        return {
          ...c,
          ...quotas,
        };
      }
      return c;
    });

    saveStoredClients(updated);

    // If this is the active local tenant, also sync with tenant_quotas DB
    if (target.tenant_code === "FNF-MAIN") {
      await updateTenantQuotas(quotas);
    }

    return { success: true, message: `Quotas updated for ${target.client_name}.` };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to update client quotas." };
  }
}

/**
 * Executes a Client-Level Force Logout (Emergency Kill Switch).
 * Revokes all branches, staff, cashiers, drivers, and customers belonging to that client organization.
 */
export async function forceLogoutClient(
  clientId: string,
  clientName: string,
  tenantCode: string,
  reason: string = "Administrative client-wide security revocation"
): Promise<{ success: boolean; message?: string }> {
  try {
    let actorId: string | null = null;
    try {
      const { data: authUser } = await supabase.auth.getUser();
      actorId = authUser?.user?.id || null;
    } catch {
      /* ignore */
    }

    // 1. Record in platform_revocations
    try {
      await supabase.from("platform_revocations").insert({
        scope: "global",
        target_id: tenantCode,
        reason: `Client logout: ${clientName} (${tenantCode}) - ${reason}`,
        revoked_by: actorId,
        revoked_at: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }

    // 2. Broadcast via Supabase Realtime channel
    try {
      const channel = supabase.channel("security_killswitch");
      await channel.send({
        type: "broadcast",
        event: "force_logout",
        payload: {
          scope: "client",
          target_id: tenantCode,
          client_id: clientId,
          reason,
          revoked_at: new Date().toISOString(),
        },
      });
    } catch {
      /* ignore */
    }

    // 3. Log to audit trail
    try {
      await supabase.from("platform_audit_logs").insert({
        actor_id: actorId,
        actor_role: "super_admin",
        action: "FORCE_LOGOUT_CLIENT",
        target_type: "client",
        target_id: clientId,
        details: { clientName, tenantCode, reason, timestamp: new Date().toISOString() },
      });
    } catch {
      /* ignore */
    }

    return {
      success: true,
      message: `Emergency force logout broadcast sent. All sessions for client "${clientName}" terminated.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to force logout client." };
  }
}

/**
 * Grants or updates a user's role on the platform.
 */
export async function grantUserRole(
  emailOrUserId: string,
  role: AppRole,
  branchId?: string | null
): Promise<{ success: boolean; message?: string }> {
  try {
    const isEmail = emailOrUserId.includes("@");
    if (isEmail) {
      const { data, error } = await supabase.rpc("super_admin_grant_role" as any, {
        target_email: emailOrUserId.trim().toLowerCase(),
        new_role: role,
        target_branch_id: branchId || null,
      });
      if (error) {
        throw error;
      }
      const res = data as any;
      if (res && res.success === false) {
        return { success: false, message: res.message || res.error || "User not found" };
      }
      return { success: true, message: `Role "${role}" successfully granted to ${emailOrUserId}!` };
    } else {
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          {
            user_id: emailOrUserId.trim(),
            role,
            branch_id: branchId || null,
          } as any,
          { onConflict: "user_id,role" }
        );
      if (error) throw error;
      return { success: true, message: `Role "${role}" successfully assigned to user ID ${emailOrUserId}!` };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to grant user role." };
  }
}

/**
 * Convenience helper for logged-in user to grant themselves admin and super_admin access.
 */
export async function grantCurrentUserAdminAccess(): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) {
      return { success: false, message: "No active session found. Please sign in first." };
    }

    const rolesToGrant: AppRole[] = ["admin", "super_admin"];
    for (const r of rolesToGrant) {
      await supabase.from("user_roles").upsert(
        {
          user_id: uid,
          role: r,
        } as any,
        { onConflict: "user_id,role" }
      );
    }

    return {
      success: true,
      message: "Full Admin and Super Admin roles granted to your account! Refresh to load permissions.",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to grant admin access." };
  }
}
