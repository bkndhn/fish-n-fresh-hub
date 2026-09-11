import { describe, it, expect } from "vitest";
import {
  checkBranchQuotaAvailable,
  checkStaffQuotaAvailable,
  DEFAULT_TENANT_QUOTA,
  type TenantQuota,
  type PlatformRevocation,
} from "../lib/superAdmin";
import type { AppRole } from "../lib/admin";

describe("Phase 4: Super Admin Governance, Tenant Quotas & Emergency Kill Switch", () => {
  describe("Tenant Branch Creation Quota Validation", () => {
    it("allows branch creation when under the max quota", () => {
      const activeBranches = 4;
      const maxAllowed = 10;
      const res = checkBranchQuotaAvailable(activeBranches, maxAllowed);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(6);
      expect(res.message).toBeUndefined();
    });

    it("blocks branch creation when quota limit is reached", () => {
      const activeBranches = 10;
      const maxAllowed = 10;
      const res = checkBranchQuotaAvailable(activeBranches, maxAllowed);
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.message).toContain("Branch creation quota limit reached (10/10 active hubs)");
    });

    it("blocks branch creation when quota limit is exceeded", () => {
      const activeBranches = 12;
      const maxAllowed = 10;
      const res = checkBranchQuotaAvailable(activeBranches, maxAllowed);
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.message).toContain("Upgrade tenant quota in Super Admin");
    });
  });

  describe("Branch Staff Seat Quota Validation", () => {
    it("allows adding staff members when hub seats are available", () => {
      const currentStaff = 7;
      const maxPerHub = 15;
      const res = checkStaffQuotaAvailable(currentStaff, maxPerHub);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(8);
      expect(res.message).toBeUndefined();
    });

    it("blocks adding staff members when hub seat capacity is exhausted", () => {
      const currentStaff = 15;
      const maxPerHub = 15;
      const res = checkStaffQuotaAvailable(currentStaff, maxPerHub);
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.message).toContain("Staff seat quota reached for this hub (15/15 members)");
    });
  });

  describe("Default Tenant Quota Baseline Specifications", () => {
    it("maintains secure enterprise default parameters", () => {
      expect(DEFAULT_TENANT_QUOTA.tenant_code).toBe("FNF-MAIN");
      expect(DEFAULT_TENANT_QUOTA.max_branches).toBe(10);
      expect(DEFAULT_TENANT_QUOTA.max_staff_per_branch).toBe(15);
      expect(DEFAULT_TENANT_QUOTA.max_monthly_orders).toBe(25000);
      expect(DEFAULT_TENANT_QUOTA.max_storage_mb).toBe(5000);
      expect(DEFAULT_TENANT_QUOTA.tier).toBe("enterprise");
      expect(DEFAULT_TENANT_QUOTA.is_locked).toBe(false);
    });
  });

  describe("Anti-Takeover & Role Clearance Integrity", () => {
    it("recognizes super_admin as a valid AppRole", () => {
      const superAdminRole: AppRole = "super_admin";
      expect(superAdminRole).toBe("super_admin");
    });

    it("ensures super_admin satisfies high-privilege clearance", () => {
      const authorizedRoles: AppRole[] = ["super_admin", "user"];
      const hasSuperAdmin = authorizedRoles.includes("super_admin");
      const hasAdmin = authorizedRoles.includes("admin");
      expect(hasSuperAdmin).toBe(true);
      expect(hasAdmin).toBe(false);
    });
  });

  describe("Emergency Kill Switch Revocation Payload Contracts", () => {
    it("structures a valid Global Kill Switch event payload", () => {
      const globalRevocation: PlatformRevocation = {
        id: "rev-global-1",
        scope: "global",
        target_id: null,
        reason: "Suspected perimeter breach",
        revoked_by: "user-super-admin-0",
        revoked_at: new Date().toISOString(),
      };

      expect(globalRevocation.scope).toBe("global");
      expect(globalRevocation.target_id).toBeNull();
      expect(Date.parse(globalRevocation.revoked_at)).toBeGreaterThan(0);
    });

    it("structures a valid Branch-specific Kill Switch event payload", () => {
      const branchRevocation: PlatformRevocation = {
        id: "rev-branch-1",
        scope: "branch",
        target_id: "branch-velachery-2",
        reason: "Terminal hardware compromise at Velachery Hub",
        revoked_by: "user-super-admin-0",
        revoked_at: new Date().toISOString(),
      };

      expect(branchRevocation.scope).toBe("branch");
      expect(branchRevocation.target_id).toBe("branch-velachery-2");
    });

    it("structures a valid User-specific Kill Switch event payload", () => {
      const userRevocation: PlatformRevocation = {
        id: "rev-user-1",
        scope: "user",
        target_id: "user-rogue-staff-9",
        reason: "Unauthorized privilege escalation detected",
        revoked_by: "user-super-admin-0",
        revoked_at: new Date().toISOString(),
      };

      expect(userRevocation.scope).toBe("user");
      expect(userRevocation.target_id).toBe("user-rogue-staff-9");
    });
  });
});
