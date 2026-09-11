import { useAdminBranch } from "@/lib/branchContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronDown,
  Check,
  Globe2,
  Lock,
  MapPin,
  Clock,
} from "lucide-react";

export function AdminBranchSwitcher() {
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    isConsolidated,
    activeBranches,
    canSwitchBranch,
    isLoading,
  } = useAdminBranch();

  if (isLoading) {
    return (
      <div className="h-8 w-36 animate-pulse rounded-xl bg-muted/60" />
    );
  }

  // If user is locked to a single branch (e.g. Branch Manager)
  if (!canSwitchBranch && selectedBranch) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-semibold shadow-2xs"
        title="Your access is restricted to this specific branch."
      >
        <Lock className="size-3 text-amber-500" />
        <span className="max-w-[140px] truncate text-foreground">
          {selectedBranch.name}
        </span>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400 py-0 px-1"
        >
          {selectedBranch.code || "HUB"}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-[230px] rounded-xl border-border/80 bg-background/80 px-2.5 text-xs font-medium shadow-2xs hover:bg-muted/60 transition-all"
        >
          {isConsolidated ? (
            <Globe2 className="size-3.5 text-primary shrink-0 mr-1.5" />
          ) : (
            <Building2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mr-1.5" />
          )}

          <span className="truncate text-foreground font-semibold">
            {isConsolidated
              ? "All Branches (Consolidated)"
              : selectedBranch?.name || "Select Branch"}
          </span>

          <ChevronDown className="size-3 text-muted-foreground opacity-60 ml-1.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 rounded-2xl p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
          Store Branch View
        </DropdownMenuLabel>

        {/* Option 1: Consolidated View */}
        <DropdownMenuItem
          onClick={() => setSelectedBranchId("all")}
          className="flex items-center justify-between rounded-xl px-2.5 py-2 cursor-pointer text-xs"
        >
          <div className="flex items-center gap-2">
            <Globe2 className="size-4 text-primary" />
            <div>
              <div className="font-bold text-foreground">All Branches</div>
              <div className="text-[10px] text-muted-foreground">
                Consolidated company-wide rollup
              </div>
            </div>
          </div>
          {isConsolidated && <Check className="size-4 text-primary shrink-0" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
          Individual Hubs ({activeBranches.length})
        </DropdownMenuLabel>

        {activeBranches.map((branch) => {
          const isSelected = selectedBranchId === branch.id;
          return (
            <DropdownMenuItem
              key={branch.id}
              onClick={() => setSelectedBranchId(branch.id)}
              className="flex items-center justify-between rounded-xl px-2.5 py-2 cursor-pointer text-xs group"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">
                      {branch.name}
                    </span>
                    {branch.is_default && (
                      <Badge
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-[9px] text-primary py-0 px-1 shrink-0"
                      >
                        Main
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-2.5 opacity-60" />
                    <span>
                      {branch.open_time || "06:00"} - {branch.close_time || "21:00"}
                    </span>
                    <span>·</span>
                    <span>{branch.delivery_radius_km} km</span>
                  </div>
                </div>
              </div>
              {isSelected && (
                <Check className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
