import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { branchesQuery, type Branch, getDefaultBranch } from "./multiBranch";
import { myRolesQuery, type AppRole } from "./admin";

const STORAGE_KEY = "fnf_admin_selected_branch";

export interface AdminBranchContextValue {
  selectedBranchId: string | "all";
  setSelectedBranchId: (id: string | "all") => void;
  selectedBranch: Branch | null;
  isConsolidated: boolean;
  branches: Branch[];
  activeBranches: Branch[];
  isLoading: boolean;
  canSwitchBranch: boolean;
  userAssignedBranchId: string | null;
  isAdmin: boolean;
}

const AdminBranchContext = createContext<AdminBranchContextValue | null>(null);

export function AdminBranchProvider({ children }: { children: ReactNode }) {
  const { data: branches = [], isLoading: isLoadingBranches } = useQuery(branchesQuery);
  const { data: roles = [], isLoading: isLoadingRoles } = useQuery(myRolesQuery);

  const [storedBranchId, setStoredBranchId] = useState<string | "all">(() => {
    if (typeof window !== "undefined") {
      try {
        return (localStorage.getItem(STORAGE_KEY) as string | "all") || "all";
      } catch {
        return "all";
      }
    }
    return "all";
  });

  // Query user's assigned branch from user_roles
  const { data: assignedBranchId = null } = useQuery({
    queryKey: ["admin", "my-assigned-branch"],
    queryFn: async (): Promise<string | null> => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("branch_id, role")
        .eq("user_id", uid);

      if (error || !data || !data.length) return null;

      // If user has a global admin role with null branch_id, they have full access
      const hasGlobalAdmin = data.some((r) => r.role === "admin" && !r.branch_id);
      if (hasGlobalAdmin) return null;

      // Otherwise, return first specific branch assignment
      const specific = data.find((r) => Boolean(r.branch_id));
      return specific ? (specific.branch_id as string) : null;
    },
  });

  const isAdmin = roles.includes("admin");
  const canSwitchBranch = isAdmin && !assignedBranchId;

  // If user is a branch manager or staff locked to a branch, force that branch
  const effectiveBranchId = useMemo<string | "all">(() => {
    if (!canSwitchBranch && assignedBranchId) {
      return assignedBranchId;
    }
    return storedBranchId;
  }, [canSwitchBranch, assignedBranchId, storedBranchId]);

  const handleSetSelectedBranchId = (id: string | "all") => {
    if (!canSwitchBranch) return; // Disallow switching for locked branch staff
    setStoredBranchId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const activeBranches = useMemo(() => branches.filter((b) => b.is_active), [branches]);

  const selectedBranch = useMemo(() => {
    if (effectiveBranchId === "all") return null;
    return branches.find((b) => b.id === effectiveBranchId) || null;
  }, [effectiveBranchId, branches]);

  const isConsolidated = effectiveBranchId === "all";

  const value: AdminBranchContextValue = {
    selectedBranchId: effectiveBranchId,
    setSelectedBranchId: handleSetSelectedBranchId,
    selectedBranch,
    isConsolidated,
    branches,
    activeBranches,
    isLoading: isLoadingBranches || isLoadingRoles,
    canSwitchBranch,
    userAssignedBranchId: assignedBranchId,
    isAdmin,
  };

  return (
    <AdminBranchContext.Provider value={value}>
      {children}
    </AdminBranchContext.Provider>
  );
}

export function useAdminBranch(): AdminBranchContextValue {
  const ctx = useContext(AdminBranchContext);
  if (!ctx) {
    // Fallback safe dummy context if rendered outside provider
    return {
      selectedBranchId: "all",
      setSelectedBranchId: () => {},
      selectedBranch: null,
      isConsolidated: true,
      branches: [],
      activeBranches: [],
      isLoading: false,
      canSwitchBranch: true,
      userAssignedBranchId: null,
      isAdmin: true,
    };
  }
  return ctx;
}
