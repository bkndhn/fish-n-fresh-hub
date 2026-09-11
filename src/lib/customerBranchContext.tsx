import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  activeBranchesQuery,
  type Branch,
  getDefaultBranch,
  resolveBranchBySlug,
  findNearestBranch,
  calculateDistanceKm,
} from "./multiBranch";

const STORAGE_KEY = "fnf_customer_branch_slug";

export interface CustomerBranchContextValue {
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch) => void;
  setActiveBranchBySlug: (slug: string) => boolean;
  branches: Branch[];
  isLoading: boolean;
  userCoordinates: { lat: number; lng: number } | null;
  distanceToActiveBranchKm: number | null;
  isWithinDeliveryRadius: boolean;
  detectNearestLocation: () => Promise<{
    success: boolean;
    branch?: Branch;
    distanceKm?: number;
    withinRadius?: boolean;
    message?: string;
  }>;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
}

const CustomerBranchContext = createContext<CustomerBranchContextValue | null>(null);

export function CustomerBranchProvider({ children }: { children: ReactNode }) {
  const { data: branches = [], isLoading } = useQuery(activeBranchesQuery);

  const [storedSlug, setStoredSlug] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [userCoordinates, setUserCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Check URL query parameter (?branch=slug) on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlBranch = params.get("branch");
      if (urlBranch) {
        setStoredSlug(urlBranch.toLowerCase().trim());
        localStorage.setItem(STORAGE_KEY, urlBranch.toLowerCase().trim());
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Resolve the active branch based on stored slug or default flagship
  const activeBranch = useMemo<Branch | null>(() => {
    if (!branches.length) return null;

    if (storedSlug) {
      const match = resolveBranchBySlug(branches, storedSlug);
      if (match) return match;
    }

    return getDefaultBranch(branches);
  }, [branches, storedSlug]);

  const setActiveBranch = useCallback((branch: Branch) => {
    if (!branch?.slug) return;
    setStoredSlug(branch.slug);
    try {
      localStorage.setItem(STORAGE_KEY, branch.slug);
    } catch {
      /* ignore */
    }
  }, []);

  const setActiveBranchBySlug = useCallback(
    (slug: string): boolean => {
      const match = resolveBranchBySlug(branches, slug);
      if (match) {
        setActiveBranch(match);
        return true;
      }
      return false;
    },
    [branches, setActiveBranch]
  );

  // Calculate distance between user coordinates and active branch
  const distanceToActiveBranchKm = useMemo(() => {
    if (!userCoordinates || !activeBranch?.lat || !activeBranch?.lng) return null;
    return calculateDistanceKm(
      userCoordinates.lat,
      userCoordinates.lng,
      activeBranch.lat,
      activeBranch.lng
    );
  }, [userCoordinates, activeBranch]);

  const isWithinDeliveryRadius = useMemo(() => {
    if (distanceToActiveBranchKm === null || !activeBranch) return true; // Default optimistic until geo known
    return distanceToActiveBranchKm <= (activeBranch.delivery_radius_km || 12);
  }, [distanceToActiveBranchKm, activeBranch]);

  // Live browser geolocation detection
  const detectNearestLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return { success: false, message: "Geolocation is not supported by your browser." };
    }

    return new Promise<{
      success: boolean;
      branch?: Branch;
      distanceKm?: number;
      withinRadius?: boolean;
      message?: string;
    }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserCoordinates({ lat, lng });

          if (!branches.length) {
            resolve({ success: false, message: "No active hubs currently available." });
            return;
          }

          const nearestResult = findNearestBranch(branches, lat, lng);
          if (nearestResult) {
            setActiveBranch(nearestResult.branch);
            resolve({
              success: true,
              branch: nearestResult.branch,
              distanceKm: nearestResult.distanceKm,
              withinRadius: nearestResult.isWithinDeliveryRadius,
            });
          } else {
            resolve({ success: false, message: "Could not match a nearby store hub." });
          }
        },
        (error) => {
          let message = "Unable to retrieve your location.";
          if (error.code === error.PERMISSION_DENIED) {
            message = "Location access denied. Please select your branch manually.";
          }
          resolve({ success: false, message });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, [branches, setActiveBranch]);

  const value: CustomerBranchContextValue = {
    activeBranch,
    setActiveBranch,
    setActiveBranchBySlug,
    branches,
    isLoading,
    userCoordinates,
    distanceToActiveBranchKm,
    isWithinDeliveryRadius,
    detectNearestLocation,
    isLocationModalOpen,
    setIsLocationModalOpen,
  };

  return (
    <CustomerBranchContext.Provider value={value}>
      {children}
    </CustomerBranchContext.Provider>
  );
}

export function useCustomerBranch(): CustomerBranchContextValue {
  const ctx = useContext(CustomerBranchContext);
  if (!ctx) {
    return {
      activeBranch: null,
      setActiveBranch: () => {},
      setActiveBranchBySlug: () => false,
      branches: [],
      isLoading: false,
      userCoordinates: null,
      distanceToActiveBranchKm: null,
      isWithinDeliveryRadius: true,
      detectNearestLocation: async () => ({ success: false, message: "No branch context" }),
      isLocationModalOpen: false,
      setIsLocationModalOpen: () => {},
    };
  }
  return ctx;
}
