import { describe, it, expect } from "vitest";
import {
  generateBranchSlug,
  generateBranchCode,
  calculateDistanceKm,
  findNearestBranch,
  getDefaultBranch,
  resolveBranchBySlug,
  validateCartForBranch,
  normalizeBranch,
  DEFAULT_MANAGER_PERMISSIONS,
  FULL_MANAGER_PERMISSIONS,
  type Branch,
} from "../lib/multiBranch";

describe("Phase 1: Multi-Branch Data Isolation & Modeling", () => {
  const mockBranches: Branch[] = [
    {
      id: "20f2ea34-9e3c-4999-aeac-7aae3367ee60",
      name: "Chennai Harbour Hub",
      slug: "chennai-harbour",
      code: "CHH",
      address: "Harbour Road, Kasimedu, Chennai 600001",
      phone: "+91 98765 43210",
      manager: "Ravi Kumar",
      manager_user_id: null,
      lat: 13.0827,
      lng: 80.2707,
      open_time: "06:00",
      close_time: "21:00",
      delivery_radius_km: 15,
      is_active: true,
      is_default: true,
      gstin: "33AAACF1234F1Z5",
      fssai_license: "12423008000123",
      upi_id: "harbour@upi",
      min_order_amount: 199,
      sort_order: 1,
      created_at: "2026-08-29T09:37:31Z",
      updated_at: "2026-08-29T09:37:31Z",
    },
    {
      id: "53da6ab2-7cda-4499-b1a3-9b84a8c77398",
      name: "Velachery Express Hub",
      slug: "velachery",
      code: "VEL",
      address: "100 Feet Road, Velachery, Chennai 600042",
      phone: "+91 98765 43211",
      manager: "Suresh M",
      manager_user_id: null,
      lat: 12.9791,
      lng: 80.2209,
      open_time: "07:00",
      close_time: "21:00",
      delivery_radius_km: 8,
      is_active: true,
      is_default: false,
      gstin: "33AAACF1234F1Z5",
      fssai_license: "12423008000124",
      upi_id: "velachery@upi",
      min_order_amount: 149,
      sort_order: 2,
      created_at: "2026-08-29T09:37:31Z",
      updated_at: "2026-08-29T09:37:31Z",
    },
    {
      id: "c9876543-2100-4499-b1a3-9b84a8c77999",
      name: "Coimbatore Peelamedu Hub (Inactive)",
      slug: "coimbatore-peelamedu",
      code: "CBE",
      address: "Avinashi Road, Peelamedu, Coimbatore 641004",
      phone: "+91 98765 43212",
      manager: null,
      manager_user_id: null,
      lat: 11.0267,
      lng: 77.0094,
      open_time: "08:00",
      close_time: "20:00",
      delivery_radius_km: 10,
      is_active: false,
      is_default: false,
      gstin: null,
      fssai_license: null,
      upi_id: null,
      min_order_amount: 0,
      sort_order: 3,
      created_at: "2026-08-29T09:37:31Z",
      updated_at: "2026-08-29T09:37:31Z",
    },
  ];

  describe("Slug & Store Code Generation", () => {
    it("generates clean URL slugs from branch names", () => {
      expect(generateBranchSlug("Chennai Harbour Hub")).toBe("chennai-harbour-hub");
      expect(generateBranchSlug("Velachery 100ft Road #2 (Express)")).toBe("velachery-100ft-road-2-express");
      expect(generateBranchSlug("  Kochi Marine Drive   ")).toBe("kochi-marine-drive");
    });

    it("generates 3-letter uppercase store codes with fallback padding", () => {
      expect(generateBranchCode("Chennai")).toBe("CHE");
      expect(generateBranchCode("Velachery")).toBe("VEL");
      expect(generateBranchCode("Goa")).toBe("GOA");
      expect(generateBranchCode("A")).toBe("AXX");
    });
  });

  describe("Geodesic Proximity & Nearest Branch Routing", () => {
    it("calculates accurate Haversine distance in kilometers", () => {
      // Chennai Harbour to Velachery is ~12.7 km
      const distance = calculateDistanceKm(13.0827, 80.2707, 12.9791, 80.2209);
      expect(distance).toBeGreaterThan(12.0);
      expect(distance).toBeLessThan(13.5);

      // Distance to exact same spot is 0
      expect(calculateDistanceKm(13.0827, 80.2707, 13.0827, 80.2707)).toBe(0);
    });

    it("finds the nearest active branch for customer coordinates and validates delivery radius", () => {
      // Customer at Guindy / Adyar (closer to Velachery)
      const customerAtAdyar = { lat: 13.0012, lng: 80.24 };
      const match = findNearestBranch(mockBranches, customerAtAdyar.lat, customerAtAdyar.lng);

      expect(match).not.toBeNull();
      expect(match?.branch.id).toBe("53da6ab2-7cda-4499-b1a3-9b84a8c77398"); // Velachery
      expect(match?.isWithinDeliveryRadius).toBe(true);
    });

    it("flags customer as outside delivery radius when distance exceeds branch limit", () => {
      // Customer in Chengalpattu (~45km away from Velachery & Harbour)
      const customerFar = { lat: 12.6841, lng: 79.9836 };
      const match = findNearestBranch(mockBranches, customerFar.lat, customerFar.lng);

      expect(match).not.toBeNull();
      expect(match?.isWithinDeliveryRadius).toBe(false);
    });

    it("skips inactive branches during nearest branch lookup", () => {
      // Customer in Coimbatore (closest to inactive Peelamedu Hub)
      const match = findNearestBranch(mockBranches, 11.0267, 77.0094);
      // Inactive branch must NOT be selected; only active branches considered
      expect(match?.branch.id).not.toBe("c9876543-2100-4499-b1a3-9b84a8c77999");
    });
  });

  describe("Branch Resolvers & Defaults", () => {
    it("resolves the designated flagship default branch", () => {
      const defaultBranch = getDefaultBranch(mockBranches);
      expect(defaultBranch).not.toBeNull();
      expect(defaultBranch?.id).toBe("20f2ea34-9e3c-4999-aeac-7aae3367ee60");
      expect(defaultBranch?.is_default).toBe(true);
    });

    it("resolves branch by slug or code (case-insensitive)", () => {
      const bySlug = resolveBranchBySlug(mockBranches, "chennai-harbour");
      expect(bySlug?.name).toBe("Chennai Harbour Hub");

      const byCode = resolveBranchBySlug(mockBranches, "vel");
      expect(byCode?.name).toBe("Velachery Express Hub");

      const nonExistent = resolveBranchBySlug(mockBranches, "unknown-branch");
      expect(nonExistent).toBeNull();
    });

    it("normalizes partial branch data with safe fallbacks", () => {
      const normalized = normalizeBranch({
        id: "test-uuid",
        name: "Royapuram Dock",
      });

      expect(normalized.id).toBe("test-uuid");
      expect(normalized.name).toBe("Royapuram Dock");
      expect(normalized.slug).toBe("royapuram-dock");
      expect(normalized.code).toBe("ROY");
      expect(normalized.is_active).toBe(true);
      expect(normalized.is_default).toBe(false);
      expect(normalized.delivery_radius_km).toBe(12);
    });
  });

  describe("Cart Data Isolation & Cross-Branch Guard", () => {
    it("allows checkout when all items belong to the active branch", () => {
      const cart = [
        { product_id: "prod-1", branch_id: "20f2ea34-9e3c-4999-aeac-7aae3367ee60" },
        { product_id: "prod-2", branch_id: "20f2ea34-9e3c-4999-aeac-7aae3367ee60" },
      ];
      const result = validateCartForBranch(cart, "20f2ea34-9e3c-4999-aeac-7aae3367ee60");
      expect(result.isValid).toBe(true);
      expect(result.mismatchedCount).toBe(0);
    });

    it("detects cross-branch items and reports mismatched item count", () => {
      const cart = [
        { product_id: "prod-1", branch_id: "20f2ea34-9e3c-4999-aeac-7aae3367ee60" }, // Harbour
        { product_id: "prod-2", branch_id: "53da6ab2-7cda-4499-b1a3-9b84a8c77398" }, // Velachery
      ];
      const result = validateCartForBranch(cart, "20f2ea34-9e3c-4999-aeac-7aae3367ee60");
      expect(result.isValid).toBe(false);
      expect(result.mismatchedCount).toBe(1);
    });

    it("considers empty cart or items without branch_id valid", () => {
      expect(validateCartForBranch([], "any-id").isValid).toBe(true);
      expect(validateCartForBranch([{ product_id: "p1", branch_id: null }], "any-id").isValid).toBe(true);
    });
  });

  describe("Branch Manager Permissions Matrix", () => {
    it("provides standard restricted permissions for regular managers", () => {
      expect(DEFAULT_MANAGER_PERMISSIONS.can_manage_inventory).toBe(true);
      expect(DEFAULT_MANAGER_PERMISSIONS.can_edit_prices).toBe(false);
      expect(DEFAULT_MANAGER_PERMISSIONS.can_manage_local_staff).toBe(false);
      expect(DEFAULT_MANAGER_PERMISSIONS.has_full_branch_access).toBe(false);
    });

    it("provides comprehensive control when admin delegates full branch access", () => {
      expect(FULL_MANAGER_PERMISSIONS.has_full_branch_access).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_edit_prices).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_manage_local_staff).toBe(true);
      expect(FULL_MANAGER_PERMISSIONS.can_modify_store_hours).toBe(true);
    });
  });
});
