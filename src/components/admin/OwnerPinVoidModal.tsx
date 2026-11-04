import { useState } from "react";
import { KeyRound, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OwnerPinVoidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber?: string | null;
  onSuccess: () => void;
}

export function OwnerPinVoidModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: OwnerPinVoidModalProps) {
  const [pin, setPin] = useState("");
  const [action, setAction] = useState<"cancel" | "refund">("cancel");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setPin("");
    setReason("");
    setAction("cancel");
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 8) {
      toast.error("PIN must be 4–8 digits");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Please enter a reason (minimum 3 characters)");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("void_bill_with_pin", {
        p_order_id: orderId,
        p_pin: pin,
        p_action: action,
        p_reason: reason.trim(),
      });
      if (error) {
        toast.error(error.message || "Void failed. Check your PIN and try again.");
        return;
      }
      const result = data as any;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        action === "refund" ? "Order voided & refund initiated" : "Order cancelled",
        { description: `Order ${orderNumber || orderId} has been voided.` }
      );
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Unexpected error during void");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-destructive" />
            Void / Cancel Order
          </DialogTitle>
          <DialogDescription>
            Owner PIN required to cancel or refund{" "}
            <span className="font-medium">{orderNumber || "this order"}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="void-pin">Owner PIN</Label>
            <Input
              id="void-pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="Enter 4–8 digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="void-action">Action</Label>
            <select
              id="void-action"
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              value={action}
              onChange={(e) => setAction(e.target.value as "cancel" | "refund")}
            >
              <option value="cancel">Cancel Order (no refund)</option>
              <option value="refund">Cancel + Refund to Customer</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason</Label>
            <Input
              id="void-reason"
              placeholder="Reason for void (required, min 3 chars)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || pin.length < 4 || reason.trim().length < 3}
          >
            <KeyRound className="w-4 h-4 mr-2" />
            {loading ? "Voiding..." : "Confirm Void"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
