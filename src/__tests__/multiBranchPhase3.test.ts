import { describe, it, expect } from "vitest";
import {
  resolveBranchBySlug,
  getDefaultBranch,
  findNearestBranch,
  calculateDistanceKm,
  validateCartBranchMatch,
  type Branch,
} from "../lib/multiBranch";
import { productsQuery } from "../lib/queries";
import type { CartItem, Product } from "../lib/types";

describe("Phase 3: Customer Location-Based Routing, Cart Isolation & Checkout", () => {
  const mockBranches: Branch[] = [
    {
      id: "branch-harbour-1",
      name: "Chennai Harbour Hub",
      slug: "chennai-harbour",
      code: "CHH",
      address: "Kasimedu Pier, Chennai",
      phone: "+91 98430 61919",
      manager: "Karthik R.",
      manager_user_id: "user-mgr-1",
      lat: 13.125,
      lng: 80.298,
      open_time: "06:00",
      close_time: "21:00",
      delivery_radius_km: 15,
      is_active: true,
      is_default: true,
      gstin: "33AABCF1234F1Z9",
      fssai_license: "12423008000123",
      upi_id: "harbour@upi",
      min_order_amount: 199,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "branch-velachery-2",
      name: "Velachery Express Hub",
      slug: "velachery",
      code: "VEL",
      address: "100 Feet Bypass Road, Velachery",
      phone: "+91 98430 61920",
      manager: "Saravanan P.",
      manager_user_id: "user-mgr-2",
      lat: 12.979,
      lng: 80.221,
      open_time: "06:30",
      close_time: "21:30",
      delivery_radius_km: 12,
      is_active: true,
      is_default: false,
      gstin: "33AABCF1234F1Z8",
      fssai_license: "12423008000124",
      upi_id: "velachery@upi",
      min_order_amount: 199,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "branch-anna-nagar-3",
      name: "Anna Nagar Fresh Hub",
      slug: "anna-nagar",
      code: "ANR",
      address: "2nd Avenue, Anna Nagar",
      phone: "+91 98430 61921",
      manager: "Priya M.",
      manager_user_id: "user-mgr-3",
      lat: 13.085,
      lng: 80.213,
      open_time: "07:00",
      close_time: "22:00",
      delivery_radius_km: 10,
      is_active: true,
      is_default: false,
      gstin: "33AABCF1234F1Z7",
      fssai_license: "12423008000125",
      upi_id: "annanagar@upi",
      min_order_amount: 199,
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  describe("Customer Branch Resolution & Routing", () => {
    it("resolves branch by slug correctly", () => {
      const match = resolveBranchBySlug(mockBranches, "velachery");
      expect(match?.id).toBe("branch-velachery-2");
      expect(match?.code).toBe("VEL");
    });

    it("handles case-insensitive and trimmed slug inputs", () => {
      const match = resolveBranchBySlug(mockBranches, "  ANNA-NAGAR  ");
      expect(match?.id).toBe("branch-anna-nagar-3");
    });

    it("returns null when slug does not exist", () => {
      const match = resolveBranchBySlug(mockBranches, "non-existent-hub");
      expect(match).toBeNull();
    });

    it("falls back to default flagship hub", () => {
      const def = getDefaultBranch(mockBranches);
      expect(def?.id).toBe("branch-harbour-1");
      expect(def?.is_default).toBe(true);
    });
  });

  describe("GPS Location & Proximity Snapping", () => {
    it("snaps user in Guindy/Adyar (~12.98, 80.22) to nearest Velachery hub", () => {
      const userLat = 12.975;
      const userLng = 80.218;

      const nearest = findNearestBranch(mockBranches, userLat, userLng);
      expect(nearest).not.toBeNull();
      expect(nearest?.branch.slug).toBe("velachery");
      expect(nearest?.distanceKm).toBeLessThan(2);
      expect(nearest?.isWithinDeliveryRadius).toBe(true);
    });

    it("snaps user in Kasimedu/Royapuram (~13.12, 80.29) to Harbour flagship hub", () => {
      const userLat = 13.120;
      const userLng = 80.295;

      const nearest = findNearestBranch(mockBranches, userLat, userLng);
      expect(nearest).not.toBeNull();
      expect(nearest?.branch.slug).toBe("chennai-harbour");
      expect(nearest?.isWithinDeliveryRadius).toBe(true);
    });

    it("detects when customer is outside delivery radius", () => {
      // Coordinates in Chengalpattu (~45km south of Chennai)
      const chengalpattuLat = 12.684;
      const chengalpattuLng = 79.983;

      const nearest = findNearestBranch(mockBranches, chengalpattuLat, chengalpattuLng);
      expect(nearest).not.toBeNull();
      expect(nearest?.distanceKm).toBeGreaterThan(30);
      expect(nearest?.isWithinDeliveryRadius).toBe(false);
    });
  });

  describe("Cross-Branch Cart Isolation & Conflict Guard", () => {
    const createCartItem = (
      id: string,
      name: string,
      branchId: string | null,
      branchName?: string
    ): CartItem => ({
      product_id: id,
      name,
      price: 499,
      unit: "kg",
      qty: 1,
      image_url: null,
      cut_preference: "Curry Cut",
      branch_id: branchId,
      branch_name: branchName,
    });

    it("allows adding item to empty cart", () => {
      const result = validateCartBranchMatch([], "branch-velachery-2");
      expect(result.isValid).toBe(true);
      expect(result.conflictDetected).toBe(false);
    });

    it("allows adding item from the same branch", () => {
      const existing = [createCartItem("prod-1", "Seer Fish", "branch-velachery-2", "Velachery")];
      const result = validateCartBranchMatch(existing, "branch-velachery-2");
      expect(result.isValid).toBe(true);
      expect(result.conflictDetected).toBe(false);
    });

    it("allows adding global catalog item (branch_id null)", () => {
      const existing = [createCartItem("prod-1", "Seer Fish", "branch-velachery-2", "Velachery")];
      const result = validateCartBranchMatch(existing, null);
      expect(result.isValid).toBe(true);
      expect(result.conflictDetected).toBe(false);
    });

    it("blocks adding item from a different branch with conflict flag", () => {
      const existing = [createCartItem("prod-1", "Seer Fish", "branch-velachery-2", "Velachery")];
      const result = validateCartBranchMatch(existing, "branch-harbour-1");
      expect(result.isValid).toBe(false);
      expect(result.conflictDetected).toBe(true);
      expect(result.cartBranchId).toBe("branch-velachery-2");
    });
  });

  describe("Branch Catalog & Products Query Scoping", () => {
    it("scopes productsQuery queryKey by branch", () => {
      const globalQuery = productsQuery();
      expect(globalQuery.queryKey).toEqual(["products", "all"]);

      const harbourQuery = productsQuery("branch-harbour-1");
      expect(harbourQuery.queryKey).toEqual(["products", "branch-harbour-1"]);

      const velacheryQuery = productsQuery("branch-velachery-2");
      expect(velacheryQuery.queryKey).toEqual(["products", "branch-velachery-2"]);
    });

    it("maintains backward compatibility with object access", () => {
      expect(productsQuery.queryKey).toEqual(["products", "all"]);
      expect(typeof productsQuery.queryFn).toBe("function");
    });
  });
});
