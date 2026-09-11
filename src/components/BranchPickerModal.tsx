import { useState } from "react";
import { useCustomerBranch } from "@/lib/customerBranchContext";
import { useCart } from "@/lib/cart";
import { type Branch } from "@/lib/multiBranch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Navigation,
  Check,
  Clock,
  Truck,
  Loader2,
  AlertTriangle,
  Store,
} from "lucide-react";
import { toast } from "sonner";

export function BranchPickerModal() {
  const {
    activeBranch,
    setActiveBranch,
    branches,
    isLocationModalOpen,
    setIsLocationModalOpen,
    detectNearestLocation,
    userCoordinates,
  } = useCustomerBranch();

  const {
    items,
    count,
    cartBranchId,
    cartBranchName,
    clear,
    pendingMismatch,
    clearPendingMismatch,
    confirmSwitchAndAdd,
  } = useCart();

  const [detecting, setDetecting] = useState(false);
  const [switchingTarget, setSwitchingTarget] = useState<Branch | null>(null);

  const handleSelectBranch = (branch: Branch) => {
    // If already the active branch, just close
    if (activeBranch?.id === branch.id) {
      setIsLocationModalOpen(false);
      return;
    }

    // Check if cart has items from a different branch
    const hasCartConflict = items.length > 0 && cartBranchId && cartBranchId !== branch.id;

    if (hasCartConflict) {
      setSwitchingTarget(branch);
      return;
    }

    // No conflict, switch immediately
    setActiveBranch(branch);
    setIsLocationModalOpen(false);
    toast.success(`Switched to ${branch.name}`);
  };

  const handleConfirmCartClear = () => {
    if (!switchingTarget) return;
    clear();
    setActiveBranch(switchingTarget);
    setSwitchingTarget(null);
    setIsLocationModalOpen(false);
    toast.success(`Cart refreshed. Now delivering from ${switchingTarget.name}`);
  };

  const handleGpsDetect = async () => {
    setDetecting(true);
    try {
      const res = await detectNearestLocation();
      if (res.success && res.branch) {
        toast.success(`Snapped to nearest hub: ${res.branch.name}`, {
          description: res.distanceKm ? `Distance: ~${res.distanceKm} km from your location.` : undefined,
        });
        setIsLocationModalOpen(false);
      } else {
        toast.error(res.message || "Could not detect location.");
      }
    } finally {
      setDetecting(false);
    }
  };

  return (
    <>
      {/* Main Branch Selection Modal */}
      <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Store className="size-5 text-primary" />
              Select Your Delivery Hub
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose your nearest fulfillment hub for dock-fresh seafood and guaranteed 35-minute express delivery.
            </DialogDescription>
          </DialogHeader>

          {/* GPS Auto-Detect Button */}
          <Button
            variant="outline"
            onClick={handleGpsDetect}
            disabled={detecting}
            className="w-full justify-start rounded-xl border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold py-2.5 h-auto transition-all"
          >
            {detecting ? (
              <Loader2 className="mr-2 size-4 animate-spin shrink-0 text-emerald-600" />
            ) : (
              <Navigation className="mr-2 size-4 shrink-0 text-emerald-600" />
            )}
            <div className="text-left">
              <div>Auto-Detect via GPS Location</div>
              <div className="text-[10px] opacity-75 font-normal">
                Snaps to the closest hub within delivery radius
              </div>
            </div>
          </Button>

          {/* Active Hub List */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {branches.map((branch) => {
              const isCurrent = activeBranch?.id === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => handleSelectBranch(branch)}
                  className={`w-full text-left rounded-xl border p-3 text-xs transition-all flex items-start justify-between gap-3 ${
                    isCurrent
                      ? "border-primary/60 bg-primary/5 shadow-2xs"
                      : "border-border/80 hover:bg-muted/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{branch.name}</span>
                      {branch.is_default && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-[9px] text-primary py-0 px-1 shrink-0"
                        >
                          Main Dock
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                      {branch.address || "South India Coast"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5 opacity-60" />
                        {branch.open_time || "06:00"} - {branch.close_time || "21:00"}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Truck className="size-2.5 opacity-60" />
                        {branch.delivery_radius_km} km radius
                      </span>
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <Check className="size-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cross-Branch Cart Conflict Alert Modal */}
      <AlertDialog
        open={Boolean(switchingTarget)}
        onOpenChange={(open) => !open && setSwitchingTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <div className="mx-auto size-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle className="text-center text-base">
              Clear Cart to Switch Hub?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-center leading-relaxed">
              Your cart has <span className="font-bold text-foreground">{count} items</span> from{" "}
              <span className="font-semibold text-foreground">
                {cartBranchName || "your previous hub"}
              </span>
              . Switching to{" "}
              <span className="font-semibold text-foreground">{switchingTarget?.name}</span> will
              clear your cart to guarantee local dock-fresh inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <AlertDialogCancel
              onClick={() => setSwitchingTarget(null)}
              className="rounded-xl text-xs"
            >
              Keep Cart
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCartClear}
              className="rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear & Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add-To-Cart Cross-Branch Conflict Alert */}
      <AlertDialog
        open={Boolean(pendingMismatch)}
        onOpenChange={(open) => !open && clearPendingMismatch()}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <div className="mx-auto size-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle className="text-center text-base">
              Start Fresh Cart?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-center leading-relaxed">
              You're adding an item from{" "}
              <span className="font-semibold text-foreground">
                {pendingMismatch?.branch?.name || "a different hub"}
              </span>
              , but your cart has items from{" "}
              <span className="font-semibold text-foreground">
                {cartBranchName || "another hub"}
              </span>
              . Each order is delivered from a single hub to guarantee speed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <AlertDialogCancel
              onClick={clearPendingMismatch}
              className="rounded-xl text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitchAndAdd}
              className="rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Start Fresh Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
