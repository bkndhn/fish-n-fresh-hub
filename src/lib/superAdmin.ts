import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Branch } from "./multiBranch";

export interface TenantQuota {
  id: string;
  tenant_name: string;
  tenant_code: string;
  max_branches: number;
  max_staff_per_branch: number;
  max_monthly_orders: number;
  max_storage_mb: number;
  tier: "starter" | "growth" | "enterprise";
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
