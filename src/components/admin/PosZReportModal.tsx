import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Banknote,
  QrCode,
  CreditCard,
  Receipt,
  Clock,
  User,
  ShieldCheck,
  Building,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import {
  printZReport,
  getSavedPrinterConfig,
  type ZReportData,
} from "@/lib/thermalPrinter";

interface PosZReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: any;
  branchName?: string | undefined;
}

export function PosZReportModal({
  open,
  onOpenChange,
  settings,
  branchName,
}: PosZReportModalProps) {
  // Opening float persisted in localStorage
  const [openingFloat, setOpeningFloat] = useState<number>(() => {
    if (typeof window === "undefined") return 1000;
    try {
      const saved = localStorage.getItem("fnf_pos_opening_float");
      return saved ? Number(saved) : 1000;
    } catch {
      return 1000;
    }
  });

  // Shift start time persisted in localStorage
  const [shiftStartTime, setShiftStartTime] = useState<string>(() => {
    if (typeof window === "undefined") return new Date().toLocaleTimeString("en-IN");
    try {
      const saved = localStorage.getItem("fnf_pos_shift_start");
      if (saved) return saved;
      const initial = new Date();
      initial.setHours(8, 0, 0, 0);
      const str = initial.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      localStorage.setItem("fnf_pos_shift_start", str);
      return str;
    } catch {
      return "08:00 AM";
    }
  });

  // Counted cash declared by cashier
  const [actualCashStr, setActualCashStr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [cashierName, setCashierName] = useState<string>("Counter Cashier");

  // Fetch current user details for cashier name
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (user) {
        const meta = (user.user_metadata || {}) as Record<string, any>;
        const name =
          meta["full_name"] ||
          meta["name"] ||
          user.email?.split("@")[0] ||
          "Counter Cashier";
        setCashierName(name);
      }
    });
  }, []);

  // Query today's completed POS & Dine-in orders
  const { data: posOrders = [] } = useQuery({
    queryKey: ["pos_z_report_orders"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, actual_payment_method, payment_method, fulfillment_type, refund_amount, created_at")
        .in("fulfillment_type", ["pos", "dine_in", "table"])
        .neq("status", "cancelled")
        .gte("created_at", todayStart.toISOString());

      if (error) return [];
      return data || [];
    },
    enabled: open,
  });

  // Financial reconciliation calculations
  const breakdown = useMemo(() => {
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let cashCount = 0;
    let upiCount = 0;
    let cardCount = 0;
    let refundsTotal = 0;

    posOrders.forEach((o: any) => {
      const amt = Number(o.total || 0);
      refundsTotal += Number(o.refund_amount || 0);
      const meth = (o.actual_payment_method || o.payment_method || "").toLowerCase();
      if (meth === "cash") {
        cashSales += amt;
        cashCount++;
      } else if (meth === "card" || meth === "pos" || meth === "credit_card") {
        cardSales += amt;
        cardCount++;
      } else {
        // default to UPI / digital
        upiSales += amt;
        upiCount++;
      }
    });

    const totalRevenue = cashSales + upiSales + cardSales;
    const expectedCash = openingFloat + cashSales - refundsTotal;

    return {
      cashSales,
      upiSales,
      cardSales,
      cashCount,
      upiCount,
      cardCount,
      orderCount: posOrders.length,
      refundsTotal,
      totalRevenue,
      expectedCash,
    };
  }, [posOrders, openingFloat]);

  // Set default actual cash when drawer modal opens
  useEffect(() => {
    if (open && !actualCashStr) {
      setActualCashStr(String(breakdown.expectedCash));
    }
  }, [open, breakdown.expectedCash]);

  const actualCash = Number(actualCashStr) || 0;
  const variance = actualCash - breakdown.expectedCash;

  const handleUpdateOpeningFloat = (val: number) => {
    setOpeningFloat(val);
    try {
      localStorage.setItem("fnf_pos_opening_float", String(val));
      toast.success(`Opening cash float updated: ${formatINR(val)}`);
    } catch {}
  };

  const handlePrintZReport = async () => {
    setIsPrinting(true);
    try {
      const nowStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const reportNo = `Z-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const reportData: ZReportData = {
        reportNo,
        openingTime: shiftStartTime,
        closingTime: nowStr,
        cashierName,
        branchName: branchName || settings?.firm_name || undefined,
        openingFloat,
        cashSales: breakdown.cashSales,
        upiSales: breakdown.upiSales,
        cardSales: breakdown.cardSales,
        totalRevenue: breakdown.totalRevenue,
        orderCount: breakdown.orderCount,
        refundsTotal: breakdown.refundsTotal,
        expectedCash: breakdown.expectedCash,
        actualCash,
        variance,
        notes: notes.trim() || undefined,
        storeName: settings?.firm_name || settings?.store_name || "FISH N FRESH HUB",
        storeAddress: settings?.shop_address || undefined,
        storePhone: settings?.contact_phone || undefined,
        storeGstin: settings?.gstin || undefined,
      };

      const printerConfig = getSavedPrinterConfig();
      const success = await printZReport(reportData, settings, printerConfig);

      if (success) {
        toast.success("Thermal Z-Report sent to printer!");
      } else {
        toast.info("No active hardware thermal printer. Connect Bluetooth/USB in Printer Settings.");
      }
    } catch (err: any) {
      toast.error(`Printing error: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCloseShift = () => {
    const nowStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const reportNo = `Z-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const shiftRecord = {
      reportNo,
      shiftStart: shiftStartTime,
      shiftClose: nowStr,
      cashier: cashierName,
      openingFloat,
      cashSales: breakdown.cashSales,
      upiSales: breakdown.upiSales,
      cardSales: breakdown.cardSales,
      totalRevenue: breakdown.totalRevenue,
      orderCount: breakdown.orderCount,
      expectedCash: breakdown.expectedCash,
      actualCash,
      variance,
      notes,
      timestamp: new Date().toISOString(),
    };

    try {
      const historyStr = localStorage.getItem("fnf_pos_shift_history");
      const history = historyStr ? JSON.parse(historyStr) : [];
      history.unshift(shiftRecord);
      localStorage.setItem("fnf_pos_shift_history", JSON.stringify(history.slice(0, 30)));

      // Reset new shift start time to now
      const nextShiftStart = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      localStorage.setItem("fnf_pos_shift_start", nextShiftStart);
      setShiftStartTime(nextShiftStart);

      toast.success("Shift register closed and audit snapshot recorded!");
      onOpenChange(false);
    } catch {
      toast.error("Could not record shift history.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Cashier Shift Register &amp; Z-Report
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Day-end drawer reconciliation, payment method audit, and thermal Z-Report generation.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-rose-500/30 text-rose-600 bg-rose-500/5 text-xs font-mono">
              AUDIT SLIP
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Shift Metadata Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-muted/40 p-3.5 rounded-2xl text-xs border border-border/60">
            <div>
              <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                <Clock className="size-3" /> Shift Open
              </span>
              <span className="font-bold text-foreground">{shiftStartTime}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                <Clock className="size-3" /> Shift Close
              </span>
              <span className="font-bold text-foreground">
                {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                <User className="size-3" /> Cashier
              </span>
              <span className="font-bold text-foreground truncate block">{cashierName}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                <Building className="size-3" /> Orders Count
              </span>
              <span className="font-bold text-foreground">{breakdown.orderCount} Bills</span>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> Tender Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cash Sales */}
              <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5 shadow-none">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Banknote className="size-3.5" /> Cash Sales
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-emerald-500/30 text-emerald-600">
                      {breakdown.cashCount} bills
                    </Badge>
                  </div>
                  <div className="text-lg font-black text-foreground">{formatINR(breakdown.cashSales)}</div>
                </CardContent>
              </Card>

              {/* UPI Sales */}
              <Card className="rounded-2xl border-sky-500/20 bg-sky-500/5 shadow-none">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-sky-700 dark:text-sky-400">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <QrCode className="size-3.5" /> UPI / QR
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-sky-500/30 text-sky-600">
                      {breakdown.upiCount} bills
                    </Badge>
                  </div>
                  <div className="text-lg font-black text-foreground">{formatINR(breakdown.upiSales)}</div>
                </CardContent>
              </Card>

              {/* Card / POS Sales */}
              <Card className="rounded-2xl border-purple-500/20 bg-purple-500/5 shadow-none">
                <CardContent className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <CreditCard className="size-3.5" /> Card / POS
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-purple-500/30 text-purple-600">
                      {breakdown.cardCount} bills
                    </Badge>
                  </div>
                  <div className="text-lg font-black text-foreground">{formatINR(breakdown.cardSales)}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Drawer Reconciliation Section */}
          <div className="space-y-3 bg-card border border-border/80 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="size-3.5 text-primary" /> Drawer Cash Reconciliation
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Float + Cash Inflow - Refunds
              </span>
            </h4>

            {/* Opening Float configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1 border-b border-border/50 pb-3">
              <div>
                <label className="text-xs font-semibold text-foreground block">
                  Opening Float (Petty Cash in Drawer)
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Cash placed in the register at shift beginning.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={openingFloat}
                    onChange={(e) => handleUpdateOpeningFloat(Number(e.target.value) || 0)}
                    className="pl-7 h-9 text-xs font-bold rounded-xl"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateOpeningFloat(1000)}
                  className="rounded-xl h-9 text-xs shrink-0"
                >
                  Reset ₹1000
                </Button>
              </div>
            </div>

            {/* Reconciliation Math Rows */}
            <div className="space-y-1.5 text-xs py-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Opening Cash Float</span>
                <span className="font-semibold text-foreground">+{formatINR(openingFloat)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Cash Sales Collected</span>
                <span className="font-semibold text-emerald-600">+{formatINR(breakdown.cashSales)}</span>
              </div>
              {breakdown.refundsTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Customer Refunds Paid Out</span>
                  <span className="font-semibold text-rose-600">-{formatINR(breakdown.refundsTotal)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold text-sm text-foreground">
                <span>Expected Drawer Total:</span>
                <span className="text-primary font-black">{formatINR(breakdown.expectedCash)}</span>
              </div>
            </div>

            {/* Cashier Declared Counted Cash */}
            <div className="pt-2 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Actual Counted Cash in Drawer
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActualCashStr(String(breakdown.expectedCash))}
                    className="h-6 text-[10px] px-2 rounded-lg text-primary hover:bg-primary/10"
                  >
                    Set to Expected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActualCashStr("0")}
                    className="h-6 text-[10px] px-2 rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={actualCashStr}
                  onChange={(e) => setActualCashStr(e.target.value)}
                  placeholder="Count all notes and coins in physical drawer..."
                  className="pl-8 h-11 text-base font-extrabold rounded-2xl border-primary/40 focus:border-primary"
                />
              </div>

              {/* Variance Indicator Banner */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-colors ${
                  variance === 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : variance > 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {variance === 0 ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0" />
                  )}
                  <span>
                    {variance === 0
                      ? "Perfect Match: Register balances to the rupee."
                      : variance > 0
                      ? `Surplus: Drawer has ${formatINR(variance)} extra cash.`
                      : `Shortage: Drawer is short by ${formatINR(Math.abs(variance))}.`}
                  </span>
                </div>
                <span className="font-mono text-sm font-black">
                  {variance > 0 ? `+${formatINR(variance)}` : formatINR(variance)}
                </span>
              </div>
            </div>

            {/* Optional Notes */}
            <div className="pt-2">
              <label className="text-[11px] text-muted-foreground block mb-1">
                Shift Audit Notes / Cash Discrepancy Explanation (Optional)
              </label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Petty cash ₹150 used for ice blocks purchase, receipt kept in drawer."
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl h-10 text-xs px-4"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={() => {
                  const d = new Date().toLocaleDateString("en-IN");
                  const msg = [
                    `*Daily Closing — ${d}*`,
                    `Cashier: ${cashierName}`,
                    `Opening balance: ${formatINR(openingFloat)}`,
                    `Bills: ${breakdown.orderCount}`,
                    `Cash: ${formatINR(breakdown.cashSales)} (${breakdown.cashCount})`,
                    `UPI: ${formatINR(breakdown.upiSales)} (${breakdown.upiCount})`,
                    `Card: ${formatINR(breakdown.cardSales)}`,
                    `*Total: ${formatINR(breakdown.totalRevenue)}*`,
                    `Expected cash in drawer: ${formatINR(breakdown.expectedCash)}`,
                    `Counted cash: ${formatINR(actualCash)} (diff ${formatINR(variance)})`,
                    notes ? `Notes: ${notes}` : "",
                  ].filter(Boolean).join("\n");
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
                }}
                className="rounded-2xl h-10 text-xs font-bold px-4 gap-1.5"
              >
                <span>Send to WhatsApp</span>
              </Button>
              <Button
                variant="outline"
                onClick={handlePrintZReport}
                disabled={isPrinting}
                className="rounded-2xl h-10 text-xs font-bold px-4 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Printer className="size-3.5" />
                <span>{isPrinting ? "Printing Z-Slip..." : "Print Thermal Z-Report"}</span>
              </Button>

              <Button
                onClick={handleCloseShift}
                className="rounded-2xl h-10 text-xs font-bold px-5 bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-sm"
              >
                <ShieldCheck className="size-4" />
                <span>Close Shift &amp; Save Snapshot</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
