import { describe, it, expect } from "vitest";
import {
  adminOrdersQuery,
  adminProductsQuery,
  adminCustomersQuery,
} from "../lib/admin";
import {
  DEFAULT_MANAGER_PERMISSIONS,
  FULL_MANAGER_PERMISSIONS,
  type Branch,
} from "../lib/multiBranch";

describe("Phase 2: Admin Multi-Branch Switcher & Queries Scoping", () => {
  const mockBranches: Branch[] = [
    {
      id: "branch-harbour-1",
      name: "Chennai Harbour Hub",
      slug: "chennai-harbour",
      code: "CHH",
      address: "Kasimedu",
      phone: null,
      manager: null,
      manager_user_id: null,
      lat: 13.0827,
      lng: 80.2707,
      open_time: "06:00",
      close_time: "21:00",
      delivery_radius_km: 15,
      is_active: true,
      is_default: true,
      gstin: null,
      fssai_license: null,
      upi_id: null,
      min_order_amount: 0,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "branch-velachery-2",
      name: "Velachery Express Hub",
      slug: "velachery",
      code: "VEL",
      address: "100 Feet Rd",
      phone: null,
      manager: null,
      manager_user_id: null,
      lat: 12.9791,
      lng: 80.2209,
      open_time: "07:00",
      close_time: "21:00",
      delivery_radius_km: 10,
      is_active: true,
      is_default: false,
      gstin: null,
      fssai_license: null,
      upi_id: null,
      min_order_amount: 0,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  describe("Query Keys Scoping by Branch", () => {
    it("scopes adminOrdersQuery key dynamically by selected branch", () => {
      // Default / consolidated query
      const defaultQuery = adminOrdersQuery();
      expect(defaultQuery.queryKey).toEqual(["admin", "orders", "all"]);

      // Specific branch query
      const harbourQuery = adminOrdersQuery("branch-harbour-1");
      expect(harbourQuery.queryKey).toEqual(["admin", "orders", "branch-harbour-1"]);

      const velacheryQuery = adminOrdersQuery("branch-velachery-2");
      expect(velacheryQuery.queryKey).toEqual(["admin", "orders", "branch-velachery-2"]);

      // Explicit "all"
      const explicitAll = adminOrdersQuery("all");
      expect(explicitAll.queryKey).toEqual(["admin", "orders", "all"]);
    });

    it("scopes adminProductsQuery key dynamically by selected branch", () => {
      // Default / consolidated query
      const defaultQuery = adminProductsQuery();
      expect(defaultQuery.queryKey).toEqual(["admin", "products", "all"]);

      // Branch-filtered query
      const scopedQuery = adminProductsQuery("branch-velachery-2");
      expect(scopedQuery.queryKey).toEqual(["admin", "products", "branch-velachery-2"]);
    });

    it("scopes adminCustomersQuery key dynamically by selected branch", () => {
      const defaultQuery = adminCustomersQuery();
      expect(defaultQuery.queryKey).toEqual(["admin", "customers", "all"]);

      const scopedQuery = adminCustomersQuery("branch-harbour-1");
      expect(scopedQuery.queryKey).toEqual(["admin", "customers", "branch-harbour-1"]);
    });

    it("preserves backwards compatibility as a direct queryOptions object", () => {
      // Components can pass adminOrdersQuery directly to useQuery(adminOrdersQuery)
      expect(adminOrdersQuery.queryKey).toBeDefined();
      expect(adminOrdersQuery.queryKey).toEqual(["admin", "orders", "all"]);
      expect(typeof adminOrdersQuery.queryFn).toBe("function");

      expect(adminProductsQuery.queryKey).toBeDefined();
      expect(adminProductsQuery.queryKey).toEqual(["admin", "products", "all"]);

      expect(adminCustomersQuery.queryKey).toBeDefined();
      expect(adminCustomersQuery.queryKey).toEqual(["admin", "customers", "all"]);
    });
  });

  describe("Branch Switcher State & Permission Enforcement", () => {
    it("determines consolidated state accurately", () => {
      const isConsolidated = (branchId: string | "all") => branchId === "all";

      expect(isConsolidated("all")).toBe(true);
      expect(isConsolidated("branch-harbour-1")).toBe(false);
      expect(isConsolidated("branch-velachery-2")).toBe(false);
    });

    it("enforces lock when staff is assigned to a specific branch", () => {
      // Tenant Admin (global)
      const adminUser = { roles: ["admin"], assignedBranchId: null };
      const canAdminSwitch = adminUser.roles.includes("admin") && !adminUser.assignedBranchId;
      expect(canAdminSwitch).toBe(true);

      // Branch Manager assigned to Velachery
      const managerUser = { roles: ["manager"], assignedBranchId: "branch-velachery-2" };
      const canManagerSwitch = managerUser.roles.includes("admin") && !managerUser.assignedBranchId;
      expect(canManagerSwitch).toBe(false);

      // Effective branch for manager must lock to their assigned branch
      const getEffectiveBranch = (user: typeof managerUser, storedPreference: string) => {
        if (!user.roles.includes("admin") && user.assignedBranchId) {
          return user.assignedBranchId;
        }
        return storedPreference;
      };

      expect(getEffectiveBranch(managerUser, "all")).toBe("branch-velachery-2");
      expect(getEffectiveBranch(adminUser as any, "all")).toBe("all");
    });

    it("resolves active branch object or null when consolidated", () => {
      const resolveBranch = (id: string | "all", list: Branch[]) => {
        if (id === "all") return null;
        return list.find((b) => b.id === id) || null;
      };

      expect(resolveBranch("all", mockBranches)).toBeNull();
      expect(resolveBranch("branch-harbour-1", mockBranches)?.name).toBe("Chennai Harbour Hub");
      expect(resolveBranch("branch-velachery-2", mockBranches)?.name).toBe("Velachery Express Hub");
      expect(resolveBranch("non-existent", mockBranches)).toBeNull();
    });
  });

  describe("Branch Manager Delegation Matrix", () => {
    it("maintains default restricted permissions for standard managers", () => {
      expect(DEFAULT_MANAGER_PERMISSIONS.can_manage_inventory).toBe(true);
      expect(DEFAULT_MANAGER_PERMISSIONS.can_view_financial_reports).toBe(true);
      expect(DEFAULT_MANAGER_PERMISSIONS.can_dispatch_drivers).toBe(true);

      expect(DEFAULT_MANAGER_PERMISSIONS.can_edit_prices).toBe(false);
      expect(DEFAULT_MANAGER_PERMISSIONS.can_manage_local_staff).toBe(false);
      expect(DEFAULT_MANAGER_PERMISSIONS.can_modify_store_hours).toBe(false);
      expect(DEFAULT_MANAGER_PERMISSIONS.has_full_branch_access).toBe(false);
    });

    it("enables all local branch privileges when full access is delegated", () => {
      expect(FULL_MANAGER_PERMISSIONS.has_full_branch_access).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_manage_inventory).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_edit_prices).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_manage_local_staff).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_view_financial_reports).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_dispatch_drivers).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_modify_store_hours).toBe(true);
    });
  });
});
