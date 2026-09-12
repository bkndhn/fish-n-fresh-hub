import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Printer,
  X,
  CreditCard,
  Banknote,
  QrCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { OrderRow } from "@/lib/admin";
import { useSessionUser } from "@/lib/session";
import {
  EscPosBuilder,
  sendEscPosToPrinter,
  getSavedPrinterConfig,
} from "@/lib/thermalPrinter";

interface DriverCashSettlementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName: string;
  driverPhone?: string | undefined;
  driverId?: string | undefined;
  unsettledOrders: OrderRow[];
  onSuccess?: (() => void) | undefined;
}

export function DriverCashSettlementModal({
  open,
  onOpenChange,
  driverName,
  driverPhone,
  driverId,
  unsettledOrders,
  onSuccess,
}: DriverCashSettlementModalProps) {
  const qc = useQueryClient();
  const { user } = useSessionUser();

  // Selected orders for this settlement (default all)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [amountSettled, setAmountSettled] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [collectorName, setCollectorName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [completedSettlement, setCompletedSettlement] = useState<any | null>(null);

  // Initialize selection when opening
  useState(() => {
    if (unsettledOrders.length > 0) {
      const ids = unsettledOrders.map((o) => o.id);
      setSelectedOrderIds(ids);
      const total = unsettledOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      setAmountSettled(total.toString());
      setCollectorName(user?.email?.split("@")[0] || "Admin Counter");
    }
  });

  // Calculate total for selected orders
  const selectedTotal = useMemo(() => {
    return unsettledOrders
      .filter((o) => selectedOrderIds.includes(o.id))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
  }, [unsettledOrders, selectedOrderIds]);

  const toggleOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const newTotal = unsettledOrders
        .filter((o) => next.includes(o.id))
        .reduce((sum, o) => sum + Number(o.total || 0), 0);
      setAmountSettled(newTotal.toString());
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === unsettledOrders.length) {
      setSelectedOrderIds([]);
      setAmountSettled("0");
    } else {
      const ids = unsettledOrders.map((o) => o.id);
      setSelectedOrderIds(ids);
      const total = unsettledOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      setAmountSettled(total.toString());
    }
  };

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (selectedOrderIds.length === 0) {
        throw new Error("Please select at least one order to settle.");
      }
      const settledNum = Number(amountSettled);
      if (isNaN(settledNum) || settledNum < 0) {
        throw new Error("Please enter a valid settled amount.");
      }

      const settlementNumber = `SETTLE-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const balanceRemaining = Math.max(0, selectedTotal - settledNum);

      let record: any = null;

      // 1. Attempt atomic stored procedure with row-level mutex (FOR UPDATE)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "settle_driver_cod_orders_atomic",
          {
            p_settlement_number: settlementNumber,
            p_driver_name: driverName,
            p_driver_phone: driverPhone || "",
            p_driver_id: driverId || "",
            p_order_ids: selectedOrderIds,
            p_amount_collected: selectedTotal,
            p_amount_settled: settledNum,
            p_balance_remaining: balanceRemaining,
            p_settled_by_name: collectorName.trim() || "Store Admin",
            p_settled_by_id: user?.id || "",
            p_payment_mode: paymentMode,
            p_notes: notes.trim() || "",
          }
        );

        if (!rpcError && rpcData) {
          record = rpcData;
        } else if (rpcError?.message?.includes("ERR_ALREADY_SETTLED")) {
          throw new Error("Concurrency Conflict: One or more selected orders have already been settled by another cashier.");
        }
      } catch (rpcErr: any) {
        if (rpcErr.message?.includes("Concurrency Conflict")) throw rpcErr;
        // RPC might not exist on remote db yet, fallback to client transaction
      }

      // 2. Fallback transaction if RPC not yet deployed
      if (!record) {
        const { data: insertRec, error: insertError } = await supabase
          .from("driver_cash_settlements")
          .insert({
            settlement_number: settlementNumber,
            driver_name: driverName,
            driver_phone: driverPhone || "",
            driver_id: driverId || "",
            amount_collected: selectedTotal,
            amount_settled: settledNum,
            balance_remaining: balanceRemaining,
            orders_count: selectedOrderIds.length,
            order_ids: selectedOrderIds,
            settled_by_name: collectorName.trim() || "Store Admin",
            settled_by_id: user?.id || "",
            payment_mode: paymentMode,
            notes: notes.trim() || "",
            settled_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        record = insertRec;

        const { error: updateOrdersError } = await supabase
          .from("orders")
          .update({
            cod_settled: true,
            settlement_id: record.id,
            settled_at: new Date().toISOString(),
          })
          .in("id", selectedOrderIds);

        if (updateOrdersError) throw updateOrdersError;
      }

      return record;
    },
    onSuccess: (data) => {
      toast.success(`Cash Handover Recorded: ${formatINR(Number(data.amount_settled))} received from ${driverName}!`);
      setCompletedSettlement(data);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["driver_cash_settlements"] });
      if (onSuccess) onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePrintSlip = async () => {
    if (!completedSettlement) return;
    const cfg = getSavedPrinterConfig();
    const builder = new EscPosBuilder(cfg.paperWidth);
    builder
      .align("center")
      .bold(true)
      .size("double")
      .textLine(cfg.headerLine1)
      .size("normal")
      .textLine("CASH HANDOVER VOUCHER")
      .textLine(`Voucher #${completedSettlement.settlement_number}`)
      .textLine(formatIST(completedSettlement.settled_at))
      .horizontalRule("=")
      .align("left")
      .row("Driver:", driverName)
      .row("Received By:", collectorName || "Store Admin")
      .row("Orders Settled:", `${selectedOrderIds.length} orders`)
      .row("Payment Mode:", paymentMode.toUpperCase())
      .horizontalRule("-")
      .row("Total COD Value:", formatINR(selectedTotal))
      .bold(true)
      .row("Handed to Admin:", formatINR(Number(amountSettled)))
      .bold(false);

    if (Math.max(0, selectedTotal - Number(amountSettled)) > 0) {
      builder.row("Balance Due:", formatINR(selectedTotal - Number(amountSettled)));
    }
    if (notes.trim()) {
      builder.textLine(`Note: ${notes.trim()}`);
    }

    builder
      .horizontalRule("=")
      .lineFeed(2)
      .row("Driver Sig", "Admin Sig")
      .lineFeed(2);

    if (cfg.autoCut) builder.cutPaper();

    const fallbackHtml = `
      <div class="center">
        <div class="title">${cfg.headerLine1}</div>
        <div>Cashier & Driver Settlement Voucher</div>
        <div class="bold">#${completedSettlement.settlement_number}</div>
        <div>${formatIST(completedSettlement.settled_at)}</div>
        <div class="hr"></div>
      </div>
      <div class="row"><span>Driver:</span><span class="bold">${driverName}</span></div>
      <div class="row"><span>Received By:</span><span class="bold">${collectorName || "Store Admin"}</span></div>
      <div class="row"><span>Orders Count:</span><span>${selectedOrderIds.length} orders</span></div>
      <div class="row"><span>Payment Mode:</span><span class="bold">${paymentMode.toUpperCase()}</span></div>
      <div class="hr"></div>
      <div class="row"><span>Total COD Orders:</span><span>${formatINR(selectedTotal)}</span></div>
      <div class="row bold total-row"><span>Handed to Admin:</span><span>${formatINR(Number(amountSettled))}</span></div>
      ${selectedTotal - Number(amountSettled) > 0 ? `<div class="row" style="color:red"><span>Pending Due:</span><span>${formatINR(selectedTotal - Number(amountSettled))}</span></div>` : ""}
      ${notes.trim() ? `<div style="margin:4px 0; font-style:italic">Note: ${notes.trim()}</div>` : ""}
      <div class="hr"></div>
      <div style="display:flex; justify-content:space-between; margin-top:35px; text-align:center;">
        <div style="border-top:1px solid #000; width:45%; padding-top:4px;">Driver Signature</div>
        <div style="border-top:1px solid #000; width:45%; padding-top:4px;">Admin Signature</div>
      </div>
    `;

    await sendEscPosToPrinter(builder.build(), cfg, fallbackHtml);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setCompletedSettlement(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl p-4 sm:p-6 border-border/70 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Wallet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  {completedSettlement ? "Cash Handover Settlement Receipt" : "Driver COD Cash Handover & Settlement"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Driver: <strong className="text-foreground">{driverName}</strong>
                  {driverPhone && ` (${driverPhone})`}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {completedSettlement ? (
          /* Settlement Confirmation & Printable Receipt */
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-500 mb-1" />
              <h3 className="font-bold text-base text-foreground">Cash Handover Completed & Verified!</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receipt #{completedSettlement.settlement_number} has been logged in store reconciliation reports.
              </p>
            </div>

            {/* Printable Receipt Voucher Card */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 font-mono text-xs shadow-xs">
              <div className="text-center border-b border-dashed border-border pb-3">
                <p className="font-bold text-sm text-foreground">FISH N FRESH COD CASH SETTLEMENT</p>
                <p className="text-[11px] text-muted-foreground">Official Cashier & Driver Handover Slip</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Settlement ID: <span className="text-primary font-bold">{completedSettlement.settlement_number}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">{formatIST(completedSettlement.settled_at)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs py-1 border-b border-dashed border-border">
                <div>
                  <span className="text-muted-foreground">Driver:</span>{" "}
                  <strong className="text-foreground">{completedSettlement.driver_name}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Received By:</span>{" "}
                  <strong className="text-foreground">{completedSettlement.settled_by_name}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Orders Count:</span>{" "}
                  <strong className="text-foreground">{completedSettlement.orders_count} orders</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Mode:</span>{" "}
                  <strong className="text-foreground uppercase">{completedSettlement.payment_mode}</strong>
                </div>
              </div>

              <div className="space-y-1.5 py-1 border-b border-dashed border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total COD Orders Value:</span>
                  <span>{formatINR(Number(completedSettlement.amount_collected))}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Physical Cash Handed Over:</span>
                  <span>{formatINR(Number(completedSettlement.amount_settled))}</span>
                </div>
                {Number(completedSettlement.balance_remaining) > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Remaining Due / Shortage:</span>
                    <span>{formatINR(Number(completedSettlement.balance_remaining))}</span>
                  </div>
                )}
              </div>

              {completedSettlement.notes && (
                <p className="text-[11px] text-muted-foreground italic">Note: {completedSettlement.notes}</p>
              )}

              <div className="pt-4 flex justify-between text-[10px] text-muted-foreground text-center">
                <div className="border-t border-border pt-1 w-24">Driver Signature</div>
                <div className="border-t border-border pt-1 w-24">Cashier Signature</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1"
                onClick={handlePrintSlip}
              >
                <Printer className="size-3.5" /> Print Receipt
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl text-xs font-bold"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Settlement Creation Form */
          <div className="space-y-4 pt-2">
            {/* Orders Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold text-foreground">
                  Delivered COD Orders to Settle ({selectedOrderIds.length}/{unsettledOrders.length})
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-primary"
                  onClick={toggleSelectAll}
                >
                  {selectedOrderIds.length === unsettledOrders.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border border-border/70 p-2 bg-muted/20">
                {unsettledOrders.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    No unsettled COD orders pending for {driverName}.
                  </p>
                ) : (
                  unsettledOrders.map((o) => {
                    const isChecked = selectedOrderIds.includes(o.id);
                    return (
                      <div
                        key={o.id}
                        onClick={() => toggleOrder(o.id)}
                        className={`cursor-pointer flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                          isChecked
                            ? "border-primary/40 bg-primary/5 shadow-2xs"
                            : "border-border/60 bg-card hover:bg-muted/30 opacity-70"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOrder(o.id)}
                            className="size-4 rounded text-primary cursor-pointer"
                          />
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-foreground">#{o.order_number ?? o.id.slice(0, 8)}</span>
                            <span className="text-muted-foreground ml-1.5 truncate">
                              • {o.customer_name}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold font-display text-foreground shrink-0">
                          {formatINR(Number(o.total || 0))}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cash Calculation & Mode Grid */}
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Selected Orders Expected Total:</span>
                <span className="text-base font-bold font-display text-amber-700 dark:text-amber-400">
                  {formatINR(selectedTotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs">Physical Cash Amount Handed Over (₹)</Label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={amountSettled}
                      onChange={(e) => setAmountSettled(e.target.value)}
                      className="rounded-xl text-sm font-bold font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-9 text-xs px-2 shrink-0 font-semibold"
                      onClick={() => setAmountSettled(selectedTotal.toString())}
                    >
                      Exact
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Handover Payment Method</Label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-xl border border-input bg-card px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="cash">💵 Physical Cash to Store Counter</option>
                    <option value="counter_upi">📱 Driver Scanned Store Counter UPI QR</option>
                    <option value="bank_transfer">🏦 Direct Bank Account Transfer</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Admin Collector & Reference Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cash Received By (Admin / Cashier)</Label>
                <Input
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  placeholder="e.g. Rajesh (Store Manager)"
                  className="mt-1 text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs">Handover Notes / Currency Details</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Morning cash bag verified"
                  className="mt-1 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                disabled={settleMutation.isPending || selectedOrderIds.length === 0}
                onClick={() => settleMutation.mutate()}
              >
                {settleMutation.isPending ? "Recording Settlement..." : "💵 Confirm Cash Handover & Settle"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

