import { Printer, Wallet, X, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR, formatIST } from "@/lib/format";
import type { DriverCashSettlement } from "@/lib/types";

interface SettlementReceiptModalProps {
  settlement: DriverCashSettlement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettlementReceiptModal({
  settlement,
  open,
  onOpenChange,
}: SettlementReceiptModalProps) {
  if (!settlement) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-3xl p-5 border-border/70 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Cash Handover Settlement Voucher
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Official Reconciliation Audit Record
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Receipt Voucher Body */}
        <div className="space-y-3 font-mono text-xs pt-2">
          <div className="text-center border-b border-dashed border-border pb-3">
            <p className="font-bold text-sm text-foreground">FISH N FRESH HUB</p>
            <p className="text-[11px] text-muted-foreground">Cashier & Delivery Partner Settlement Voucher</p>
            <p className="text-xs text-primary font-bold mt-1.5">
              Settlement Voucher #{settlement.settlement_number}
            </p>
            <p className="text-[10px] text-muted-foreground">{formatIST(settlement.settled_at)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs py-1 border-b border-dashed border-border">
            <div>
              <span className="text-muted-foreground">Delivery Partner:</span>
              <p className="font-bold text-foreground text-sm">{settlement.driver_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Received By:</span>
              <p className="font-bold text-foreground text-sm">{settlement.settled_by_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Orders Count:</span>
              <p className="font-bold text-foreground">{settlement.orders_count} orders</p>
            </div>
            <div>
              <span className="text-muted-foreground">Handover Mode:</span>
              <p className="font-bold text-foreground uppercase">{settlement.payment_mode}</p>
            </div>
          </div>

          <div className="space-y-1.5 py-1 border-b border-dashed border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total COD Orders Value:</span>
              <span>{formatINR(Number(settlement.amount_collected))}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-emerald-600 dark:text-emerald-400">
              <span>Amount Handed Over to Admin:</span>
              <span>{formatINR(Number(settlement.amount_settled))}</span>
            </div>
            {Number(settlement.balance_remaining) > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>Pending Balance Due:</span>
                <span>{formatINR(Number(settlement.balance_remaining))}</span>
              </div>
            )}
          </div>

          {settlement.notes && (
            <p className="text-[11px] text-muted-foreground italic">Note: {settlement.notes}</p>
          )}

          <div className="pt-6 flex justify-between text-[10px] text-muted-foreground text-center">
            <div className="border-t border-border pt-1 w-28">Driver Signature</div>
            <div className="border-t border-border pt-1 w-28">Admin Signature</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl text-xs gap-1"
            onClick={handlePrint}
          >
            <Printer className="size-3.5" /> Print Voucher
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-xl text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
